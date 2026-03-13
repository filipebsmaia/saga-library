import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { Logger } from '@core/common/application/logger';
import { BatchObserverHub } from '@core/common/application/batch-observer-hub';
import { ParseBatchCommand } from '@core/saga/application/commands/parse-batch.command';
import { DedupeEventsCommand } from '@core/saga/application/commands/dedupe-events.command';
import { LookupStatesCommand } from '@core/saga/application/commands/lookup-states.command';
import { DeriveChangesCommand } from '@core/saga/application/commands/derive-changes.command';
import { PersistBatchCommand } from '@core/saga/application/commands/persist-batch.command';
import { PublishUpdatesCommand } from '@core/saga/application/commands/publish-updates.command';

@Injectable()
export class KafkaProjectorService implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer | null = null;
  private readonly kafka: Kafka;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly observers: BatchObserverHub,
    private readonly parseBatchCommand: ParseBatchCommand,
    private readonly dedupeEventsCommand: DedupeEventsCommand,
    private readonly lookupStatesCommand: LookupStatesCommand,
    private readonly deriveChangesCommand: DeriveChangesCommand,
    private readonly persistBatchCommand: PersistBatchCommand,
    private readonly publishUpdatesCommand: PublishUpdatesCommand,
  ) {
    const brokers = this.config.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    this.kafka = new Kafka({
      clientId: 'saga-monitor',
      brokers,
    });
  }

  async onModuleInit() {
    const groupId = this.config.get<string>('KAFKA_GROUP_ID', 'saga-monitor');
    this.consumer = this.kafka.consumer({ groupId });

    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [/.*/ as unknown as string], fromBeginning: true });

    await this.consumer.run({
      partitionsConsumedConcurrently: 25,
      eachBatch: async (payload: EachBatchPayload) => {
        await this.processBatch(payload);
      },
    });

    this.logger.info('Kafka projector started (batch mode)', { groupId });
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.logger.info('Kafka projector stopped');
    }
  }

  private async processBatch({ batch, resolveOffset, heartbeat }: EachBatchPayload): Promise<void> {
    const batchStartAt = performance.now();
    const lastOffset = batch.messages[batch.messages.length - 1].offset;

    // ── Phase 1: Parse ──
    const { prepared, skipped } = await this.parseBatchCommand.execute({
      messages: batch.messages,
      topic: batch.topic,
      partition: batch.partition,
    });

    if (prepared.length === 0) {
      resolveOffset(lastOffset);
      return;
    }

    // ── Phase 2: Dedupe ──
    const dedupeStartAt = performance.now();
    const existingIds = await this.dedupeEventsCommand.execute({
      eventIds: prepared.map((p) => p.parsed.sagaEventId),
    });
    const dedupeMs = performance.now() - dedupeStartAt;

    const newMessages = prepared.filter((p) => !existingIds.has(p.parsed.sagaEventId));
    const deduped = prepared.length - newMessages.length;

    if (newMessages.length === 0) {
      resolveOffset(lastOffset);
      return;
    }

    // ── Phase 3: Lookup ──
    const lookupStartAt = performance.now();
    const uniqueSagaIds = [...new Set(newMessages.map((p) => p.parsed.sagaId))];
    const stateMap = await this.lookupStatesCommand.execute({ sagaIds: uniqueSagaIds });
    const lookupMs = performance.now() - lookupStartAt;

    // ── Phase 4: Derive ──
    const { eventLogs, sagaStates, sagaUpdates, completedGuard, processed } = await this.deriveChangesCommand.execute({
      newMessages,
      stateMap,
    });

    // ── Phase 5: Persist ──
    const persistStartAt = performance.now();
    const { errors } = await this.persistBatchCommand.execute({ states: sagaStates, eventLogs });
    const persistMs = performance.now() - persistStartAt;

    // On transaction failure, do NOT resolve offset — let KafkaJS retry the batch
    if (errors > 0) {
      this.observers.notify({
        topic: batch.topic,
        partition: batch.partition,
        messageCount: batch.messages.length,
        processed: 0,
        skipped,
        deduped,
        completedGuard,
        errors,
        phases: { dedupeMs, lookupMs, persistMs, publishMs: 0 },
        totalMs: performance.now() - batchStartAt,
      });
      return;
    }

    // ── Phase 6: Publish ──
    const publishStartAt = performance.now();
    await this.publishUpdatesCommand.execute({ sagaUpdates });
    const publishMs = performance.now() - publishStartAt;

    // Resolve offset only after successful persistence
    resolveOffset(lastOffset);
    await heartbeat();

    // ── Notify observers ──
    this.observers.notify({
      topic: batch.topic,
      partition: batch.partition,
      messageCount: batch.messages.length,
      processed,
      skipped,
      deduped,
      completedGuard,
      errors: 0,
      phases: { dedupeMs, lookupMs, persistMs, publishMs },
      totalMs: performance.now() - batchStartAt,
    });
  }
}
