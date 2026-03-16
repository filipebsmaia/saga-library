import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './infra/logger/logger.module';
import { MetricsModule } from './infra/metrics/metrics.module';
import { SagaModule } from './infra/saga/saga.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), LoggerModule, MetricsModule, SagaModule],
})
export class AppModule {}
