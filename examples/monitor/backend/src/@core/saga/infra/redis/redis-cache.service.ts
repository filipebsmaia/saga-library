import { CacheService } from '../../application/cache.service';
import { RedisService } from './redis.service';

export class RedisCacheService extends CacheService {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.setWithTtl(key, value, ttlSeconds);
  }

  async countSortedSetInRange(key: string, min: number, max: number): Promise<number> {
    return this.redis.countSortedSetInRange(key, min, max);
  }
}
