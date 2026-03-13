import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from '@saga/nestjs';
import type { IncomingEvent, Emit } from '@saga/nestjs';
import { ProductStore } from '../../stores/product.store';
import { randomDelay } from '../../delay';

@Injectable()
@SagaParticipant()
export class MobileProductProvisionParticipant extends SagaParticipantBase {
  readonly serviceId = 'mobile-product-provision';
  private readonly logger = new Logger(MobileProductProvisionParticipant.name);

  constructor(private readonly productStore: ProductStore) {
    super();
  }

  @SagaHandler('product.activation.requested')
  async handleActivationRequested(event: IncomingEvent, emit: Emit): Promise<void> {
    const { productId, planId, customerId, msisdn } = event.payload as {
      productId: string;
      planId: string;
      customerId: string;
      msisdn: string;
    };

    await randomDelay();

    this.logger.log(
      `Provisioning product ${productId} with carrier (msisdn: ${msisdn}, plan: ${planId})`,
    );

    this.productStore.updateStatus(productId, 'PROVISIONED');

    const provisioningId = `prov-${Date.now()}`;

    await emit({
      eventType: 'product.provisioned',
      stepName: 'provision-product',
      payload: { productId, provisioningId, customerId, msisdn },
    });

    this.logger.log(`Product ${productId} provisioned with carrier (ref: ${provisioningId})`);
  }
}
