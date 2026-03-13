import type { BatchProcessedEvent } from '@core/saga/domain/types/batch-processed.event';
import type { BatchObserver } from './batch-observer';

export class BatchObserverHub {
  constructor(private readonly observers: BatchObserver[]) {}

  notify(event: BatchProcessedEvent): void {
    for (const obs of this.observers) {
      obs.onBatchProcessed(event);
    }
  }
}
