import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";

@Injectable()
@SagaParticipant("recurring.triggered")
export class PlanManagementParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(PlanManagementParticipant.name);

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const {
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      simulatePaymentFailure,
      simulateTransient,
    } = event.payload as {
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
      topic: "plan.order.requested",
      stepName: "request-plan-order",
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
