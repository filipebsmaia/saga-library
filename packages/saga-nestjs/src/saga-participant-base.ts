import type { IncomingEvent, Emit } from "@fbsm/saga-core";
import { SagaRetryableError } from "@fbsm/saga-core";

export abstract class SagaParticipantBase {
  abstract handle(event: IncomingEvent, emit: Emit): Promise<void>;

  onFail?(
    event: IncomingEvent,
    error: Error,
    emit: Emit,
  ): Promise<void>;

  onRetryExhausted?(
    event: IncomingEvent,
    error: SagaRetryableError,
    emit: Emit,
  ): Promise<void>;
}
