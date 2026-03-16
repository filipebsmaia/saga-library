import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";

@Injectable()
@SagaParticipant()
export class PlanOrderingManagementParticipant extends SagaParticipantBase {
  readonly serviceId = "plan-ordering-management";
  private readonly logger = new Logger(PlanOrderingManagementParticipant.name);

  @SagaHandler("plan.order.requested")
  async handlePlanOrderRequested(
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
      `Bridging plan order for recurring ${recurringId} to ordering domain`,
    );

    await emit({
      eventType: "order.requested",
      stepName: "bridge-to-ordering",
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

  @SagaHandler("order.completed")
  async handleOrderCompleted(event: IncomingEvent, emit: Emit): Promise<void> {
    const { orderId, recurringId, planId, customerId, amount, cycle } =
      event.payload as {
        orderId: string;
        recurringId: string;
        planId: string;
        customerId: string;
        amount: number;
        cycle: number;
      };

    await randomDelay();

    this.logger.log(
      `Order ${orderId} completed — bridging back to plan domain`,
    );

    await emit({
      eventType: "plan.order.completed",
      stepName: "bridge-plan-order-completed",
      payload: { orderId, recurringId, planId, customerId, amount, cycle },
    });
  }

  @SagaHandler("order.failed")
  async handleOrderFailed(event: IncomingEvent, emit: Emit): Promise<void> {
    const { orderId, recurringId, reason } = event.payload as {
      orderId: string;
      recurringId: string;
      reason: string;
    };

    await randomDelay();

    this.logger.warn(
      `Order ${orderId} failed — bridging failure back to plan domain`,
    );

    await emit({
      eventType: "plan.order.failed",
      stepName: "bridge-plan-order-failed",
      payload: { orderId, recurringId, reason },
      hint: "compensation",
    });
  }
}
