import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { SagaRunner, SagaRegistry } from "@fbsm/saga-core";
import type { EventHandler } from "@fbsm/saga-core";
import {
  SAGA_PARTICIPANT_METADATA,
  SAGA_HANDLER_METADATA,
  SAGA_HANDLER_OPTIONS_METADATA,
} from "../constants";
import type { SagaHandlerOptions } from "../decorators/saga-handler.decorator";
import type { HandlerConfig } from "@fbsm/saga-core";

@Injectable()
export class SagaRunnerProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("SagaRunner");

  constructor(
    @Inject(DiscoveryService)
    private readonly discoveryService: DiscoveryService,
    @Inject(SagaRegistry) private readonly registry: SagaRegistry,
    @Inject(SagaRunner) private readonly runner: SagaRunner,
  ) {}

  async onModuleInit(): Promise<void> {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const instance = wrapper.instance;
      if (!instance || !instance.constructor) {
        continue;
      }

      const isParticipant = Reflect.getMetadata(
        SAGA_PARTICIPANT_METADATA,
        instance.constructor,
      );

      if (!isParticipant) {
        continue;
      }

      const handlesMap: Map<string, string | symbol> | undefined =
        Reflect.getMetadata(SAGA_HANDLER_METADATA, instance.constructor);

      if (!handlesMap || handlesMap.size === 0) {
        continue;
      }

      const on: Record<string, EventHandler<any>> = {};

      for (const [eventType, methodName] of handlesMap.entries()) {
        const method = (instance as any)[methodName];
        if (typeof method === "function") {
          on[eventType] = method.bind(instance);
        }
      }

      // Populate the `on` property if instance extends SagaParticipantBase
      if ("on" in instance && typeof instance.on === "object") {
        Object.assign(instance.on, on);
      }

      // Extract handler options (final, fork, etc.) from decorator metadata
      const handlerOptionsMap: Map<string, SagaHandlerOptions> | undefined =
        Reflect.getMetadata(
          SAGA_HANDLER_OPTIONS_METADATA,
          instance.constructor,
        );

      const handlerOptions: Record<string, HandlerConfig> = {};
      if (handlerOptionsMap) {
        for (const [eventType, opts] of handlerOptionsMap.entries()) {
          handlerOptions[eventType] = { final: opts.final, fork: !!opts.fork };
        }
      }

      const serviceId = (instance as any).serviceId ?? "unknown";
      this.logger.log(
        `Registered participant "${serviceId}" handling: [${Object.keys(on).join(", ")}]`,
      );

      this.registry.register({
        serviceId,
        on,
        handlerOptions:
          Object.keys(handlerOptions).length > 0 ? handlerOptions : undefined,
        onRetryExhausted:
          typeof (instance as any).onRetryExhausted === "function"
            ? (instance as any).onRetryExhausted.bind(instance)
            : undefined,
      });
    }

    await this.runner.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.runner.stop();
  }
}
