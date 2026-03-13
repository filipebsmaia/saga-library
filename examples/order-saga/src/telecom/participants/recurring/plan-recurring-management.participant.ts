import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
  SagaPublisherProvider,
} from '@saga/nestjs';
import type { IncomingEvent, Emit } from '@saga/nestjs';
import { v7 as uuidv7 } from 'uuid';
import { randomDelay } from '../../delay';
import { RecurringStore } from '../../stores/recurring.store';

@Injectable()
@SagaParticipant()
export class PlanRecurringManagementParticipant extends SagaParticipantBase {
  readonly serviceId = 'plan-recurring-management';
  private readonly logger = new Logger(PlanRecurringManagementParticipant.name);

  constructor(
    private readonly recurringStore: RecurringStore,
    private readonly sagaPublisher: SagaPublisherProvider,
  ) {
    super();
  }

  @SagaHandler('plan.order.completed')
  async handlePlanOrderCompleted(event: IncomingEvent, emit: Emit): Promise<void> {
    const { recurringId, planId, customerId, amount, cycle } = event.payload as {
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
    };

    await randomDelay();

    this.logger.log(`Recurring ${recurringId} payment completed — marking COMPLETED`);
    this.recurringStore.updateStatus(recurringId, 'COMPLETED');

    // Final event on the CURRENT saga
    await emit({
      eventType: 'recurring.completed',
      stepName: 'complete-recurring',
      payload: { recurringId, planId, customerId, cycle },
      hint: 'final',
    });

    // Start a NEW child saga for the next recurring cycle
    const newCycle = cycle + 1;
    const newRecurringId = uuidv7();

    const { sagaId: newSagaId } = await this.sagaPublisher.startChild(async () => {
      await this.sagaPublisher.emit({
        eventType: 'recurring.created',
        stepName: 'create-recurring-cycle',
        payload: {
          recurringId: newRecurringId,
          planId,
          customerId,
          amount,
          cycle: newCycle,
          msisdn: `+5511${Date.now().toString().slice(-8)}`,
        },
        hint: 'fork',
      });
    });

    this.recurringStore.create(newRecurringId, newSagaId, {
      planId,
      customerId,
      amount,
      cycle: newCycle,
    });
    this.recurringStore.updateStatus(newRecurringId, 'COMPLETED');

    this.logger.log(`New saga ${newSagaId} started for recurring ${newRecurringId} (cycle ${newCycle})`);
  }

  @SagaHandler('plan.order.failed')
  async handlePlanOrderFailed(event: IncomingEvent, emit: Emit): Promise<void> {
    const { recurringId, reason } = event.payload as {
      recurringId: string;
      reason: string;
    };

    await randomDelay();

    this.logger.warn(`Recurring ${recurringId} failed: ${reason}`);
    this.recurringStore.updateStatus(recurringId, 'FAILED');

    await emit({
      eventType: 'recurring.failed',
      stepName: 'fail-recurring',
      payload: { recurringId, reason },
      hint: 'final',
    });
  }
}
