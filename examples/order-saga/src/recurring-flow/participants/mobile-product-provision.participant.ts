import { Injectable, Logger } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from '@saga/nestjs';
import type { IncomingEvent, Emit } from '@saga/nestjs';
import { v7 as uuidv7 } from 'uuid';
import { randomDelay } from '../../telecom/delay';
import { RFProvisionStore } from '../stores/provision.store';

@Injectable()
@SagaParticipant()
export class RFMobileProductProvisionParticipant extends SagaParticipantBase {
  readonly serviceId = 'rf-mobile-product-provision';
  private readonly logger = new Logger(RFMobileProductProvisionParticipant.name);

  constructor(private readonly provisionStore: RFProvisionStore) {
    super();
  }

  @SagaHandler('rf.product.updated.pending')
  async handleProductPending(event: IncomingEvent, emit: Emit): Promise<void> {
    const { productId, msisdn, planId } = event.payload as {
      productId: string;
      msisdn: string;
      planId: string;
    };

    await randomDelay();

    const provisionId = uuidv7();
    const packageId = `PKG-${planId}`;

    this.provisionStore.create(provisionId, event.sagaId, {
      productId,
      msisdn,
      packageId,
    });

    // Simulate ZTE HTTP call (zte-core-management)
    this.logger.log(
      `Provisioning product ${productId} on ZTE core (msisdn: ${msisdn}, package: ${packageId})`,
    );
    await randomDelay();

    this.provisionStore.updateStatus(provisionId, 'COMPLETED');
    this.logger.log(`Provision ${provisionId} COMPLETED`);

    await emit({
      eventType: 'rf.provision.completed',
      stepName: 'provision-product',
      stepDescription: 'mobile-product-provision provisiona no ZTE core (SPR/USPP)',
      payload: { provisionId, productId, msisdn, packageId },
    });
  }
}
