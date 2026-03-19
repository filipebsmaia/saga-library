import { Injectable, Logger } from "@nestjs/common";
import { SagaParticipant, SagaParticipantBase } from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { v7 as uuidv7 } from "uuid";
import { randomDelay } from "../../telecom/delay";
import { RFProductStore } from "../stores/product.store";

@Injectable()
@SagaParticipant("rf.recurring.created")
export class RFMobileProductRecurringCreatedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(
    RFMobileProductRecurringCreatedParticipant.name,
  );

  constructor(private readonly productStore: RFProductStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
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
}

@Injectable()
@SagaParticipant("rf.provision.completed", { final: true })
export class RFMobileProductProvisionCompletedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(
    RFMobileProductProvisionCompletedParticipant.name,
  );

  constructor(private readonly productStore: RFProductStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
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
