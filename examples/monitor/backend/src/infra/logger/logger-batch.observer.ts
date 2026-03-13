import { BatchObserver } from '@core/common/application/batch-observer';
import { Logger } from '@core/common/application/logger';
import type { BatchProcessedEvent } from '@core/saga/domain/types/batch-processed.event';

export class LoggerBatchObserver extends BatchObserver {
  constructor(private readonly logger: Logger) {
    super();
  }

  onBatchProcessed(event: BatchProcessedEvent): void {
    if (event.totalMs > 2000 || event.messageCount > 100) {
      this.logger.info('[Projector batch]', {
        topic: event.topic,
        partition: event.partition,
        messages: event.messageCount,
        processed: event.processed,
        skipped: event.skipped,
        deduped: event.deduped,
        completedGuard: event.completedGuard,
        errors: event.errors,
        totalMs: Math.round(event.totalMs),
        dedupeMs: Math.round(event.phases.dedupeMs),
        lookupMs: Math.round(event.phases.lookupMs),
        txMs: Math.round(event.phases.persistMs),
        redisMs: Math.round(event.phases.publishMs),
      });
    }
  }
}
