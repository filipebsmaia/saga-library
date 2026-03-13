import { SagaDashboardService, TopTypeRecord } from '../../domain/services/saga-dashboard.service';
import { SagaStatus } from '../../domain/types/saga-status.enum';
import { PrismaManager } from './prisma-manager';

export class PrismaSagaDashboardService extends SagaDashboardService {
  constructor(private readonly prismaManager: PrismaManager) {
    super();
  }

  private get client() {
    return this.prismaManager.client;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const groups = await this.client.sagaState.groupBy({
      by: ['status'],
      _count: true,
    });

    const result: Record<string, number> = {
      [SagaStatus.RUNNING]: 0,
      [SagaStatus.COMPENSATING]: 0,
      [SagaStatus.COMPLETED]: 0,
    };

    for (const group of groups) {
      result[group.status] = group._count;
    }

    return result;
  }

  async countStuck(thresholdMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdMs);
    const result = await this.client.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM saga_state
      WHERE status != 'COMPLETED'
        AND updated_at < ${cutoff}
    `;
    return Number(result[0]?.count ?? 0);
  }

  async findTopTypes(since: Date, limit: number): Promise<TopTypeRecord[]> {
    const rows = await this.client.$queryRaw<
      { saga_name: string; volume: bigint; avg_ms: number; compensation_ratio: number }[]
    >`
      SELECT
        s.saga_name,
        COUNT(*)::bigint AS volume,
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) * 1000)
            FILTER (WHERE s.ended_at IS NOT NULL),
          0
        )::float8 AS avg_ms,
        COALESCE(
          COUNT(*) FILTER (WHERE s.status = 'COMPENSATING')::float8 / NULLIF(COUNT(*)::float8, 0),
          0
        )::float8 AS compensation_ratio
      FROM saga_state s
      WHERE s.saga_name IS NOT NULL
        AND s.created_at >= ${since}
      GROUP BY s.saga_name
      ORDER BY volume DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      sagaName: r.saga_name,
      volume: Number(r.volume),
      avgDurationMs: Math.round(r.avg_ms),
      compensationRatio: Math.round(r.compensation_ratio * 100) / 100,
    }));
  }
}
