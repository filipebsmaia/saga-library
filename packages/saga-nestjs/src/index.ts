// Module
export { SagaModule } from "./saga.module";

// Providers
export { SagaPublisherProvider } from "./providers/saga-publisher.provider";
export { SagaHealthIndicator } from "./providers/saga-health-indicator";

// Decorators
export { SagaParticipant } from "./decorators/saga-participant.decorator";
export type { SagaParticipantOptions } from "./decorators/saga-participant.decorator";
export { MessageHandler } from "./decorators/message-handler.decorator";

// Base class
export { SagaParticipantBase } from "./saga-participant-base";

// Constants (tokens for advanced usage)
export { SAGA_OPTIONS_TOKEN, SAGA_TRANSPORT_TOKEN } from "./constants";

// Options
export type {
  SagaModuleOptions,
  SagaModuleAsyncOptions,
  SagaRunnerFactory,
} from "./saga-module-options.interface";

// Re-exports from core for consumer convenience
export {
  SagaError,
  SagaRetryableError,
  SagaDuplicateHandlerError,
  SagaParseError,
  SagaTransportNotConnectedError,
} from "@fbsm/saga-core";
export type {
  SagaEvent,
  IncomingEvent,
  Emit,
  EmitParams,
  EventHint,
  EventHandler,
  ParentSagaContext,
  HandlerConfig,
  ForkConfig,
  PlainMessage,
  PlainHandler,
  SagaTransport,
  TransportHealthResult,
  HealthCheckable,
} from "@fbsm/saga-core";
export { isHealthCheckable } from "@fbsm/saga-core";
