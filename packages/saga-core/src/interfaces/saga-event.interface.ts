import type { EventHint } from "./emit.type";

export interface SagaEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  topic: string;
  sagaId: string;
  causationId: string;
  stepName: string;
  stepDescription?: string;
  sagaName?: string;
  sagaDescription?: string;
  occurredAt: string;
  publishedAt: string;
  schemaVersion: 1;
  parentSagaId?: string;
  rootSagaId: string;
  payload: TPayload;
  hint?: EventHint;
  key?: string;
}
