import { Injectable } from '@nestjs/common';
import { SagaPublisher } from '@core/saga/application/saga-publisher';
import type { SagaUpdate } from '@core/saga/application/types/projector.types';
import { RedisService } from './redis.service';

const CHANNEL_ALL = 'obs:saga:all';
const CHANNEL_SAGA_PREFIX = 'obs:saga:id:';
const CHANNEL_ROOT_PREFIX = 'obs:saga:root:';
const COUNTERS_KEY = 'obs:dash:global:counters';
const RECENT_SAGAS_KEY = 'obs:recent:sagas';
const RECENT_EVENTS_KEY = 'obs:recent:events';
const RECENT_FAILED_KEY = 'obs:recent:failed';

@Injectable()
export class RedisPublisherService extends SagaPublisher {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async publishSagaUpdate(state: SagaUpdate['state'], event: SagaUpdate['event']): Promise<void> {
    const payload = JSON.stringify({
      sagaId: state.sagaId,
      sagaRootId: state.sagaRootId,
      sagaParentId: state.sagaParentId,
      sagaName: state.sagaName,
      sagaDescription: state.sagaDescription,
      status: state.status,
      currentStepName: state.currentStepName,
      currentStepDescription: state.currentStepDescription,
      lastEventHint: state.lastEventHint,
      lastTopic: state.lastTopic,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      updatedAt: state.updatedAt,
      eventCount: state.eventCount,
      eventId: event.sagaEventId,
      eventHint: event.sagaEventHint,
      stepName: event.sagaStepName,
      publishedAt: event.sagaPublishedAt,
    });

    const now = Date.now();

    await Promise.all([
      // Publish to channels
      this.redis.publish(CHANNEL_ALL, payload),
      this.redis.publish(`${CHANNEL_SAGA_PREFIX}${state.sagaId}`, payload),
      this.redis.publish(`${CHANNEL_ROOT_PREFIX}${state.sagaRootId}`, payload),

      // Update counters
      this.redis.incrementCounter(COUNTERS_KEY, 'total_events'),
      this.redis.incrementCounter(COUNTERS_KEY, state.status.toLowerCase()),

      // Update sorted sets
      this.redis.addToSortedSet(RECENT_SAGAS_KEY, state.sagaId, now),
      this.redis.addToSortedSet(RECENT_EVENTS_KEY, event.sagaEventId, now),

      // Track failed/compensating sagas
      ...(state.status === 'COMPENSATING' ? [this.redis.addToSortedSet(RECENT_FAILED_KEY, state.sagaId, now)] : []),
    ]);
  }
}
