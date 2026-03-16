import type { IncomingEvent } from "./incoming-event.interface";
import type { Emit } from "./emit.type";
import type { EventHandler } from "./event-handler.type";
import type { SagaRetryableError } from "../errors/saga-retryable.error";

export interface ForkConfig {
  sagaName?: string;
  sagaDescription?: string;
}

export interface HandlerConfig {
  final?: boolean;
  fork?: boolean | ForkConfig;
}

export interface SagaParticipant {
  readonly serviceId: string;
  readonly on: Record<string, EventHandler<any>>;
  readonly handlerOptions?: Record<string, HandlerConfig>;
  onRetryExhausted?(
    event: IncomingEvent,
    error: SagaRetryableError,
    emit: Emit,
  ): Promise<void>;
}
