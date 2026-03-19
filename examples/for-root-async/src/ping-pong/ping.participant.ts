import { Logger } from "@nestjs/common";
import { SagaParticipant, SagaParticipantBase } from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";

@SagaParticipant("ping.requested")
export class PingParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(PingParticipant.name);
  
  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { message } = event.payload as { message: string };
    this.logger.log(`Received ping: "${message}" (sagaId: ${event.sagaId})`);

    await emit({
      topic: "pong.completed",
      stepName: "ping-to-pong",
      payload: { message, pongedAt: new Date().toISOString() },
    });
  }
}
