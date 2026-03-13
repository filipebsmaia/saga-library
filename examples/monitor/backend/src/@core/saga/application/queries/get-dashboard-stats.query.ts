import { SagaDashboardService } from '../../domain/services/saga-dashboard.service';
import { CacheService } from '../cache.service';

export interface DashboardStatsDto {
  running: number;
  compensating: number;
  completed: number;
  total: number;
  compensatingRecent: number;
  stuck: number;
  eventsPerMinute: number;
}

const STUCK_THRESHOLD_MS = 5 * 60_000;
const COUNT_BY_STATUS_CACHE_KEY = 'obs:cache:countbystatus';
const COUNT_STUCK_CACHE_KEY = 'obs:cache:countstuck';
const COUNT_BY_STATUS_TTL_SECONDS = 30;
const COUNT_STUCK_TTL_SECONDS = 30;
const RECENT_FAILED_KEY = 'obs:recent:failed';
const RECENT_EVENTS_KEY = 'obs:recent:events';

export class GetDashboardStatsQuery {
  constructor(
    private readonly dashboard: SagaDashboardService,
    private readonly redis: CacheService,
  ) {}

  async execute(): Promise<DashboardStatsDto> {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60_000;
    const oneMinAgo = now - 60_000;

    const [counts, stuck, compensatingRecent, eventsPerMinute] = await Promise.all([
      this.getCachedCountByStatus(),
      this.getCachedCountStuck(),
      this.redis.countSortedSetInRange(RECENT_FAILED_KEY, fiveMinAgo, now),
      this.redis.countSortedSetInRange(RECENT_EVENTS_KEY, oneMinAgo, now),
    ]);

    const running = counts['RUNNING'] ?? 0;
    const compensating = counts['COMPENSATING'] ?? 0;
    const completed = counts['COMPLETED'] ?? 0;

    return {
      running,
      compensating,
      completed,
      total: running + compensating + completed,
      compensatingRecent,
      stuck,
      eventsPerMinute,
    };
  }

  private async getCachedCountByStatus(): Promise<Record<string, number>> {
    const cached = await this.redis.get(COUNT_BY_STATUS_CACHE_KEY);
    if (cached !== null) return JSON.parse(cached);
    const counts = await this.dashboard.countByStatus();
    await this.redis.setWithTtl(COUNT_BY_STATUS_CACHE_KEY, JSON.stringify(counts), COUNT_BY_STATUS_TTL_SECONDS);
    return counts;
  }

  private async getCachedCountStuck(): Promise<number> {
    const cached = await this.redis.get(COUNT_STUCK_CACHE_KEY);
    if (cached !== null) return Number(cached);
    const stuck = await this.dashboard.countStuck(STUCK_THRESHOLD_MS);
    await this.redis.setWithTtl(COUNT_STUCK_CACHE_KEY, String(stuck), COUNT_STUCK_TTL_SECONDS);
    return stuck;
  }
}
