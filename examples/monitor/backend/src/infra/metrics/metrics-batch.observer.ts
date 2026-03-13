import { BatchObserver } from '@core/common/application/batch-observer';
import { Metrics } from '@core/common/application/metrics';
import type { BatchProcessedEvent } from '@core/saga/domain/types/batch-processed.event';

export class MetricsBatchObserver extends BatchObserver {
  constructor(private readonly metrics: Metrics) {
    super();
  }

  onBatchProcessed(event: BatchProcessedEvent): void {
    const { topic } = event;

    this.metrics.counter('projector.batch.total', 1, { topic });
    this.metrics.histogram('projector.batch.duration_ms', event.totalMs, { topic });

    this.metrics.histogram('projector.phase.duration_ms', event.phases.dedupeMs, { topic, phase: 'dedupe' });
    this.metrics.histogram('projector.phase.duration_ms', event.phases.lookupMs, { topic, phase: 'lookup' });
    this.metrics.histogram('projector.phase.duration_ms', event.phases.persistMs, { topic, phase: 'persist' });
    this.metrics.histogram('projector.phase.duration_ms', event.phases.publishMs, { topic, phase: 'publish' });

    if (event.processed > 0) this.metrics.counter('projector.events.processed', event.processed, { topic });
    if (event.skipped > 0) this.metrics.counter('projector.events.skipped', event.skipped, { topic });
    if (event.deduped > 0) this.metrics.counter('projector.events.deduped', event.deduped, { topic });
    if (event.completedGuard > 0) this.metrics.counter('projector.events.completed_guard', event.completedGuard, { topic });
    if (event.errors > 0) this.metrics.counter('projector.events.errors', event.errors, { topic });
  }
}
