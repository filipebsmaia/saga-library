import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../telecom/delay";
import { RFPlanStore } from "../stores/plan.store";

@Injectable()
@SagaParticipant()
export class RFPlanManagementParticipant extends SagaParticipantBase {
  readonly serviceId = "rf-plan-management";
  private readonly logger = new Logger(RFPlanManagementParticipant.name);

  constructor(private readonly planStore: RFPlanStore) {
    super();
  }

  @SagaHandler("rf.recurring.updated.processing")
  async handleRecurringProcessing(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const {
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      simulatePaymentFailure,
    } = event.payload as {
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      simulatePaymentFailure?: boolean;
    };

    await randomDelay();

    const plan = this.planStore.findOne(planId);
    const orderType = plan?.hasPendingChanges ? "CHANGE" : "RECURRING";

    this.logger.log(
      `Plan ${planId} — requesting ${orderType} order for recurring ${recurringId}`,
    );

    await emit({
      eventType: "rf.plan.order.requested",
      stepName: "request-plan-order",
      stepDescription: `plan-management solicita ordem ${orderType}`,
      payload: {
        recurringId,
        planId,
        customerId,
        amount,
        cycle,
        orderType,
        simulatePaymentFailure,
      },
    });
  }

  @SagaHandler("rf.recurring.updated.failed")
  async handleRecurringFailed(event: IncomingEvent, emit: Emit): Promise<void> {
    const { recurringId, planId } = event.payload as {
      recurringId: string;
      planId: string;
    };

    await randomDelay();

    this.logger.warn(
      `Recurring ${recurringId} FAILED (max attempts) — suspending plan ${planId}`,
    );
    this.planStore.updateStatus(planId, "SUSPENDED");

    await emit({
      eventType: "rf.plan.suspended",
      stepName: "suspend-plan",
      stepDescription: "plan-management suspende plano por inadimplência",
      payload: { planId, recurringId, reason: "PAYMENT_FAILURE" },
      hint: "final",
    });
  }
}
