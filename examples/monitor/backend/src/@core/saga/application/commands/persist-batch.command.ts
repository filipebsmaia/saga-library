import { Command } from '@core/common/domain/command';
import { Logger } from '@core/common/application/logger';
import { UnitOfWork } from '@core/common/application/unit-of-work';
import { SagaStateRepository, BulkUpsertStateData } from '@core/saga/domain/repositories/saga-state.repository';
import { SagaEventLogRepository, BulkInsertEventLogData } from '@core/saga/domain/repositories/saga-event-log.repository';

export interface PersistBatchInput {
  states: BulkUpsertStateData[];
  eventLogs: BulkInsertEventLogData[];
}

export interface PersistBatchOutput {
  errors: number;
}

const MAX_RETRIES = 3;

export class PersistBatchCommand extends Command<PersistBatchInput, PersistBatchOutput> {
  constructor(
    private readonly stateRepo: SagaStateRepository,
    private readonly eventLogRepo: SagaEventLogRepository,
    private readonly uow: UnitOfWork,
    private readonly logger: Logger,
  ) {
    super();
  }

  async execute({ states, eventLogs }: PersistBatchInput): Promise<PersistBatchOutput> {
    // Sort once for consistent lock ordering (deadlock prevention)
    states.sort((a, b) => a.sagaId.localeCompare(b.sagaId));
    eventLogs.sort((a, b) => a.sagaId.localeCompare(b.sagaId));

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.uow.runTransaction({ maxWait: 15_000, timeout: 30_000 }, async () => {
          await this.stateRepo.bulkUpsert(states);
          await this.eventLogRepo.bulkInsert(eventLogs);
        });
        return { errors: 0 };
      } catch (err) {
        const isDeadlock = String(err).includes('40P01');
        if (isDeadlock && attempt < MAX_RETRIES) {
          const delay = 50 * Math.pow(2, attempt - 1);
          this.logger.warn(`Deadlock detected (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms`, {
            states: states.length,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        this.logger.error('Batch transaction failed', {
          error: String(err),
          events: eventLogs.length,
          states: states.length,
          attempt,
          isDeadlock,
        });
        return { errors: eventLogs.length };
      }
    }

    return { errors: 0 };
  }
}
