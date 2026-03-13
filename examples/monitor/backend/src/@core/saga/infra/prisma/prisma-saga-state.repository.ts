import {
  SagaStateRepository,
  SagaStateFilter,
  SagaStateRecord,
  UpsertSagaStateData,
  BulkUpsertStateData,
} from '../../domain/repositories/saga-state.repository';
import { PrismaManager } from './prisma-manager';

const DEFAULT_LIMIT = 20;
const STATE_COLS = 20;
const MAX_ROWS_PER_INSERT = 500;

export class PrismaSagaStateRepository extends SagaStateRepository {
  constructor(private readonly prismaManager: PrismaManager) {
    super();
  }

  get repository() {
    return this.prismaManager.client;
  }

  async findById(sagaId: string): Promise<SagaStateRecord | null> {
    const record = await this.repository.sagaState.findUnique({ where: { sagaId } });
    return record as SagaStateRecord | null;
  }

  async findMany(filter: SagaStateFilter): Promise<SagaStateRecord[]> {
    const limit = filter.limit ?? DEFAULT_LIMIT;

    const where: Record<string, unknown> = {};
    if (filter.compensating) {
      where.status = 'COMPENSATING';
    } else if (filter.activeOnly) {
      where.status = { not: 'COMPLETED' };
    } else if (filter.status) {
      where.status = filter.status;
    }
    if (filter.stuck) {
      const cutoff = new Date(Date.now() - 300_000);
      where.status = where.status ?? { not: 'COMPLETED' };
      where.updatedAt = { lt: cutoff };
    }
    if (filter.sagaName) {
      where.sagaName = { contains: filter.sagaName, mode: 'insensitive' };
    }
    if (filter.sagaRootId) {
      where.sagaRootId = filter.sagaRootId;
    }
    if (filter.rootsOnly) {
      where.sagaParentId = null;
    }
    if (!filter.stuck && (filter.startDate || filter.endDate)) {
      const updatedAt: Record<string, Date> = {};
      if (filter.startDate) {
        updatedAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        updatedAt.lte = filter.endDate;
      }
      where.updatedAt = updatedAt;
    }

    const records = await this.repository.sagaState.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(filter.cursor ? { cursor: { sagaId: filter.cursor }, skip: 1 } : {}),
    });

    return records as SagaStateRecord[];
  }

  async findByRootId(rootId: string): Promise<SagaStateRecord[]> {
    const records = await this.repository.sagaState.findMany({
      where: { sagaRootId: rootId },
      orderBy: { updatedAt: 'desc' },
    });
    return records as SagaStateRecord[];
  }

  async upsert(data: UpsertSagaStateData): Promise<SagaStateRecord> {
    const record = await this.repository.sagaState.upsert({
      where: { sagaId: data.sagaId },
      create: {
        sagaId: data.sagaId,
        sagaRootId: data.sagaRootId,
        sagaParentId: data.sagaParentId ?? null,
        sagaName: data.sagaName ?? null,
        sagaDescription: data.sagaDescription ?? null,
        status: data.status,
        currentStepName: data.currentStepName,
        currentStepDescription: data.currentStepDescription ?? null,
        lastEventId: data.lastEventId,
        lastEventHint: data.lastEventHint ?? null,
        lastCausationId: data.lastCausationId,
        startedAt: data.startedAt,
        endedAt: data.endedAt ?? null,
        eventCount: 1,
        schemaVersion: data.schemaVersion,
        lastTopic: data.lastTopic ?? null,
        lastPartition: data.lastPartition ?? null,
        lastOffset: data.lastOffset ?? null,
        version: 1,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
      update: {
        status: data.status,
        currentStepName: data.currentStepName,
        currentStepDescription: data.currentStepDescription ?? null,
        lastEventId: data.lastEventId,
        lastEventHint: data.lastEventHint ?? null,
        lastCausationId: data.lastCausationId,
        endedAt: data.endedAt ?? undefined,
        schemaVersion: data.schemaVersion,
        lastTopic: data.lastTopic ?? null,
        lastPartition: data.lastPartition ?? null,
        lastOffset: data.lastOffset ?? null,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
        eventCount: { increment: 1 },
        version: { increment: 1 },
      },
    });

    return record as SagaStateRecord;
  }

  async findActiveWithAttention(limit: number): Promise<SagaStateRecord[]> {
    const records = await this.repository.sagaState.findMany({
      where: { status: { not: 'COMPLETED' } },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    return records as SagaStateRecord[];
  }

  // ── Bulk operations ──

  async bulkLookup(sagaIds: string[]): Promise<Map<string, { status: string; startedAt: Date; eventCount: number }>> {
    if (sagaIds.length === 0) return new Map();
    const placeholders = sagaIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await this.repository.$queryRawUnsafe<
      { saga_id: string; status: string; started_at: Date; event_count: number }[]
    >(`SELECT saga_id, status, started_at, event_count FROM saga_state WHERE saga_id IN (${placeholders})`, ...sagaIds);
    const map = new Map<string, { status: string; startedAt: Date; eventCount: number }>();
    for (const row of rows) {
      map.set(row.saga_id, { status: row.status, startedAt: row.started_at, eventCount: Number(row.event_count) });
    }
    return map;
  }

  async bulkUpsert(states: BulkUpsertStateData[]): Promise<void> {
    if (states.length === 0) return;

    for (const chunk of this.chunk(states, MAX_ROWS_PER_INSERT)) {
      await this.bulkUpsertChunk(chunk);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async bulkUpsertChunk(states: BulkUpsertStateData[]): Promise<void> {
    const params: unknown[] = [];
    const valueSets: string[] = [];

    for (let i = 0; i < states.length; i++) {
      const base = i * STATE_COLS;
      const ph = Array.from({ length: STATE_COLS }, (_, j) => `$${base + j + 1}`);
      ph[5] = `${ph[5]}::"SagaStatus"`; // status column
      valueSets.push(`(${ph.join(',')})`);

      const s = states[i];
      params.push(
        s.sagaId,
        s.sagaRootId,
        s.sagaParentId,
        s.sagaName,
        s.sagaDescription,
        s.status,
        s.currentStepName,
        s.currentStepDescription,
        s.lastEventId,
        s.lastEventHint,
        s.lastCausationId,
        s.startedAt,
        s.endedAt,
        s.eventCountIncrement,
        s.schemaVersion,
        s.lastTopic,
        s.lastPartition,
        s.lastOffset,
        1, // version for new inserts
        new Date(), // updated_at
      );
    }

    await this.repository.$executeRawUnsafe(
      `INSERT INTO saga_state (
        saga_id, saga_root_id, saga_parent_id,
        saga_name, saga_description,
        status, current_step_name, current_step_description,
        last_event_id, last_event_hint, last_causation_id,
        started_at, ended_at,
        event_count, schema_version,
        last_topic, last_partition, last_offset,
        version, updated_at
      ) VALUES ${valueSets.join(',')}
      ON CONFLICT (saga_id) DO UPDATE SET
        status = CASE
          WHEN saga_state.status = 'COMPLETED'::"SagaStatus" THEN saga_state.status
          WHEN EXCLUDED.status = 'COMPLETED'::"SagaStatus" THEN EXCLUDED.status
          WHEN EXCLUDED.status = 'COMPENSATING'::"SagaStatus" THEN EXCLUDED.status
          ELSE EXCLUDED.status
        END,
        current_step_name = CASE
          WHEN saga_state.status = 'COMPLETED'::"SagaStatus" THEN saga_state.current_step_name
          ELSE EXCLUDED.current_step_name
        END,
        current_step_description = CASE
          WHEN saga_state.status = 'COMPLETED'::"SagaStatus" THEN saga_state.current_step_description
          ELSE EXCLUDED.current_step_description
        END,
        last_event_id = CASE
          WHEN saga_state.status = 'COMPLETED'::"SagaStatus" THEN saga_state.last_event_id
          ELSE EXCLUDED.last_event_id
        END,
        last_event_hint = CASE
          WHEN saga_state.status = 'COMPLETED'::"SagaStatus" THEN saga_state.last_event_hint
          ELSE EXCLUDED.last_event_hint
        END,
        last_causation_id = CASE
          WHEN saga_state.status = 'COMPLETED'::"SagaStatus" THEN saga_state.last_causation_id
          ELSE EXCLUDED.last_causation_id
        END,
        ended_at = CASE
          WHEN EXCLUDED.status = 'COMPLETED'::"SagaStatus" THEN EXCLUDED.ended_at
          WHEN saga_state.status = 'COMPLETED'::"SagaStatus" THEN saga_state.ended_at
          ELSE NULL
        END,
        schema_version = EXCLUDED.schema_version,
        last_topic = EXCLUDED.last_topic,
        last_partition = EXCLUDED.last_partition,
        last_offset = EXCLUDED.last_offset,
        event_count = saga_state.event_count + EXCLUDED.event_count,
        version = saga_state.version + 1,
        updated_at = NOW()`,
      ...params,
    );
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
