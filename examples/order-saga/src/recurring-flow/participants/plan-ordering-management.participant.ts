import { Injectable, Logger } from "@nestjs/common";
import { SagaParticipant, SagaParticipantBase } from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../telecom/delay";
import { RFPlanOrderStore } from "../stores/plan-order.store";

@Injectable()
@SagaParticipant("rf.plan.order.requested")
export class RFPlanOrderingRequestedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(
    RFPlanOrderingRequestedParticipant.name,
  );

  constructor(private readonly planOrderStore: RFPlanOrderStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const {
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      orderType,
      simulatePaymentFailure,
    } = event.payload as {
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      orderType: "RECURRING" | "CHANGE";
      simulatePaymentFailure?: boolean;
    };

    await randomDelay();

    const planOrderId = uuidv7();
    this.planOrderStore.create(planOrderId, event.sagaId, {
      recurringId,
      planId,
      customerId,
      amount,
      orderType,
    });

    this.logger.log(
      `PlanOrder ${planOrderId} created for recurring ${recurringId}`,
    );

    await emit({
      topic: "rf.plan-ordering.order.created",
      stepName: "create-plan-order",
      stepDescription: "plan-ordering-management cria ordem de plano",
      payload: {
        planOrderId,
        recurringId,
        planId,
        customerId,
        amount,
        cycle,
        simulatePaymentFailure,
      },
    });
  }
}

@Injectable()
@SagaParticipant("rf.ordering.order.updated.completed")
export class RFPlanOrderingCompletedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(
    RFPlanOrderingCompletedParticipant.name,
  );

  constructor(private readonly planOrderStore: RFPlanOrderStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { planOrderId, recurringId, planId, customerId, amount, cycle } =
      event.payload as {
        planOrderId: string;
        recurringId: string;
        planId: string;
        customerId: string;
        amount: number;
        cycle: number;
      };

    await randomDelay();

    this.planOrderStore.updateStatus(planOrderId, "COMPLETED");
    this.logger.log(`PlanOrder ${planOrderId} COMPLETED`);

    await emit({
      topic: "rf.plan-ordering.order.updated.completed",
      stepName: "complete-plan-order",
      stepDescription: "plan-ordering-management atualiza ordem como COMPLETED",
      payload: { planOrderId, recurringId, planId, customerId, amount, cycle },
    });
  }
}

@Injectable()
@SagaParticipant("rf.ordering.order.updated.payment-failed")
export class RFPlanOrderingPaymentFailedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(
    RFPlanOrderingPaymentFailedParticipant.name,
  );

  constructor(private readonly planOrderStore: RFPlanOrderStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { planOrderId, recurringId, planId, customerId, reason } =
      event.payload as {
        planOrderId: string;
        recurringId: string;
        planId: string;
        customerId: string;
        reason: string;
      };

    await randomDelay();

    this.planOrderStore.updateStatus(planOrderId, "PAYMENT_FAILED");
    this.logger.warn(`PlanOrder ${planOrderId} PAYMENT_FAILED: ${reason}`);

    await emit({
      topic: "rf.plan-ordering.order.updated.payment-failed",
      stepName: "fail-plan-order",
      stepDescription:
        "plan-ordering-management atualiza ordem como PAYMENT_FAILED",
      payload: { planOrderId, recurringId, planId, customerId, reason },
      hint: "compensation",
    });
  }
}
