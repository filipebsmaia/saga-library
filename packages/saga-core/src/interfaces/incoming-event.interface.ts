export interface IncomingEvent<T = Record<string, unknown>> {
  eventId: string;
  sagaId: string;
  parentSagaId?: string;
  rootSagaId: string;
  causationId: string;
  topic: string;
  sagaName?: string;
  sagaDescription?: string;
  stepName: string;
  stepDescription?: string;
  occurredAt: string;
  payload: T;
  key?: string;
}
