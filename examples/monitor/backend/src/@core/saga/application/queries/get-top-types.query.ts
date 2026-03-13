import { SagaDashboardService } from '../../domain/services/saga-dashboard.service';
import { CacheService } from '../cache.service';

export interface TopSagaTypeDto {
  sagaName: string;
  volume: number;
  avgDurationMs: number;
  compensationRatio: number;
}

const TOP_TYPES_CACHE_KEY = 'obs:cache:toptypes';
const TOP_TYPES_TTL_SECONDS = 60;

export class GetTopTypesQuery {
  constructor(
    private readonly dashboard: SagaDashboardService,
    private readonly redis: CacheService,
  ) {}

  async execute(limit = 10): Promise<TopSagaTypeDto[]> {
    const cached = await this.redis.get(TOP_TYPES_CACHE_KEY);
    if (cached !== null) return JSON.parse(cached);

    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const result = await this.dashboard.findTopTypes(since, limit);
    await this.redis.setWithTtl(TOP_TYPES_CACHE_KEY, JSON.stringify(result), TOP_TYPES_TTL_SECONDS);
    return result;
  }
}
