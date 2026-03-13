import { Controller, Param, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { RedisService } from '@core/saga/infra/redis/redis.service';

@ApiTags('Saga Stream')
@Controller({ path: 'stream/sagas', version: '1' })
export class SagaStreamController {
  constructor(private readonly redisService: RedisService) {}

  @Sse()
  @ApiOperation({ summary: 'Stream all saga updates (SSE)' })
  streamAll(): Observable<MessageEvent> {
    return this.createSseStream('obs:saga:all');
  }

  @Sse(':sagaId')
  @ApiOperation({ summary: 'Stream updates for a specific saga (SSE)' })
  streamBySagaId(@Param('sagaId') sagaId: string): Observable<MessageEvent> {
    return this.createSseStream(`obs:saga:id:${sagaId}`);
  }

  @Sse('root/:rootId')
  @ApiOperation({ summary: 'Stream updates for a saga root tree (SSE)' })
  streamByRootId(@Param('rootId') rootId: string): Observable<MessageEvent> {
    return this.createSseStream(`obs:saga:root:${rootId}`);
  }

  private createSseStream(channel: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const callback = (message: string) => {
        subscriber.next({ data: message } as MessageEvent);
      };

      this.redisService.subscribe(channel, callback);

      // Heartbeat every 25s to keep connection alive through proxies/browsers
      // Must NOT have a custom 'type' — EventSource.onmessage only fires for default 'message' events
      const heartbeat = setInterval(() => {
        subscriber.next({ data: '{}' } as MessageEvent);
      }, 25_000);

      return () => {
        clearInterval(heartbeat);
        this.redisService.unsubscribe(channel, callback);
      };
    });
  }
}
