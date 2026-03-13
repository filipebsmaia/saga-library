export interface IncomingEvent<T = Record<string, unknown>> {
  eventId: string;
  sagaId: string;
  parentSagaId?: string;
  rootSagaId: string;
  causationId: string;
  eventType: string;
  sagaName?: string;
  sagaDescription?: string;
  stepName: string;
  stepDescription?: string;
  occurredAt: string;
  payload: T;
  key?: string;
}
