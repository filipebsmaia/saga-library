export enum SagaStatus {
  RUNNING = "RUNNING",
  COMPENSATING = "COMPENSATING",
  COMPLETED = "COMPLETED",
}

export type EventHint = "step" | "compensation" | "final" | "fork";

export interface SagaStateDto {
  sagaId: string;
  sagaRootId: string;
  sagaParentId: string | null;
  sagaName: string | null;
  sagaDescription: string | null;
  status: SagaStatus;
  currentStepName: string;
  currentStepDescription: string | null;
  lastEventId: string;
  lastEventHint: EventHint | null;
  lastCausationId: string;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  eventCount: number;
  schemaVersion: number;
  lastTopic: string | null;
  lastPartition: number | null;
  lastOffset: string | null;
  createdAt: string;
  version: number;
}

export interface SagaEventDto {
  sagaEventId: string;
  sagaId: string;
  sagaRootId: string;
  sagaParentId: string | null;
  sagaCausationId: string;
  sagaName: string | null;
  sagaStepName: string;
  sagaStepDescription: string | null;
  sagaEventHint: EventHint | null;
  sagaPublishedAt: string;
  statusBefore: SagaStatus | null;
  statusAfter: SagaStatus;
  topic: string;
  partition: number | null;
  offset: string | null;
  createdAt: string;
}

export interface SagaMetricsDto {
  sagaId: string;
  status: SagaStatus;
  elapsedMs: number;
  totalDurationMs: number | null;
  lastUpdateAgoMs: number;
  totalEvents: number;
  compensationCount: number;
  forkCount: number;
  childSagaCount: number;
  isStuck: boolean;
}

export interface DashboardStatsDto {
  running: number;
  compensating: number;
  completed: number;
  total: number;
  compensatingRecent: number;
  stuck: number;
  eventsPerMinute: number;
}

export type AttentionReason = "stuck" | "compensating" | "many_children";

export interface AttentionItemDto {
  sagaId: string;
  sagaRootId: string;
  sagaName: string | null;
  status: SagaStatus;
  reason: AttentionReason;
  currentStepName: string;
  updatedAt: string;
  startedAt: string;
  durationMs: number;
  detail: string;
}

export interface AttentionResponseDto {
  items: AttentionItemDto[];
}

export interface PredictedEventDto {
  stepName: string;
  eventHint: string | null;
  topic: string | null;
  probability: number;
}

export interface SagaPredictionsDto {
  sagaId: string;
  sagaName: string;
  currentStep: string;
  currentHint: string | null;
  nextPossible: PredictedEventDto[];
  expectedChain: PredictedEventDto[];
  sampleSize: number;
}
