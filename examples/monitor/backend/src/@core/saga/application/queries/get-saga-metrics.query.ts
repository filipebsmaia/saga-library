import { SagaStateRepository } from '../../domain/repositories/saga-state.repository';
import { SagaEventLogRepository } from '../../domain/repositories/saga-event-log.repository';
import { SagaMetricsDto } from '../dtos/saga-metrics.dto';
import { SagaStatus } from '../../domain/types/saga-status.enum';

const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes with no update

export class GetSagaMetricsQuery {
  constructor(
    private readonly sagaStateRepo: SagaStateRepository,
    private readonly sagaEventLogRepo: SagaEventLogRepository,
  ) {}

  async execute(sagaId: string): Promise<SagaMetricsDto | null> {
    const state = await this.sagaStateRepo.findById(sagaId);
    if (!state) return null;

    const [counts, childSagas] = await Promise.all([
      this.sagaEventLogRepo.countBySagaId(sagaId),
      this.sagaStateRepo.findMany({ sagaRootId: state.sagaRootId }),
    ]);

    // Only count children (not the saga itself)
    const childSagaCount = childSagas.filter((s) => s.sagaParentId === sagaId).length;

    const now = Date.now();
    const startedAtMs = state.startedAt.getTime();
    const updatedAtMs = state.updatedAt.getTime();
    const elapsedMs = now - startedAtMs;
    const lastUpdateAgoMs = now - updatedAtMs;

    const totalDurationMs =
      state.status === SagaStatus.COMPLETED && state.endedAt ? state.endedAt.getTime() - startedAtMs : null;

    const isStuck = state.status !== SagaStatus.COMPLETED && lastUpdateAgoMs > STUCK_THRESHOLD_MS;

    return {
      sagaId: state.sagaId,
      status: state.status,
      elapsedMs,
      totalDurationMs,
      lastUpdateAgoMs,
      totalEvents: counts.total,
      compensationCount: counts.compensations,
      forkCount: counts.forks,
      childSagaCount,
      isStuck,
    };
  }
}
