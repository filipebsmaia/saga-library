import { Command } from '@core/common/domain/command';
import { SagaEventLogRepository } from '@core/saga/domain/repositories/saga-event-log.repository';

export interface DedupeEventsInput {
  eventIds: string[];
}

export class DedupeEventsCommand extends Command<DedupeEventsInput, Set<string>> {
  constructor(private readonly eventLogRepo: SagaEventLogRepository) {
    super();
  }

  async execute({ eventIds }: DedupeEventsInput): Promise<Set<string>> {
    return this.eventLogRepo.bulkCheckExisting(eventIds);
  }
}
