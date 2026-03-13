import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly channelCallbacks = new Map<string, Set<(message: string) => void>>();

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.publisher = new Redis(url);
    this.subscriber = new Redis(url);

    this.subscriber.on('message', (channel: string, message: string) => {
      const callbacks = this.channelCallbacks.get(channel);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(message);
        }
      }
    });
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.publisher.publish(channel, message);
  }

  subscribe(channel: string, callback: (message: string) => void): void {
    if (!this.channelCallbacks.has(channel)) {
      this.channelCallbacks.set(channel, new Set());
      this.subscriber.subscribe(channel);
    }
    this.channelCallbacks.get(channel)!.add(callback);
  }

  unsubscribe(channel: string, callback?: (message: string) => void): void {
    const callbacks = this.channelCallbacks.get(channel);
    if (!callbacks) return;

    if (callback) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.channelCallbacks.delete(channel);
        this.subscriber.unsubscribe(channel);
      }
    } else {
      this.channelCallbacks.delete(channel);
      this.subscriber.unsubscribe(channel);
    }
  }

  async incrementCounter(hashKey: string, field: string, by = 1): Promise<void> {
    await this.publisher.hincrby(hashKey, field, by);
  }

  async getCounters(hashKey: string): Promise<Record<string, string>> {
    return this.publisher.hgetall(hashKey);
  }

  async addToSortedSet(key: string, member: string, score: number): Promise<void> {
    await this.publisher.zadd(key, score, member);
    // Trim to keep only the most recent 1000 entries
    await this.publisher.zremrangebyrank(key, 0, -1001);
  }

  async getSortedSetMembers(key: string, limit: number): Promise<string[]> {
    return this.publisher.zrevrange(key, 0, limit - 1);
  }

  async countSortedSetInRange(key: string, minScore: number, maxScore: number): Promise<number> {
    return this.publisher.zcount(key, minScore, maxScore);
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.publisher.set(key, value, 'EX', ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.publisher.get(key);
  }
}
