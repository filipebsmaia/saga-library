import type { SagaStatus } from '../types/saga-status.enum';

export interface SagaStateFilter {
  status?: SagaStatus;
  sagaName?: string;
  sagaRootId?: string;
  startDate?: Date;
  endDate?: Date;
  rootsOnly?: boolean;
  activeOnly?: boolean;
  compensating?: boolean;
  stuck?: boolean;
  cursor?: string;
  limit?: number;
}

export interface SagaStateRecord {
  sagaId: string;
  sagaRootId: string;
  sagaParentId: string | null;
  sagaName: string | null;
  sagaDescription: string | null;
  status: SagaStatus;
  currentStepName: string;
  currentStepDescription: string | null;
  lastEventId: string;
  lastEventHint: string | null;
  lastCausationId: string;
  startedAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  eventCount: number;
  schemaVersion: number;
  lastTopic: string | null;
  lastPartition: number | null;
  lastOffset: string | null;
  createdAt: Date;
  version: number;
  metadata: Record<string, unknown> | null;
}

export interface UpsertSagaStateData {
  sagaId: string;
  sagaRootId: string;
  sagaParentId?: string | null;
  sagaName?: string | null;
  sagaDescription?: string | null;
  status: SagaStatus;
  currentStepName: string;
  currentStepDescription?: string | null;
  lastEventId: string;
  lastEventHint?: string | null;
  lastCausationId: string;
  startedAt: Date;
  endedAt?: Date | null;
  schemaVersion: number;
  lastTopic?: string | null;
  lastPartition?: number | null;
  lastOffset?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BulkUpsertStateData {
  sagaId: string;
  sagaRootId: string;
  sagaParentId: string | null;
  sagaName: string | null;
  sagaDescription: string | null;
  status: SagaStatus;
  currentStepName: string;
  currentStepDescription: string | null;
  lastEventId: string;
  lastEventHint: string | null;
  lastCausationId: string;
  startedAt: Date;
  endedAt: Date | null;
  eventCountIncrement: number;
  schemaVersion: number;
  lastTopic: string | null;
  lastPartition: number | null;
  lastOffset: string | null;
}

export abstract class SagaStateRepository {
  abstract findById(sagaId: string): Promise<SagaStateRecord | null>;
  abstract findMany(filter: SagaStateFilter): Promise<SagaStateRecord[]>;
  abstract findByRootId(rootId: string): Promise<SagaStateRecord[]>;
  abstract upsert(data: UpsertSagaStateData): Promise<SagaStateRecord>;
  abstract findActiveWithAttention(limit: number): Promise<SagaStateRecord[]>;
  abstract bulkLookup(sagaIds: string[]): Promise<Map<string, { status: string; startedAt: Date; eventCount: number }>>;
  abstract bulkUpsert(states: BulkUpsertStateData[]): Promise<void>;
}
