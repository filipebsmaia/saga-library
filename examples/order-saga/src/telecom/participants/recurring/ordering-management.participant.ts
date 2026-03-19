import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../delay";
import { OrderStore } from "../../stores/order.store";

@Injectable()
@SagaParticipant("order.requested")
export class OrderRequestedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(OrderRequestedParticipant.name);

  constructor(private readonly orderStore: OrderStore) {
    super();
  }

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

    const orderId = uuidv7();
    this.orderStore.create(orderId, event.sagaId, {
      recurringId,
      customerId,
      amount,
    });

    this.logger.log(`Order ${orderId} created for recurring ${recurringId}`);

    await emit({
      topic: "order.created",
      stepName: "create-order",
      payload: {
        orderId,
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

@Injectable()
@SagaParticipant("payment.approved")
export class PaymentApprovedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(PaymentApprovedParticipant.name);

  constructor(private readonly orderStore: OrderStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const {
      orderId,
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      transactionId,
    } = event.payload as {
      orderId: string;
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      transactionId: string;
    };

    await randomDelay();

    this.logger.log(
      `Payment approved for order ${orderId} (txn: ${transactionId})`,
    );
    this.orderStore.updateStatus(orderId, "COMPLETED");

    await emit({
      topic: "order.completed",
      stepName: "complete-order",
      payload: {
        orderId,
        recurringId,
        planId,
        customerId,
        amount,
        cycle,
        transactionId,
      },
    });
  }
}

@Injectable()
@SagaParticipant("payment.rejected")
export class PaymentRejectedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(PaymentRejectedParticipant.name);

  constructor(private readonly orderStore: OrderStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { orderId, recurringId, reason } = event.payload as {
      orderId: string;
      recurringId: string;
      reason: string;
    };

    await randomDelay();

    this.logger.warn(`Payment rejected for order ${orderId}: ${reason}`);
    this.orderStore.updateStatus(orderId, "FAILED");

    await emit({
      topic: "order.failed",
      stepName: "fail-order",
      payload: { orderId, recurringId, reason },
      hint: "compensation",
    });
  }
}
