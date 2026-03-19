import { Module, DynamicModule, type Provider } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import {
  SagaRunner,
  SagaRegistry,
  SagaPublisher,
  SagaParser,
  createOtelContext,
  type OtelContext,
} from "@fbsm/saga-core";
import {
  SAGA_OPTIONS_TOKEN,
  SAGA_TRANSPORT_TOKEN,
  SAGA_OTEL_CONTEXT_TOKEN,
} from "./constants";
import type {
  SagaModuleOptions,
  SagaModuleAsyncOptions,
} from "./saga-module-options.interface";
import { SagaRunnerProvider } from "./providers/saga-runner.provider";
import { SagaPublisherProvider } from "./providers/saga-publisher.provider";
import { SagaHealthIndicator } from "./providers/saga-health-indicator";

@Module({})
export class SagaModule {
  static forRoot(options: SagaModuleOptions): DynamicModule {
    const otelCtx = createOtelContext(options.otel?.enabled ?? false);
    const registry = new SagaRegistry();
    const parser = new SagaParser(otelCtx);
    const publisher = new SagaPublisher(
      options.transport,
      otelCtx,
      options.topicPrefix,
    );
    const runner = options.runnerFactory
      ? options.runnerFactory(
          registry,
          options.transport,
          publisher,
          parser,
          options,
          otelCtx,
          options.logger,
        )
      : new SagaRunner(
          registry,
          options.transport,
          publisher,
          parser,
          options,
          otelCtx,
          options.logger,
        );

    return {
      module: SagaModule,
      imports: [DiscoveryModule],
      global: true,
      providers: [
        { provide: SAGA_OPTIONS_TOKEN, useValue: options },
        { provide: SAGA_TRANSPORT_TOKEN, useValue: options.transport },
        { provide: SagaRegistry, useValue: registry },
        { provide: SagaParser, useValue: parser },
        { provide: SagaPublisher, useValue: publisher },
        { provide: SagaRunner, useValue: runner },
        SagaRunnerProvider,
        SagaPublisherProvider,
        SagaHealthIndicator,
      ],
      exports: [
        SagaPublisherProvider,
        SagaPublisher,
        SagaHealthIndicator,
        SAGA_OPTIONS_TOKEN,
      ],
    };
  }

  static forRootAsync(options: SagaModuleAsyncOptions): DynamicModule {
    const asyncProviders: Provider[] = [
      {
        provide: SAGA_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
      {
        provide: SAGA_TRANSPORT_TOKEN,
        useFactory: (opts: SagaModuleOptions) => opts.transport,
        inject: [SAGA_OPTIONS_TOKEN],
      },
      {
        provide: SAGA_OTEL_CONTEXT_TOKEN,
        useFactory: (opts: SagaModuleOptions) =>
          createOtelContext(opts.otel?.enabled ?? false),
        inject: [SAGA_OPTIONS_TOKEN],
      },
      {
        provide: SagaRegistry,
        useFactory: () => new SagaRegistry(),
      },
      {
        provide: SagaParser,
        useFactory: (otelCtx: OtelContext) => new SagaParser(otelCtx),
        inject: [SAGA_OTEL_CONTEXT_TOKEN],
      },
      {
        provide: SagaPublisher,
        useFactory: (opts: SagaModuleOptions, otelCtx: OtelContext) =>
          new SagaPublisher(opts.transport, otelCtx, opts.topicPrefix),
        inject: [SAGA_OPTIONS_TOKEN, SAGA_OTEL_CONTEXT_TOKEN],
      },
      {
        provide: SagaRunner,
        useFactory: (
          registry: SagaRegistry,
          publisher: SagaPublisher,
          parser: SagaParser,
          opts: SagaModuleOptions,
          otelCtx: OtelContext,
        ) => {
          if (opts.runnerFactory) {
            return opts.runnerFactory(
              registry,
              opts.transport,
              publisher,
              parser,
              opts,
              otelCtx,
              opts.logger,
            );
          }
          return new SagaRunner(
            registry,
            opts.transport,
            publisher,
            parser,
            opts,
            otelCtx,
            opts.logger,
          );
        },
        inject: [
          SagaRegistry,
          SagaPublisher,
          SagaParser,
          SAGA_OPTIONS_TOKEN,
          SAGA_OTEL_CONTEXT_TOKEN,
        ],
      },
    ];

    return {
      module: SagaModule,
      imports: [...(options.imports ?? []), DiscoveryModule],
      global: true,
      providers: [
        ...asyncProviders,
        SagaRunnerProvider,
        SagaPublisherProvider,
        SagaHealthIndicator,
      ],
      exports: [
        SagaPublisherProvider,
        SagaPublisher,
        SagaHealthIndicator,
        SAGA_OPTIONS_TOKEN,
      ],
    };
  }
}
