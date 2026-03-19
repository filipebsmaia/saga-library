import { Injectable, Logger } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { randomDelay } from "../../delay";

@Injectable()
@SagaParticipant("line-activation.requested", { final: true })
export class LineActivationParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(LineActivationParticipant.name);

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { bulkId, lineIndex, lineNumber } = event.payload as {
      bulkId: string;
      lineIndex: number;
      lineNumber: string;
    };

    await randomDelay();

    this.logger.log(
      `Line ${lineIndex} (${lineNumber}) activated for bulk ${bulkId}`,
    );

    await emit({
      topic: "line-activation.completed",
      stepName: "complete-line-activation",
      payload: {
        bulkId,
        lineIndex,
        lineNumber,
        activatedAt: new Date().toISOString(),
      },
    });
  }
}
