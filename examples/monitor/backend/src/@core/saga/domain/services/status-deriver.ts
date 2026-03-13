import { SagaStatus } from '../types/saga-status.enum';
import type { EventHint } from '../types/event-hint.type';

export function deriveStatus(hint: EventHint | undefined, currentStatus: SagaStatus | undefined): SagaStatus {
  if (hint === 'final') {
    return SagaStatus.COMPLETED;
  }

  if (hint === 'compensation') {
    return SagaStatus.COMPENSATING;
  }

  // step, fork, or undefined hint
  // If already compensating, keep compensating (compensation is sticky until final)
  if (currentStatus === SagaStatus.COMPENSATING) {
    return SagaStatus.COMPENSATING;
  }

  return SagaStatus.RUNNING;
}
