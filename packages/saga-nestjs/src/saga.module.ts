import { Module, DynamicModule, type Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import {
  SagaRunner,
  SagaRegistry,
  SagaPublisher,
  SagaParser,
  createOtelContext,
} from '@saga/core';
import { SAGA_OPTIONS_TOKEN, SAGA_TRANSPORT_TOKEN } from './constants';
import type { SagaModuleOptions, SagaModuleAsyncOptions } from './saga-module-options.interface';
import { SagaRunnerProvider } from './providers/saga-runner.provider';
import { SagaPublisherProvider } from './providers/saga-publisher.provider';

@Module({})
export class SagaModule {
  static forRoot(options: SagaModuleOptions): DynamicModule {
    const otelCtx = createOtelContext(options.otel?.enabled ?? false);
    const registry = new SagaRegistry();
    const parser = new SagaParser(otelCtx);
    const publisher = new SagaPublisher(options.transport, otelCtx, options.topicPrefix);
    const runner = new SagaRunner(registry, options.transport, publisher, parser, options, otelCtx, options.logger);

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
      ],
      exports: [SagaPublisherProvider, SagaPublisher, SAGA_OPTIONS_TOKEN],
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
        provide: SagaRegistry,
        useFactory: () => new SagaRegistry(),
      },
      {
        provide: SagaParser,
        useFactory: (opts: SagaModuleOptions) => {
          const otelCtx = createOtelContext(opts.otel?.enabled ?? false);
          return new SagaParser(otelCtx);
        },
        inject: [SAGA_OPTIONS_TOKEN],
      },
      {
        provide: SagaPublisher,
        useFactory: (opts: SagaModuleOptions) => {
          const otelCtx = createOtelContext(opts.otel?.enabled ?? false);
          return new SagaPublisher(opts.transport, otelCtx, opts.topicPrefix);
        },
        inject: [SAGA_OPTIONS_TOKEN],
      },
      {
        provide: SagaRunner,
        useFactory: (
          registry: SagaRegistry,
          publisher: SagaPublisher,
          parser: SagaParser,
          opts: SagaModuleOptions,
        ) => {
          const otelCtx = createOtelContext(opts.otel?.enabled ?? false);
          return new SagaRunner(registry, opts.transport, publisher, parser, opts, otelCtx, opts.logger);
        },
        inject: [SagaRegistry, SagaPublisher, SagaParser, SAGA_OPTIONS_TOKEN],
      },
    ];

    return {
      module: SagaModule,
      imports: [...(options.imports ?? []), DiscoveryModule],
      global: true,
      providers: [...asyncProviders, SagaRunnerProvider, SagaPublisherProvider],
      exports: [SagaPublisherProvider, SagaPublisher, SAGA_OPTIONS_TOKEN],
    };
  }
}
