import type { BatchProcessedEvent } from '@core/saga/domain/types/batch-processed.event';

export abstract class BatchObserver {
  abstract onBatchProcessed(event: BatchProcessedEvent): void;
}
