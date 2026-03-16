import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
  SagaPublisherProvider,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";
import { SimSwapStore } from "../../stores/sim-swap.store";

@Injectable()
@SagaParticipant()
export class SimSwapOrchestrationParticipant extends SagaParticipantBase {
  readonly serviceId = "sim-swap-orchestration";
  private readonly logger = new Logger(SimSwapOrchestrationParticipant.name);

  constructor(
    private readonly simSwapStore: SimSwapStore,
    private readonly sagaPublisher: SagaPublisherProvider,
  ) {
    super();
  }

  @SagaHandler("sim-swap.requested", { fork: true })
  async handleSimSwapRequested(
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
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
      eventType: "portability.validation.requested",
      stepName: "request-portability-validation",
      payload: { swapId, msisdn, newIccid },
    });
  }

  @SagaHandler("portability.validated")
  async handlePortabilityValidated(event: IncomingEvent): Promise<void> {
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
        eventType: "sim-swap.completed",
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
