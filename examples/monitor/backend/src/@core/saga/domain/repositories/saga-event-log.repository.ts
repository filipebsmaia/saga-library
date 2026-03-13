import type { SagaStatus } from '../types/saga-status.enum';

export interface SagaEventLogRecord {
  sagaEventId: string;
  sagaId: string;
  sagaRootId: string;
  sagaParentId: string | null;
  sagaCausationId: string;
  sagaName: string | null;
  sagaDescription: string | null;
  sagaStepName: string;
  sagaStepDescription: string | null;
  sagaEventHint: string | null;
  sagaPublishedAt: Date;
  sagaSchemaVersion: number;
  topic: string;
  partition: number | null;
  offset: string | null;
  statusBefore: SagaStatus | null;
  statusAfter: SagaStatus;
  headersJson: Record<string, string> | null;
  createdAt: Date;
}

export interface BulkInsertEventLogData {
  sagaEventId: string;
  sagaId: string;
  sagaRootId: string;
  sagaParentId: string | null;
  sagaCausationId: string;
  sagaName: string | null;
  sagaDescription: string | null;
  sagaStepName: string;
  sagaStepDescription: string | null;
  sagaEventHint: string | null;
  sagaPublishedAt: Date;
  sagaSchemaVersion: number;
  topic: string;
  partition: number | null;
  offset: string | null;
  statusBefore: string | null;
  statusAfter: string;
  headersJson: Record<string, string> | null;
}

export interface TransitionRecord {
  fromStep: string;
  fromHint: string | null;
  toStep: string;
  toHint: string | null;
  toTopic: string | null;
  frequency: number;
}

export interface TopStepRecord {
  stepName: string;
  sagaName: string | null;
  count: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

export abstract class SagaEventLogRepository {
  abstract findBySagaId(sagaId: string, cursor?: string, limit?: number): Promise<SagaEventLogRecord[]>;
  abstract findBySagaIds(sagaIds: string[], cursor?: string, limit?: number): Promise<SagaEventLogRecord[]>;
  abstract findByRootId(rootId: string): Promise<SagaEventLogRecord[]>;
  abstract existsByEventId(eventId: string): Promise<boolean>;
  abstract countBySagaId(sagaId: string): Promise<{ total: number; compensations: number; forks: number }>;
  abstract bulkCheckExisting(eventIds: string[]): Promise<Set<string>>;
  abstract bulkInsert(events: BulkInsertEventLogData[]): Promise<void>;
  abstract findTransitionMap(sagaName: string): Promise<TransitionRecord[]>;
  abstract findTopSteps(since: Date, limit: number): Promise<TopStepRecord[]>;
}
