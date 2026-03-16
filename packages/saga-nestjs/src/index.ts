// Module
export { SagaModule } from "./saga.module";

// Provider
export { SagaPublisherProvider } from "./providers/saga-publisher.provider";

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
} from "@fbsm/saga-core";
