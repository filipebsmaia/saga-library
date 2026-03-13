import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from '@saga/nestjs';
import type { IncomingEvent, Emit } from '@saga/nestjs';
import { v7 as uuidv7 } from 'uuid';
import { randomDelay } from '../../delay';
import { ProductStore } from '../../stores/product.store';

@Injectable()
@SagaParticipant()
export class MobileProductLifecycleParticipant extends SagaParticipantBase {
  readonly serviceId = 'mobile-product-lifecycle';
  private readonly logger = new Logger(MobileProductLifecycleParticipant.name);

  constructor(private readonly productStore: ProductStore) {
    super();
  }

  @SagaHandler('recurring.created')
  async handleRecurringCreated(event: IncomingEvent, emit: Emit): Promise<void> {
    const { recurringId, planId, customerId, msisdn } = event.payload as {
      recurringId: string;
      planId: string;
      customerId: string;
      msisdn: string;
    };

    await randomDelay();

    const productId = uuidv7();
    this.productStore.create(productId, event.sagaId, {
      recurringId,
      customerId,
      planId,
      msisdn,
    });

    this.logger.log(
      `Product ${productId} created as PENDING for customer ${customerId} (msisdn: ${msisdn})`,
    );

    await emit({
      eventType: 'product.activation.requested',
      stepName: 'create-pending-product',
      payload: { productId, recurringId, planId, customerId, msisdn },
    });
  }

  @SagaHandler('product.provisioned')
  async handleProductProvisioned(event: IncomingEvent, emit: Emit): Promise<void> {
    const { productId, provisioningId } = event.payload as {
      productId: string;
      provisioningId: string;
    };

    await randomDelay();

    this.logger.log(`Product ${productId} provisioned (ref: ${provisioningId}) — activating`);
    this.productStore.updateStatus(productId, 'ACTIVE');

    await emit({
      eventType: 'product.activated',
      stepName: 'activate-product',
      payload: { productId, provisioningId, activatedAt: new Date().toISOString() },
      hint: 'final',
    });

    this.logger.log(`Product ${productId} is now ACTIVE`);
  }
}
