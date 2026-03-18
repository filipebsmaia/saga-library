import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../telecom/delay";
import { RFProductStore } from "../stores/product.store";

@Injectable()
@SagaParticipant()
export class RFMobileProductLifecycleParticipant extends SagaParticipantBase {
  readonly serviceId = "rf-mobile-product-lifecycle";
  private readonly logger = new Logger(
    RFMobileProductLifecycleParticipant.name,
  );

  constructor(private readonly productStore: RFProductStore) {
    super();
  }

  @SagaHandler("rf.recurring.created")
  async handleRecurringCreated(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const { recurringId, planId, customerId, msisdn } = event.payload as {
      recurringId: string;
      planId: string;
      customerId: string;
      msisdn: string;
    };

    await randomDelay();

    const productId = uuidv7();
    this.productStore.create(productId, event.sagaId, {
      customerId,
      planId,
      msisdn,
    });

    this.productStore.updateStatus(productId, "PENDING");

    this.logger.log(
      `Product ${productId} created (PENDING) for recurring ${recurringId}`,
    );

    await emit({
      topic: "rf.product.updated.pending",
      stepName: "create-mobile-product",
      stepDescription:
        "mobile-product-lifecycle cria produto móvel como PENDING",
      payload: { productId, customerId, planId, msisdn },
    });
  }

  @SagaHandler("rf.provision.completed")
  async handleProvisionCompleted(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const { productId, provisionId } = event.payload as {
      productId: string;
      provisionId: string;
    };

    await randomDelay();

    this.productStore.updateStatus(productId, "ACTIVE");
    this.logger.log(`Product ${productId} ACTIVE (provision: ${provisionId})`);

    await emit({
      topic: "rf.product.activated",
      stepName: "activate-mobile-product",
      stepDescription: "mobile-product-lifecycle ativa produto móvel",
      payload: { productId, provisionId },
      hint: "final",
    });
  }
}
