import { Command } from '@core/common/domain/command';
import { SagaStateRepository } from '@core/saga/domain/repositories/saga-state.repository';

export interface LookupStatesInput {
  sagaIds: string[];
}

export type LookupStatesOutput = Map<string, { status: string; startedAt: Date; eventCount: number }>;

export class LookupStatesCommand extends Command<LookupStatesInput, LookupStatesOutput> {
  constructor(private readonly stateRepo: SagaStateRepository) {
    super();
  }

  async execute({ sagaIds }: LookupStatesInput): Promise<LookupStatesOutput> {
    return this.stateRepo.bulkLookup(sagaIds);
  }
}
