import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SagaModule } from "@fbsm/saga-nestjs";
import { KafkaTransport } from "@fbsm/saga-transport-kafka";
import { PingPongModule } from "./ping-pong/ping-pong.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    SagaModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        groupId: config.get<string>("SAGA_GROUP_ID", "async-example-group"),
        transport: new KafkaTransport({
          brokers: config
            .get<string>("KAFKA_BROKERS", "localhost:9092")
            .split(","),
          clientId: config.get<string>("KAFKA_CLIENT_ID", "async-example"),
          autoCreateTopics: true,
        }),
        retryPolicy: {
          maxRetries: 2,
          initialDelayMs: 300,
        },
      }),
    }),

    PingPongModule,
  ],
})
export class AppModule {}
