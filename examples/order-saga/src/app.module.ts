import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { SagaModule } from '@fbsm/saga-nestjs';
import { KafkaTransport } from '@fbsm/saga-transport-kafka';
import { TelecomModule } from './telecom/telecom.module';
import { RecurringFlowModule } from './recurring-flow/recurring-flow.module';
// import { MonitorModule } from './monitor/monitor.module';

const instanceId = process.env.HOSTNAME ?? randomUUID().slice(0, 8);

@Module({
  imports: [
    SagaModule.forRoot({
      serviceName: 'saga',
      transport: new KafkaTransport({
        brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
        clientId: `saga-${instanceId}`,
        autoCreateTopics: true,
      }),
      retryPolicy: {
        maxRetries: 3,
        initialDelayMs: 500,
      },
      otel: { enabled: true },
    }),
    TelecomModule,
    RecurringFlowModule,
    // MonitorModule,
  ],
})
export class AppModule {}
