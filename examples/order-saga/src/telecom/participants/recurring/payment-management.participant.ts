import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
  SagaRetryableError,
} from '@fbsm/saga-nestjs';
import type { IncomingEvent, Emit } from '@fbsm/saga-nestjs';
import { randomDelay } from '../../delay';

@Injectable()
@SagaParticipant()
export class PaymentManagementParticipant extends SagaParticipantBase {
  readonly serviceId = 'payment-management';
  private readonly logger = new Logger(PaymentManagementParticipant.name);

  @SagaHandler('order.created')
  async handleOrderCreated(event: IncomingEvent, emit: Emit): Promise<void> {
    const {
      orderId,
      recurringId,
      planId,
      customerId,
      amount,
      cycle,
      simulatePaymentFailure,
      simulateTransient,
    } = event.payload as {
      orderId: string;
      recurringId: string;
      planId: string;
      customerId: string;
      amount: number;
      cycle: number;
      simulatePaymentFailure?: boolean;
      simulateTransient?: boolean;
    };

    await randomDelay();

    this.logger.log(`Processing payment for order ${orderId} (amount: R$${amount})`);

    if (simulateTransient) {
      this.logger.warn('Simulating transient payment gateway timeout');
      throw new SagaRetryableError('Payment gateway timeout', 2);
    }

    if (simulatePaymentFailure) {
      this.logger.warn(`Simulating payment rejection for order ${orderId}`);
      await emit({
        eventType: 'payment.rejected',
        stepName: 'process-payment',
        payload: { orderId, recurringId, reason: 'Insufficient funds' },
        hint: 'compensation',
      });
      return;
    }

    const transactionId = `txn-${Date.now()}`;
    this.logger.log(`Payment approved for order ${orderId} (txn: ${transactionId})`);

    await emit({
      eventType: 'payment.approved',
      stepName: 'process-payment',
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

  override async onRetryExhausted(
    event: IncomingEvent,
    error: SagaRetryableError,
    emit: Emit,
  ): Promise<void> {
    const { orderId, recurringId } = event.payload as {
      orderId: string;
      recurringId: string;
    };
    this.logger.error(`Retries exhausted for order ${orderId}: ${error.message}`);
    await emit({
      eventType: 'payment.rejected',
      stepName: 'process-payment',
      payload: { orderId, recurringId, reason: `Retries exhausted: ${error.message}` },
      hint: 'compensation',
    });
  }
}
