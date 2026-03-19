import { Module } from "@nestjs/common";
import { PingPongController } from "./ping-pong.controller";
import { PingParticipant } from "./ping.participant";
import { PongParticipant } from "./pong.participant";
import { PingCounterService } from "./ping-counter.service";
import { PongStore } from "./pong.store";

@Module({
  controllers: [PingPongController],
  providers: [PingParticipant, PongParticipant, PingCounterService, PongStore],
})
export class PingPongModule {}
