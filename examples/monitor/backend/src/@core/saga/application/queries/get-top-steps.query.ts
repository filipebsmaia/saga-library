import { SagaEventLogRepository } from '../../domain/repositories/saga-event-log.repository';

export interface TopStepDto {
  stepName: string;
  sagaName: string | null;
  count: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

export class GetTopStepsQuery {
  constructor(private readonly eventLogRepo: SagaEventLogRepository) {}

  async execute(limit = 10): Promise<TopStepDto[]> {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    return this.eventLogRepo.findTopSteps(since, limit);
  }
}
