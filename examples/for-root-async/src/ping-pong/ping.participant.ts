import { Logger } from "@nestjs/common";
import { SagaParticipant, SagaParticipantBase } from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-nestjs";
import { PingCounterService } from "./ping-counter.service";

@SagaParticipant("ping.requested")
export class PingParticipant extends SagaParticipantBase {
  private readonly logger = new Logger(PingParticipant.name);

  constructor(private readonly pingCounter: PingCounterService) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { message } = event.payload as { message: string };
    const totalPings = this.pingCounter.increment();
    this.logger.log(
      `Received ping #${totalPings}: "${message}" (sagaId: ${event.sagaId})`,
    );

    await emit({
      topic: "pong.completed",
      stepName: "ping-to-pong",
      payload: { message, pongedAt: new Date().toISOString() },
    });
  }
}
