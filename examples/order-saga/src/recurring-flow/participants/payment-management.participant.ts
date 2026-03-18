import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../telecom/delay";
import { RFPaymentStore } from "../stores/payment.store";

@Injectable()
@SagaParticipant()
export class RFPaymentManagementParticipant extends SagaParticipantBase {
  readonly serviceId = "rf-payment-management";
  private readonly logger = new Logger(RFPaymentManagementParticipant.name);

  constructor(private readonly paymentStore: RFPaymentStore) {
    super();
  }

  @SagaHandler("rf.ordering.order.created")
  async handleOrderCreated(event: IncomingEvent, emit: Emit): Promise<void> {
    const {
      orderId,
      planOrderId,
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      simulatePaymentFailure,
    } = event.payload as {
      orderId: string;
      planOrderId: string;
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      simulatePaymentFailure?: boolean;
    };

    await randomDelay();

    const paymentId = uuidv7();

    if (simulatePaymentFailure) {
      this.paymentStore.create(paymentId, event.sagaId, {
        orderId,
        customerId,
        amount,
        status: "FAILED",
      });

      this.logger.warn(`Payment ${paymentId} FAILED for order ${orderId}`);

      await emit({
        topic: "rf.payment.created.failed",
        stepName: "process-payment",
        stepDescription: "payment-management — pagamento recusado",
        payload: {
          paymentId,
          orderId,
          planOrderId,
          recurringId,
          planId,
          customerId,
          reason: "Insufficient funds",
        },
        hint: "compensation",
      });
      return;
    }

    this.paymentStore.create(paymentId, event.sagaId, {
      orderId,
      customerId,
      amount,
      status: "SUCCESS",
    });

    this.logger.log(
      `Payment ${paymentId} SUCCESS for order ${orderId} (R$${amount})`,
    );

    await emit({
      topic: "rf.payment.created.success",
      stepName: "process-payment",
      stepDescription: "payment-management — pagamento aprovado",
      payload: {
        paymentId,
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
}
