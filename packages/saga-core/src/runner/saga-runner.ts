import type {
  SagaTransport,
  InboundMessage,
  TransportHealthResult,
} from "../transport/transport.interface";
import { isHealthCheckable } from "../transport/transport.interface";
import type { IncomingEvent } from "../interfaces/incoming-event.interface";
import type { Emit } from "../interfaces/emit.type";
import type { EventHandler } from "../interfaces/event-handler.type";
import type { SagaParticipant } from "../interfaces/saga-participant.interface";
import type { RunnerOptions } from "../interfaces/runner-options.interface";
import { SagaRetryableError } from "../errors/saga-retryable.error";
import { SagaRegistry, type RouteEntry } from "../registry/saga-registry";
import { SagaPublisher } from "../publisher/saga-publisher";
import { SagaParser } from "../parser/saga-parser";
import type { OtelContext } from "../otel/otel-context";
import type { SagaLogger } from "../logger/saga-logger";
import { ConsoleSagaLogger } from "../logger/saga-logger";
import { SagaContext } from "../context/saga-context";
import { v7 as uuidv7 } from "uuid";

export class SagaRunner {
  private routeMap!: Map<string, RouteEntry>;

  constructor(
    private registry: SagaRegistry,
    private transport: SagaTransport,
    private publisher: SagaPublisher,
    private parser: SagaParser,
    private options: RunnerOptions,
    private otelCtx?: OtelContext,
    private logger: SagaLogger = new ConsoleSagaLogger(),
  ) {}

  async start(): Promise<void> {
    this.routeMap = this.registry.buildRouteMap();

    const prefix = this.options.topicPrefix ?? "";
    const topics = Array.from(this.routeMap.keys()).map(
      (et) => `${prefix}${et}`,
    );

    await this.transport.connect();

    if (topics.length > 0) {
      this.logger.info(
        `[SagaRunner] Subscribing to ${topics.length} topic(s): [${topics.join(", ")}]`,
      );
      await this.transport.subscribe(
        topics,
        (message) => this.handleMessage(message),
        {
          fromBeginning: this.options.fromBeginning,
          groupId: this.options.groupId,
        },
      );
      this.logger.info("[SagaRunner] Consumer running");
    } else {
      this.logger.warn(
        "[SagaRunner] No handlers registered — nothing to subscribe",
      );
    }
  }

  async stop(): Promise<void> {
    await this.transport.disconnect();
  }

  async healthCheck(): Promise<TransportHealthResult> {
    if (isHealthCheckable(this.transport)) {
      return this.transport.healthCheck();
    }
    return {
      status: "up",
      details: { reason: "Transport does not support health checks" },
    };
  }

  private async handleMessage(message: InboundMessage): Promise<void> {
    const event = this.parser.parse<Record<string, unknown>>(message);
    if (!event) return;

    const route = this.routeMap.get(event.eventType);
    if (!route) return;

    const isFinalHandler = route.options?.final === true;

    const incoming: IncomingEvent = {
      sagaId: event.sagaId,
      eventId: event.eventId,
      causationId: event.causationId,
      eventType: event.eventType,
      stepName: event.stepName,
      stepDescription: event.stepDescription,
      occurredAt: event.occurredAt,
      parentSagaId: event.parentSagaId,
      rootSagaId: event.rootSagaId,
      payload: event.payload,
      key: event.key,
      sagaName: event.sagaName,
      sagaDescription: event.sagaDescription,
    };

    const emit = this.publisher.forSaga(
      event.sagaId,
      {
        parentSagaId: event.parentSagaId,
        rootSagaId: event.rootSagaId,
      },
      event.eventId,
      event.key,
    );

    // Wrap emit: if handler is final, auto-add hint
    const wrappedEmit: Emit = async (params) => {
      const finalParams = isFinalHandler
        ? { ...params, hint: "final" as const }
        : params;
      return emit(finalParams);
    };

    // Fork layer: if handler has fork config, wrap emit to auto-create sub-sagas
    const forkConfig = route.options?.fork;
    const finalEmit: Emit = forkConfig
      ? async (params) => {
          const subSagaId = uuidv7();

          const subEmit = this.publisher.forSaga(
            subSagaId,
            {
              parentSagaId: event.sagaId,
              rootSagaId: event.rootSagaId,
            },
            event.eventId,
            event.key,
          );

          const forkMeta = typeof forkConfig === "object" ? forkConfig : {};
          const forkCtx = {
            sagaId: subSagaId,
            rootSagaId: event.rootSagaId,
            parentSagaId: event.sagaId,
            causationId: event.eventId,
            key: event.key,
            sagaName: forkMeta.sagaName,
            sagaDescription: forkMeta.sagaDescription,
          };
          await SagaContext.run(forkCtx, () =>
            subEmit({ ...params, hint: "fork" }),
          );
        }
      : wrappedEmit;

    const spanAttrs: Record<string, string> = {
      "saga.id": event.sagaId,
      "saga.event.type": event.eventType,
      "saga.step.name": event.stepName,
      "saga.event.id": event.eventId,
      "saga.root.id": event.rootSagaId,
      "saga.handler.service": route.participant.serviceId,
    };
    if (event.sagaName) spanAttrs["saga.name"] = event.sagaName;
    if (event.sagaDescription)
      spanAttrs["saga.description"] = event.sagaDescription;
    if (event.stepDescription)
      spanAttrs["saga.step.description"] = event.stepDescription;
    if (event.parentSagaId) spanAttrs["saga.parent.id"] = event.parentSagaId;

    const sagaCtxData = {
      sagaId: event.sagaId,
      rootSagaId: event.rootSagaId,
      parentSagaId: event.parentSagaId,
      causationId: event.eventId,
      key: event.key,
      sagaName: event.sagaName,
      sagaDescription: event.sagaDescription,
    };

    const runHandler = () =>
      SagaContext.run(sagaCtxData, () =>
        this.runWithRetry(
          route.handler,
          route.participant,
          incoming,
          finalEmit,
        ),
      );

    if (this.otelCtx) {
      await this.otelCtx.withExtractedSpan(
        `saga.handle ${event.eventType}`,
        spanAttrs,
        message.headers,
        runHandler,
      );
    } else {
      await runHandler();
    }
  }

  private async runWithRetry(
    handler: EventHandler,
    participant: SagaParticipant,
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const maxRetries = this.options.retryPolicy?.maxRetries ?? 3;
    const initialDelayMs = this.options.retryPolicy?.initialDelayMs ?? 200;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await handler(event, emit);
        return;
      } catch (error) {
        if (error instanceof SagaRetryableError) {
          if (attempt < maxRetries) {
            const delay = initialDelayMs * Math.pow(2, attempt);
            await this.sleep(delay);
            continue;
          }
          if (participant.onRetryExhausted) {
            await participant.onRetryExhausted(event, error, emit);
          }
          return;
        }
        this.logger.error(
          `[SagaRunner] Non-retryable error in handler for ${event.eventType}:`,
          error,
        );
        return;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
