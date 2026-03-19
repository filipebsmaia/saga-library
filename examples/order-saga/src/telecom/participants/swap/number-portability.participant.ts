import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";

@Injectable()
@SagaParticipant("portability.validation.requested", { final: true })
export class NumberPortabilityParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(NumberPortabilityParticipant.name);

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { swapId, msisdn, newIccid } = event.payload as {
      swapId: string;
      msisdn: string;
      newIccid: string;
    };

    await randomDelay();

    this.logger.log(
      `Validating portability for MSISDN ${msisdn} (swap: ${swapId})`,
    );

    await emit({
      topic: "portability.validated",
      stepName: "validate-portability",
      payload: {
        swapId,
        msisdn,
        newIccid,
        valid: true,
        validatedAt: new Date().toISOString(),
      },
    });

    this.logger.log(`Portability validated for MSISDN ${msisdn}`);
  }
}
