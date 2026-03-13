import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import type { Counter, Histogram, Meter } from '@opentelemetry/api';
import { Metrics } from '@core/common/application/metrics';

@Injectable()
export class OtelMetricsAdapter extends Metrics implements OnModuleDestroy {
  private readonly meterProvider: MeterProvider;
  private readonly meter: Meter;
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  constructor(config: ConfigService) {
    super();
    const intervalMs = config.get<number>('METRICS_EXPORT_INTERVAL_MS', 10_000);
    const endpoint = config.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4317');

    this.meterProvider = new MeterProvider({
      readers: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: endpoint }),
          exportIntervalMillis: intervalMs,
        }),
      ],
    });

    this.meter = this.meterProvider.getMeter('saga-monitor');
  }

  counter(name: string, value = 1, attributes?: Record<string, string | number>): void {
    let c = this.counters.get(name);
    if (!c) {
      c = this.meter.createCounter(name);
      this.counters.set(name, c);
    }
    c.add(value, attributes);
  }

  histogram(name: string, value: number, attributes?: Record<string, string | number>): void {
    let h = this.histograms.get(name);
    if (!h) {
      h = this.meter.createHistogram(name);
      this.histograms.set(name, h);
    }
    h.record(value, attributes);
  }

  async onModuleDestroy() {
    await this.meterProvider.shutdown();
  }
}
