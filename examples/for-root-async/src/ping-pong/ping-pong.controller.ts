import { Controller, Get, Post, Logger } from "@nestjs/common";
import { SagaPublisherProvider } from "@fbsm/saga-nestjs";
import { PongStore } from "./pong.store";

@Controller()
export class PingPongController {
  private readonly logger = new Logger(PingPongController.name);

  constructor(
    private readonly sagaPublisher: SagaPublisherProvider,
    private readonly pongStore: PongStore,
  ) {}

  @Post("ping")
  async ping(): Promise<{ sagaId: string }> {
    const message = `hello-${Date.now()}`;
    this.logger.log(`Starting ping saga with message: "${message}"`);

    const { sagaId } = await this.sagaPublisher.start(async () => {
      await this.sagaPublisher.emit({
        topic: "ping.requested",
        stepName: "start-ping",
        payload: { message },
      });
    });

    return { sagaId };
  }

  @Get("pongs")
  getPongs() {
    return this.pongStore.getAll();
  }
}
