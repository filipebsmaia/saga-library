import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { SagaRunner, SagaRegistry } from "@fbsm/saga-core";
import type {
  EventHandler,
  HandlerConfig,
  PlainHandler,
} from "@fbsm/saga-core";
import {
  SAGA_PARTICIPANT_METADATA,
  SAGA_PARTICIPANT_TOPICS_METADATA,
  SAGA_PARTICIPANT_OPTIONS_METADATA,
  MESSAGE_HANDLER_METADATA,
} from "../constants";
import type { SagaParticipantOptions } from "../decorators/saga-participant.decorator";

@Injectable()
export class SagaRunnerProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("SagaRunner");

  constructor(
    @Inject(DiscoveryService)
    private readonly discoveryService: DiscoveryService,
    @Inject(SagaRegistry) private readonly registry: SagaRegistry,
    @Inject(SagaRunner) private readonly runner: SagaRunner,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef
  ) {}

  async onModuleInit(): Promise<void> {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const metatype = wrapper.metatype;
      if (!metatype || typeof metatype !== "function" || !metatype.prototype) {
        continue;
      }

      const isParticipant = Reflect.getMetadata(
        SAGA_PARTICIPANT_METADATA,
        metatype
      );

      if (!isParticipant) {
        continue;
      }

      // Force instantiation via ModuleRef with { strict: false } to resolve across all modules
      const instance = this.moduleRef.get(metatype, { strict: false });
      if (!instance) {
        this.logger.warn(
          `Could not resolve participant "${metatype.name}" — skipping`
        );
        continue;
      }

      // Derive serviceId from class name
      const serviceId = metatype.name;

      // Read saga topics from @SagaParticipant(topics) decorator
      const sagaTopics: string[] =
        Reflect.getMetadata(SAGA_PARTICIPANT_TOPICS_METADATA, metatype) ?? [];

      // Read options (final, fork) from @SagaParticipant(topics, options) decorator
      const participantOptions: SagaParticipantOptions | undefined =
        Reflect.getMetadata(SAGA_PARTICIPANT_OPTIONS_METADATA, metatype);

      // Bind handle() as the saga handler for all declared topics
      const on: Record<string, EventHandler<any>> = {};
      const handlerOptions: Record<string, HandlerConfig> = {};

      if (
        sagaTopics.length > 0 &&
        typeof (instance as any).handle === "function"
      ) {
        const boundHandle = (instance as any).handle.bind(instance);
        for (const topic of sagaTopics) {
          on[topic] = boundHandle;
          if (participantOptions?.final || participantOptions?.fork) {
            handlerOptions[topic] = {
              final: participantOptions.final,
              fork: participantOptions.fork,
            };
          }
        }
      }

      // Read @MessageHandler metadata for plain handlers
      const messageHandlerMap: Map<string, string | symbol> | undefined =
        Reflect.getMetadata(MESSAGE_HANDLER_METADATA, metatype);

      const onPlain: Record<string, PlainHandler> = {};
      if (messageHandlerMap) {
        for (const [topic, methodName] of messageHandlerMap.entries()) {
          const method = (instance as any)[methodName];
          if (typeof method === "function") {
            onPlain[topic] = method.bind(instance);
          }
        }
      }

      const sagaTopicsList = Object.keys(on);
      const plainTopicsList = Object.keys(onPlain);

      if (sagaTopicsList.length === 0 && plainTopicsList.length === 0) {
        continue;
      }

      const allTopics = [...sagaTopicsList, ...plainTopicsList];
      this.logger.log(
        `Registered participant "${serviceId}" handling: [${allTopics.join(
          ", "
        )}]`
      );

      this.registry.register({
        serviceId,
        on,
        handlerOptions:
          Object.keys(handlerOptions).length > 0 ? handlerOptions : undefined,
        onPlain: Object.keys(onPlain).length > 0 ? onPlain : undefined,
        onFail:
          typeof (instance as any).onFail === "function"
            ? (instance as any).onFail.bind(instance)
            : undefined,
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
