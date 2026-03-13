import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from '@saga/nestjs';
import type { IncomingEvent, Emit } from '@saga/nestjs';
import { randomDelay } from '../../delay';

@Injectable()
@SagaParticipant()
export class PlanManagementParticipant extends SagaParticipantBase {
  readonly serviceId = 'plan-management';
  private readonly logger = new Logger(PlanManagementParticipant.name);

  @SagaHandler('recurring.triggered')
  async handleRecurringTriggered(event: IncomingEvent, emit: Emit): Promise<void> {
    const { recurringId, planId, customerId, amount, cycle, simulatePaymentFailure, simulateTransient } =
      event.payload as {
        recurringId: string;
        planId: string;
        customerId: string;
        amount: number;
        cycle: number;
        simulatePaymentFailure?: boolean;
        simulateTransient?: boolean;
      };

    await randomDelay();

    this.logger.log(
      `Processing recurring ${recurringId} for plan ${planId} (customer: ${customerId})`,
    );

    await emit({
      eventType: 'plan.order.requested',
      stepName: 'request-plan-order',
      payload: {
        recurringId,
        planId,
        customerId,
        amount,
        cycle,
        simulatePaymentFailure,
        simulateTransient,
      },
    });
  }
}
