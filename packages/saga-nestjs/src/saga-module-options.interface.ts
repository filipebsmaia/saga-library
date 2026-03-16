import type { SagaTransport, RunnerOptions, SagaLogger } from "@fbsm/saga-core";

export interface SagaModuleOptions extends RunnerOptions {
  transport: SagaTransport;
  otel?: {
    enabled: boolean;
    exporterUrl?: string;
  };
  logger?: SagaLogger;
}

export interface SagaModuleAsyncOptions {
  useFactory: (
    ...args: any[]
  ) => Promise<SagaModuleOptions> | SagaModuleOptions;
  inject?: any[];
  imports?: any[];
}
