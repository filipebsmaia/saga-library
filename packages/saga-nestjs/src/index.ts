// Module
export { SagaModule } from "./saga.module";

// Providers
export { SagaPublisherProvider } from "./providers/saga-publisher.provider";
export { SagaHealthIndicator } from "./providers/saga-health-indicator";

// Decorators
export { SagaHandler } from "./decorators/saga-handler.decorator";
export type { SagaHandlerOptions } from "./decorators/saga-handler.decorator";
export { SagaParticipant } from "./decorators/saga-participant.decorator";

// Base class
export { SagaParticipantBase } from "./saga-participant-base";

// Constants (tokens for advanced usage)
export { SAGA_OPTIONS_TOKEN, SAGA_TRANSPORT_TOKEN } from "./constants";

// Options
export type {
  SagaModuleOptions,
  SagaModuleAsyncOptions,
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
  SagaTransport,
  TransportHealthResult,
  HealthCheckable,
} from "@fbsm/saga-core";
export { isHealthCheckable } from "@fbsm/saga-core";
