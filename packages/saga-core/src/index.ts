// Classes
export { SagaRunner } from "./runner/saga-runner";
export { SagaPublisher } from "./publisher/saga-publisher";
export type { SagaStartOptions } from "./publisher/saga-publisher";
export { SagaParser } from "./parser/saga-parser";
export { SagaRegistry } from "./registry/saga-registry";
export { SagaContext } from "./context/saga-context";
export type { SagaContextData } from "./context/saga-context";

// Errors
export { SagaError } from "./errors/saga.error";
export { SagaRetryableError } from "./errors/saga-retryable.error";
export { SagaDuplicateHandlerError } from "./errors/saga-duplicate-handler.error";
export { SagaParseError } from "./errors/saga-parse.error";
export { SagaTransportNotConnectedError } from "./errors/saga-transport-not-connected.error";
export { SagaContextNotFoundError } from "./errors/saga-context-not-found.error";
export { SagaNoParentError } from "./errors/saga-no-parent.error";
export { SagaInvalidHandlerConfigError } from "./errors/saga-invalid-handler-config.error";

// Logger
export type { SagaLogger } from "./logger/saga-logger";
export { ConsoleSagaLogger } from "./logger/saga-logger";

// OTel
export type { OtelContext } from "./otel/otel-context";
export {
  NoopOtelContext,
  W3cOtelContext,
  createOtelContext,
} from "./otel/otel-context";

// Transport interfaces
export type {
  SagaTransport,
  OutboundMessage,
  InboundMessage,
  TransportSubscribeOptions,
  TransportHealthResult,
  HealthCheckable,
} from "./transport/transport.interface";
export { isHealthCheckable } from "./transport/transport.interface";

// Domain interfaces
export type { SagaEvent } from "./interfaces/saga-event.interface";
export type { IncomingEvent } from "./interfaces/incoming-event.interface";
export type { Emit, EmitParams, EventHint } from "./interfaces/emit.type";
export type { EventHandler } from "./interfaces/event-handler.type";
export type {
  SagaParticipant,
  HandlerConfig,
  ForkConfig,
} from "./interfaces/saga-participant.interface";
export type {
  PlainMessage,
  PlainHandler,
} from "./interfaces/plain-message.interface";
export type { ParentSagaContext } from "./interfaces/parent-saga-context.interface";
export type { RunnerOptions } from "./interfaces/runner-options.interface";
