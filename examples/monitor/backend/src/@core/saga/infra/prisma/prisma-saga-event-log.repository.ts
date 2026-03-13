import {
  SagaEventLogRepository,
  SagaEventLogRecord,
  BulkInsertEventLogData,
  TransitionRecord,
  TopStepRecord,
} from '../../domain/repositories/saga-event-log.repository';
import { PrismaManager } from './prisma-manager';

const DEFAULT_LIMIT = 50;
const EVENT_LOG_COLS = 18;
const MAX_ROWS_PER_INSERT = 500;

export class PrismaSagaEventLogRepository extends SagaEventLogRepository {
  constructor(private readonly prismaManager: PrismaManager) {
    super();
  }

  get repository() {
    return this.prismaManager.client;
  }

  async findBySagaId(sagaId: string, cursor?: string, limit?: number): Promise<SagaEventLogRecord[]> {
    const take = limit ?? DEFAULT_LIMIT;

    const records = await this.repository.sagaEventLog.findMany({
      where: { sagaId },
      orderBy: { sagaPublishedAt: 'asc' },
      take: take + 1,
      ...(cursor ? { cursor: { sagaEventId: cursor }, skip: 1 } : {}),
    });

    return records as SagaEventLogRecord[];
  }

  async findBySagaIds(sagaIds: string[], cursor?: string, limit?: number): Promise<SagaEventLogRecord[]> {
    const take = limit ?? DEFAULT_LIMIT;

    const records = await this.repository.sagaEventLog.findMany({
      where: { sagaId: { in: sagaIds } },
      orderBy: { sagaPublishedAt: 'asc' },
      take: take + 1,
      ...(cursor ? { cursor: { sagaEventId: cursor }, skip: 1 } : {}),
    });

    return records as SagaEventLogRecord[];
  }

  async findByRootId(rootId: string): Promise<SagaEventLogRecord[]> {
    const records = await this.repository.sagaEventLog.findMany({
      where: { sagaRootId: rootId },
      orderBy: { sagaPublishedAt: 'asc' },
    });
    return records as SagaEventLogRecord[];
  }

  async existsByEventId(eventId: string): Promise<boolean> {
    const record = await this.repository.sagaEventLog.findUnique({
      where: { sagaEventId: eventId },
      select: { sagaEventId: true },
    });
    return record !== null;
  }

  async countBySagaId(sagaId: string): Promise<{ total: number; compensations: number; forks: number }> {
    const [total, compensations, forks] = await Promise.all([
      this.repository.sagaEventLog.count({ where: { sagaId } }),
      this.repository.sagaEventLog.count({ where: { sagaId, sagaEventHint: 'compensation' } }),
      this.repository.sagaEventLog.count({ where: { sagaId, sagaEventHint: 'fork' } }),
    ]);

    return { total, compensations, forks };
  }

  // ── Bulk operations ──

  async bulkCheckExisting(eventIds: string[]): Promise<Set<string>> {
    if (eventIds.length === 0) return new Set();
    const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await this.repository.$queryRawUnsafe<{ saga_event_id: string }[]>(
      `SELECT saga_event_id FROM saga_event_log WHERE saga_event_id IN (${placeholders})`,
      ...eventIds,
    );
    return new Set(rows.map((r) => r.saga_event_id));
  }

  async bulkInsert(events: BulkInsertEventLogData[]): Promise<void> {
    if (events.length === 0) return;

    for (const chunk of this.chunk(events, MAX_ROWS_PER_INSERT)) {
      await this.bulkInsertChunk(chunk);
    }
  }

  private async bulkInsertChunk(events: BulkInsertEventLogData[]): Promise<void> {
    const params: unknown[] = [];
    const valueSets: string[] = [];

    for (let i = 0; i < events.length; i++) {
      const base = i * EVENT_LOG_COLS;
      const ph = Array.from({ length: EVENT_LOG_COLS }, (_, j) => `$${base + j + 1}`);
      // Cast enum columns
      ph[15] = `${ph[15]}::"SagaStatus"`;
      ph[16] = `${ph[16]}::"SagaStatus"`;
      ph[17] = `${ph[17]}::jsonb`;
      valueSets.push(`(${ph.join(',')})`);

      const e = events[i];
      params.push(
        e.sagaEventId,
        e.sagaId,
        e.sagaRootId,
        e.sagaParentId,
        e.sagaCausationId,
        e.sagaName,
        e.sagaDescription,
        e.sagaStepName,
        e.sagaStepDescription,
        e.sagaEventHint,
        e.sagaPublishedAt,
        e.sagaSchemaVersion,
        e.topic,
        e.partition,
        e.offset,
        e.statusBefore,
        e.statusAfter,
        e.headersJson ? JSON.stringify(e.headersJson) : null,
      );
    }

    await this.repository.$executeRawUnsafe(
      `INSERT INTO saga_event_log (
        saga_event_id, saga_id, saga_root_id, saga_parent_id,
        saga_causation_id, saga_name, saga_description,
        saga_step_name, saga_step_description, saga_event_hint,
        saga_published_at, saga_schema_version,
        topic, partition, offset_,
        status_before, status_after,
        headers_json
      ) VALUES ${valueSets.join(',')}
      ON CONFLICT (saga_event_id) DO NOTHING`,
      ...params,
    );
  }

  async findTransitionMap(sagaName: string): Promise<TransitionRecord[]> {
    const rows = await this.repository.$queryRawUnsafe<
      {
        from_step: string;
        from_hint: string | null;
        to_step: string;
        to_hint: string | null;
        to_topic: string | null;
        frequency: bigint;
      }[]
    >(
      `WITH sampled_sagas AS (
        SELECT saga_id
        FROM saga_state
        WHERE saga_name = $1 AND status = 'COMPLETED'
        ORDER BY updated_at DESC
        LIMIT 1000
      ),
      ordered_events AS (
        SELECT
          el.saga_id,
          el.saga_step_name,
          el.saga_event_hint,
          el.topic,
          ROW_NUMBER() OVER (PARTITION BY el.saga_id ORDER BY el.saga_published_at ASC, el.saga_event_id ASC) AS seq
        FROM saga_event_log el
        WHERE el.saga_id IN (SELECT saga_id FROM sampled_sagas)
      ),
      transitions AS (
        SELECT
          curr.saga_step_name AS from_step,
          curr.saga_event_hint AS from_hint,
          nxt.saga_step_name AS to_step,
          nxt.saga_event_hint AS to_hint,
          nxt.topic AS to_topic
        FROM ordered_events curr
        INNER JOIN ordered_events nxt
          ON curr.saga_id = nxt.saga_id
          AND nxt.seq = curr.seq + 1
      )
      SELECT from_step, from_hint, to_step, to_hint, to_topic, COUNT(*) AS frequency
      FROM transitions
      GROUP BY from_step, from_hint, to_step, to_hint, to_topic
      ORDER BY from_step, from_hint, frequency DESC`,
      sagaName,
    );

    return rows.map((r) => ({
      fromStep: r.from_step,
      fromHint: r.from_hint,
      toStep: r.to_step,
      toHint: r.to_hint,
      toTopic: r.to_topic,
      frequency: Number(r.frequency),
    }));
  }

  async findTopSteps(since: Date, limit: number): Promise<TopStepRecord[]> {
    const rows = await this.repository.$queryRaw<
      { step_name: string; saga_name: string | null; cnt: bigint; avg_ms: number; p95_ms: number }[]
    >`
      WITH step_durations AS (
        SELECT
          e.saga_step_name AS step_name,
          e.saga_name,
          EXTRACT(EPOCH FROM (
            LEAD(e.saga_published_at) OVER (
              PARTITION BY e.saga_id ORDER BY e.saga_published_at ASC
            ) - e.saga_published_at
          )) * 1000 AS duration_ms
        FROM saga_event_log e
        WHERE e.saga_published_at >= ${since}
      )
      SELECT
        step_name,
        saga_name,
        COUNT(*)::bigint AS cnt,
        COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL AND duration_ms > 0), 0)::float8 AS avg_ms,
        COALESCE(
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)
            FILTER (WHERE duration_ms IS NOT NULL AND duration_ms > 0),
          0
        )::float8 AS p95_ms
      FROM step_durations
      WHERE step_name != ''
      GROUP BY step_name, saga_name
      ORDER BY p95_ms DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      stepName: r.step_name,
      sagaName: r.saga_name,
      count: Number(r.cnt),
      avgDurationMs: Math.round(r.avg_ms),
      p95DurationMs: Math.round(r.p95_ms),
    }));
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
