import { Logger } from "@nestjs/common";
import { SagaParticipant, SagaParticipantBase } from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { PongStore } from "./pong.store";

@SagaParticipant("pong.completed", { final: true })
export class PongParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(PongParticipant.name);

  constructor(private readonly pongStore: PongStore) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { message, pongedAt } = event.payload as {
      message: string;
      pongedAt: string;
    };

    this.pongStore.add(event.sagaId, message, pongedAt);
    this.logger.log(`Pong stored for saga ${event.sagaId}`);

    await emit({
      topic: "saga.done",
      stepName: "pong-final",
      payload: { sagaId: event.sagaId, message, pongedAt },
    });
  }
}
