import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../telecom/delay";
import { RFOrderStore } from "../stores/order.store";

@Injectable()
@SagaParticipant()
export class RFOrderingManagementParticipant extends SagaParticipantBase {
  readonly serviceId = "rf-ordering-management";
  private readonly logger = new Logger(RFOrderingManagementParticipant.name);

  constructor(private readonly orderStore: RFOrderStore) {
    super();
  }

  @SagaHandler("rf.plan-ordering.order.created")
  async handlePlanOrderCreated(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const {
      planOrderId,
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      simulatePaymentFailure,
    } = event.payload as {
      planOrderId: string;
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      simulatePaymentFailure?: boolean;
    };

    await randomDelay();

    const orderId = uuidv7();
    this.orderStore.create(orderId, event.sagaId, {
      planOrderId,
      customerId,
      amount,
    });

    this.logger.log(`Order ${orderId} created for planOrder ${planOrderId}`);

    await emit({
      eventType: "rf.ordering.order.created",
      stepName: "create-order",
      stepDescription: "ordering-management cria ordem genérica",
      payload: {
        orderId,
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

  @SagaHandler("rf.payment.created.success")
  async handlePaymentSuccess(event: IncomingEvent, emit: Emit): Promise<void> {
    const {
      orderId,
      planOrderId,
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      paymentId,
    } = event.payload as {
      orderId: string;
      planOrderId: string;
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      paymentId: string;
    };

    await randomDelay();

    this.orderStore.updateStatus(orderId, "COMPLETED");
    this.logger.log(`Order ${orderId} COMPLETED (payment: ${paymentId})`);

    await emit({
      eventType: "rf.ordering.order.updated.completed",
      stepName: "complete-order",
      stepDescription: "ordering-management atualiza ordem como COMPLETED",
      payload: {
        orderId,
        planOrderId,
        recurringId,
        planId,
        customerId,
        amount,
        cycle,
      },
    });
  }

  @SagaHandler("rf.payment.created.failed")
  async handlePaymentFailed(event: IncomingEvent, emit: Emit): Promise<void> {
    const { orderId, planOrderId, recurringId, planId, customerId, reason } =
      event.payload as {
        orderId: string;
        planOrderId: string;
        recurringId: string;
        planId: string;
        customerId: string;
        reason: string;
      };

    await randomDelay();

    this.orderStore.updateStatus(orderId, "PAYMENT_FAILED");
    this.logger.warn(`Order ${orderId} PAYMENT_FAILED: ${reason}`);

    await emit({
      eventType: "rf.ordering.order.updated.payment-failed",
      stepName: "fail-order-payment",
      stepDescription: "ordering-management atualiza ordem como PAYMENT_FAILED",
      payload: {
        orderId,
        planOrderId,
        recurringId,
        planId,
        customerId,
        reason,
      },
      hint: "compensation",
    });
  }
}
