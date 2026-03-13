import type {
  SagaParticipant,
  EventHandler,
  IncomingEvent,
  Emit,
} from '@saga/core';
import { SagaRetryableError } from '@saga/core';

export abstract class SagaParticipantBase implements SagaParticipant {
  abstract readonly serviceId: string;

  readonly on: Record<string, EventHandler<any>> = {};

  onRetryExhausted?(
    event: IncomingEvent,
    error: SagaRetryableError,
    emit: Emit,
  ): Promise<void>;
}
