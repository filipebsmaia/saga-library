import { EventHint, SagaStatus } from "./saga";

export interface WaterfallSpan {
  id: string;
  sagaId: string;
  trackId: string;
  trackLabel: string;
  label: string;
  hint: EventHint | null;
  status: SagaStatus;
  statusBefore: SagaStatus | null;
  startMs: number;
  durationMs: number;
  estimated: boolean;
  /** Step description from the event */
  stepDescription: string | null;
  /** Percentage of this span relative to its saga's total duration */
  percentage: number;
  /** Saga name this span belongs to */
  sagaName: string | null;
  /** Topic where the event was published */
  topic: string;
  /** Causation ID */
  causationId: string;
}

export interface WaterfallTrack {
  trackId: string;
  label: string;
  sagaId: string;
  depth: number;
}
