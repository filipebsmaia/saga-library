import type {
  SagaTransport,
  RunnerOptions,
  SagaLogger,
  SagaRunner,
  SagaRegistry,
  SagaPublisher,
  SagaParser,
  OtelContext,
} from "@fbsm/saga-core";

export type SagaRunnerFactory = (
  registry: SagaRegistry,
  transport: SagaTransport,
  publisher: SagaPublisher,
  parser: SagaParser,
  options: RunnerOptions,
  otelCtx?: OtelContext,
  logger?: SagaLogger,
) => SagaRunner;

export interface SagaModuleOptions extends RunnerOptions {
  transport: SagaTransport;
  otel?: {
    enabled: boolean;
    exporterUrl?: string;
  };
  logger?: SagaLogger;
  runnerFactory?: SagaRunnerFactory;
}

export interface SagaModuleAsyncOptions {
  useFactory: (
    ...args: any[]
  ) => Promise<SagaModuleOptions> | SagaModuleOptions;
  inject?: any[];
  imports?: any[];
}
