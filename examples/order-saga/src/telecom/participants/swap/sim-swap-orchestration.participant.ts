import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaPublisherProvider,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";
import { SimSwapStore } from "../../stores/sim-swap.store";

@Injectable()
@SagaParticipant("sim-swap.requested", { fork: true })
export class SimSwapForkParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(SimSwapForkParticipant.name);

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { swapId, msisdn, newIccid } = event.payload as {
      swapId: string;
      msisdn: string;
      newIccid: string;
    };

    await randomDelay();

    this.logger.log(
      `SIM swap ${swapId} — forking portability validation sub-saga`,
    );

    await emit({
      topic: "portability.validation.requested",
      stepName: "request-portability-validation",
      payload: { swapId, msisdn, newIccid },
    });
  }
}

@Injectable()
@SagaParticipant("portability.validated")
export class PortabilityValidatedParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(PortabilityValidatedParticipant.name);

  constructor(
    private readonly simSwapStore: SimSwapStore,
    private readonly sagaPublisher: SagaPublisherProvider,
  ) {
    super();
  }

  async handle(event: IncomingEvent): Promise<void> {
    const { swapId, msisdn, newIccid, valid } = event.payload as {
      swapId: string;
      msisdn: string;
      newIccid: string;
      valid: boolean;
    };

    await randomDelay();

    if (valid) {
      this.simSwapStore.updateStatus(swapId, "COMPLETED");
      this.logger.log(`SIM swap ${swapId} completed — portability validated`);

      await this.sagaPublisher.emitToParent({
        topic: "sim-swap.completed",
        stepName: "complete-sim-swap",
        payload: {
          swapId,
          msisdn,
          newIccid,
          completedAt: new Date().toISOString(),
        },
        hint: "final",
      });
    }
  }
}
