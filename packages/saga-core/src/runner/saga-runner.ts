import type {
  SagaTransport,
  InboundMessage,
  TransportHealthResult,
} from "../transport/transport.interface";
import { isHealthCheckable } from "../transport/transport.interface";
import type { IncomingEvent } from "../interfaces/incoming-event.interface";
import type { Emit } from "../interfaces/emit.type";
import type { EventHandler } from "../interfaces/event-handler.type";
import type { SagaEvent } from "../interfaces/saga-event.interface";
import type { SagaParticipant } from "../interfaces/saga-participant.interface";
import type { PlainMessage } from "../interfaces/plain-message.interface";
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
    const baseRouteMap = this.registry.buildRouteMap();
    const prefix = this.options.topicPrefix ?? "";

    this.routeMap = new Map();
    for (const [topic, entry] of baseRouteMap) {
      this.routeMap.set(`${prefix}${topic}`, entry);
    }

    const topics = Array.from(this.routeMap.keys());

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
    const route = this.routeMap.get(message.topic);
    if (!route) {
      return;
    }

    // Try to parse as saga event
    const event = this.parser.parse<Record<string, unknown>>(message);

    if (event && route.sagaHandler) {
      await this.handleSagaMessage(message, event, route);
      return;
    }

    if (!event && route.plainHandler) {
      await this.handlePlainMessage(message, route);
      return;
    }

    // No matching handler for this message type — skip
  }

  private async handleSagaMessage(
    message: InboundMessage,
    event: SagaEvent<Record<string, unknown>>,
    route: RouteEntry,
  ): Promise<void> {
    const isFinalHandler = route.sagaOptions?.final === true;

    const incoming: IncomingEvent = {
      sagaId: event.sagaId,
      eventId: event.eventId,
      causationId: event.causationId,
      topic: event.topic,
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
    const forkConfig = route.sagaOptions?.fork;
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
      "saga.topic": event.topic,
      "saga.step.name": event.stepName,
      "saga.event.id": event.eventId,
      "saga.root.id": event.rootSagaId,
      "saga.handler.service": route.sagaParticipant!.serviceId,
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
          route.sagaHandler!,
          route.sagaParticipant!,
          incoming,
          finalEmit,
        ),
      );

    if (this.otelCtx) {
      await this.otelCtx.withExtractedSpan(
        `saga.handle ${event.topic}`,
        spanAttrs,
        message.headers,
        runHandler,
      );
    } else {
      await runHandler();
    }
  }

  private async handlePlainMessage(
    message: InboundMessage,
    route: RouteEntry,
  ): Promise<void> {
    let payload: unknown;
    try {
      payload = JSON.parse(message.value);
    } catch {
      payload = message.value;
    }

    const plainMessage: PlainMessage = {
      topic: message.topic,
      key: message.key,
      payload,
      headers: message.headers,
    };

    await route.plainHandler!(plainMessage);
  }

  private async runWithRetry(
    handler: EventHandler,
    participant: SagaParticipant,
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    try {
      await this.executeWithRetry(handler, event, emit);
    } catch (error) {
      if (error instanceof SagaRetryableError) {
        // Retries exhausted
        await this.callOnRetryExhausted(participant, event, error, emit);
        return;
      }

      // Non-retryable error — route to onFail if defined
      if (participant.onFail) {
        try {
          await this.executeWithRetry(
            (ev, em) => participant.onFail!(ev, error as Error, em),
            event,
            emit,
          );
        } catch (failError) {
          if (failError instanceof SagaRetryableError) {
            await this.callOnRetryExhausted(
              participant,
              event,
              failError,
              emit,
            );
          } else {
            this.logger.error(
              `[SagaRunner] onFail threw non-retryable error for ${event.topic}:`,
              failError,
            );
          }
        }
        return;
      }

      this.logger.error(
        `[SagaRunner] Non-retryable error in handler for ${event.topic}:`,
        error,
      );
    }
  }

  private async executeWithRetry(
    fn: (event: IncomingEvent, emit: Emit) => Promise<void>,
    event: IncomingEvent,
    emit: Emit,
  ): Promise<void> {
    const maxRetries = this.options.retryPolicy?.maxRetries ?? 3;
    const initialDelayMs = this.options.retryPolicy?.initialDelayMs ?? 200;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await fn(event, emit);
        return;
      } catch (error) {
        if (error instanceof SagaRetryableError) {
          if (attempt < maxRetries) {
            const delay = initialDelayMs * Math.pow(2, attempt);
            await this.sleep(delay);
            continue;
          }
          // Exhausted — re-throw so caller can handle
          throw error;
        }
        // Non-retryable — re-throw immediately
        throw error;
      }
    }
  }

  private async callOnRetryExhausted(
    participant: SagaParticipant,
    event: IncomingEvent,
    error: SagaRetryableError,
    emit: Emit,
  ): Promise<void> {
    if (participant.onRetryExhausted) {
      await participant.onRetryExhausted(event, error, emit);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
