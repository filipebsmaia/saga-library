import { EventHint, SagaStatus } from "./saga";

export interface SagaSseMessage {
  sagaId: string;
  sagaRootId: string;
  sagaParentId: string | null;
  sagaName: string | null;
  sagaDescription: string | null;
  status: SagaStatus;
  currentStepName: string;
  currentStepDescription: string | null;
  lastEventHint: EventHint | null;
  lastTopic: string | null;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
  eventCount: number;
  // Event-level fields (kept for LiveEventStream / highlights)
  eventId: string;
  eventHint: EventHint | null;
  stepName: string;
  publishedAt: string;
}
