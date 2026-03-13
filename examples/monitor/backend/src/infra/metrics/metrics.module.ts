import { Module } from '@nestjs/common';
import { Metrics } from '@core/common/application/metrics';
import { OtelMetricsAdapter } from './otel-metrics.adapter';

@Module({
  providers: [
    {
      provide: Metrics,
      useClass: OtelMetricsAdapter,
    },
  ],
  exports: [Metrics],
})
export class MetricsModule {}
