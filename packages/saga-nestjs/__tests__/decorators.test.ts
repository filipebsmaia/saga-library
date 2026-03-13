import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { SagaParticipant } from '../src/decorators/saga-participant.decorator';
import { SagaHandler } from '../src/decorators/saga-handler.decorator';
import { SAGA_PARTICIPANT_METADATA, SAGA_HANDLER_METADATA } from '../src/constants';

describe('@SagaParticipant()', () => {
  it('should set SAGA_PARTICIPANT_METADATA on the class', () => {
    @SagaParticipant()
    class TestParticipant {}

    const metadata = Reflect.getMetadata(SAGA_PARTICIPANT_METADATA, TestParticipant);
    expect(metadata).toBe(true);
  });
});

describe('@SagaHandler()', () => {
  it('should map a single event type to the method', () => {
    class TestParticipant {
      @SagaHandler('order.created')
      async process() {}
    }

    const map: Map<string, string | symbol> = Reflect.getMetadata(
      SAGA_HANDLER_METADATA,
      TestParticipant,
    );

    expect(map).toBeInstanceOf(Map);
    expect(map.get('order.created')).toBe('process');
  });

  it('should map multiple event types to the same method', () => {
    class TestParticipant {
      @SagaHandler('inventory.failed', 'inventory.compensated')
      async compensate() {}
    }

    const map: Map<string, string | symbol> = Reflect.getMetadata(
      SAGA_HANDLER_METADATA,
      TestParticipant,
    );

    expect(map.get('inventory.failed')).toBe('compensate');
    expect(map.get('inventory.compensated')).toBe('compensate');
  });

  it('should accumulate handlers from multiple methods on the same class', () => {
    class TestParticipant {
      @SagaHandler('order.created')
      async process() {}

      @SagaHandler('order.cancelled')
      async compensate() {}
    }

    const map: Map<string, string | symbol> = Reflect.getMetadata(
      SAGA_HANDLER_METADATA,
      TestParticipant,
    );

    expect(map.size).toBe(2);
    expect(map.get('order.created')).toBe('process');
    expect(map.get('order.cancelled')).toBe('compensate');
  });
});
