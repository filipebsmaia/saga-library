export abstract class CacheService {
  abstract get(key: string): Promise<string | null>;
  abstract setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void>;
  abstract countSortedSetInRange(key: string, min: number, max: number): Promise<number>;
}
