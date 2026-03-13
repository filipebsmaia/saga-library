import { Command } from '@core/common/domain/command';
import { deriveStatus } from '@core/saga/domain/services/status-deriver';
import { SagaStatus } from '@core/saga/domain/types/saga-status.enum';
import type { BulkUpsertStateData } from '@core/saga/domain/repositories/saga-state.repository';
import type { BulkInsertEventLogData } from '@core/saga/domain/repositories/saga-event-log.repository';
import type { PreparedMessage, SagaUpdate } from '@core/saga/application/types/projector.types';

export interface DeriveChangesInput {
  newMessages: PreparedMessage[];
  stateMap: Map<string, { status: string; startedAt: Date; eventCount: number }>;
}

export interface DeriveChangesOutput {
  eventLogs: BulkInsertEventLogData[];
  sagaStates: BulkUpsertStateData[];
  sagaUpdates: SagaUpdate[];
  completedGuard: number;
  processed: number;
}

export class DeriveChangesCommand extends Command<DeriveChangesInput, DeriveChangesOutput> {
  async execute({ newMessages, stateMap }: DeriveChangesInput): Promise<DeriveChangesOutput> {
    const eventLogs: BulkInsertEventLogData[] = [];
    const sagaStatesMap = new Map<string, BulkUpsertStateData>();
    const sagaUpdates: SagaUpdate[] = [];
    const inBatchStatus = new Map<string, SagaStatus>();
    let completedGuard = 0;
    let processed = 0;

    for (const msg of newMessages) {
      const { parsed } = msg;
      const sagaId = parsed.sagaId;
      const publishedAt = new Date(parsed.sagaPublishedAt);

      const currentStatus = inBatchStatus.get(sagaId) ?? (stateMap.get(sagaId)?.status as SagaStatus | undefined);

      if (currentStatus === SagaStatus.COMPLETED) {
        eventLogs.push(this.buildEventLogRow(msg, SagaStatus.COMPLETED, SagaStatus.COMPLETED));
        completedGuard++;
        continue;
      }

      const newStatus = deriveStatus(parsed.sagaEventHint, currentStatus);
      eventLogs.push(this.buildEventLogRow(msg, currentStatus ?? null, newStatus));
      inBatchStatus.set(sagaId, newStatus);

      const existing = sagaStatesMap.get(sagaId);
      const dbState = stateMap.get(sagaId);

      sagaStatesMap.set(sagaId, {
        sagaId,
        sagaRootId: parsed.sagaRootId,
        sagaParentId: parsed.sagaParentId ?? null,
        sagaName: parsed.sagaName ?? null,
        sagaDescription: parsed.sagaDescription ?? null,
        status: newStatus,
        currentStepName: parsed.sagaStepName,
        currentStepDescription: parsed.sagaStepDescription ?? null,
        lastEventId: parsed.sagaEventId,
        lastEventHint: parsed.sagaEventHint ?? null,
        lastCausationId: parsed.sagaCausationId,
        startedAt: dbState?.startedAt ?? publishedAt,
        endedAt: newStatus === SagaStatus.COMPLETED ? publishedAt : null,
        eventCountIncrement: (existing?.eventCountIncrement ?? 0) + 1,
        schemaVersion: parsed.sagaSchemaVersion,
        lastTopic: msg.topic,
        lastPartition: msg.partition,
        lastOffset: msg.offset,
      });

      sagaUpdates.push({
        state: {
          sagaId,
          sagaRootId: parsed.sagaRootId,
          sagaParentId: parsed.sagaParentId ?? null,
          sagaName: parsed.sagaName ?? null,
          sagaDescription: parsed.sagaDescription ?? null,
          status: newStatus,
          currentStepName: parsed.sagaStepName,
          currentStepDescription: parsed.sagaStepDescription ?? null,
          lastEventHint: parsed.sagaEventHint ?? null,
          lastTopic: msg.topic,
          startedAt: dbState?.startedAt ?? publishedAt,
          endedAt: newStatus === SagaStatus.COMPLETED ? publishedAt : null,
          updatedAt: new Date(),
          eventCount: (dbState?.eventCount ?? 0) + (existing?.eventCountIncrement ?? 0) + 1,
        },
        event: {
          sagaEventId: parsed.sagaEventId,
          sagaEventHint: parsed.sagaEventHint ?? null,
          sagaStepName: parsed.sagaStepName,
          sagaPublishedAt: publishedAt,
        },
      });

      processed++;
    }

    return {
      eventLogs,
      sagaStates: [...sagaStatesMap.values()],
      sagaUpdates,
      completedGuard,
      processed,
    };
  }

  private buildEventLogRow(
    msg: PreparedMessage,
    statusBefore: SagaStatus | string | null,
    statusAfter: SagaStatus | string,
  ): BulkInsertEventLogData {
    const { parsed } = msg;
    return {
      sagaEventId: parsed.sagaEventId,
      sagaId: parsed.sagaId,
      sagaRootId: parsed.sagaRootId,
      sagaParentId: parsed.sagaParentId ?? null,
      sagaCausationId: parsed.sagaCausationId,
      sagaName: parsed.sagaName ?? null,
      sagaDescription: parsed.sagaDescription ?? null,
      sagaStepName: parsed.sagaStepName,
      sagaStepDescription: parsed.sagaStepDescription ?? null,
      sagaEventHint: parsed.sagaEventHint ?? null,
      sagaPublishedAt: new Date(parsed.sagaPublishedAt),
      sagaSchemaVersion: parsed.sagaSchemaVersion,
      topic: msg.topic,
      partition: msg.partition,
      offset: msg.offset,
      statusBefore: statusBefore ?? null,
      statusAfter: statusAfter as string,
      headersJson: msg.headersJson,
    };
  }
}
