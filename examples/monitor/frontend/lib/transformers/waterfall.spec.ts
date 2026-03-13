import { describe, it, expect } from 'vitest';
import { eventsToWaterfallSpans } from './waterfall';
import { SagaEventDto, SagaStateDto, SagaStatus } from '@/lib/types/saga';

function makeSaga(overrides: Partial<SagaStateDto> = {}): SagaStateDto {
  return {
    sagaId: 'saga-1',
    sagaRootId: 'saga-1',
    sagaParentId: null,
    sagaName: 'test-saga',
    sagaDescription: null,
    status: SagaStatus.COMPLETED,
    currentStepName: 'done',
    currentStepDescription: null,
    lastEventId: 'evt-3',
    lastEventHint: 'final',
    lastCausationId: 'evt-2',
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:10.000Z',
    endedAt: '2024-01-01T00:00:10.000Z',
    eventCount: 3,
    schemaVersion: 1,
    lastTopic: 'test',
    lastPartition: 0,
    lastOffset: '3',
    createdAt: '2024-01-01T00:00:00.000Z',
    version: 3,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SagaEventDto>): SagaEventDto {
  return {
    sagaEventId: 'evt-1',
    sagaId: 'saga-1',
    sagaRootId: 'saga-1',
    sagaParentId: null,
    sagaCausationId: 'saga-1',
    sagaName: null,
    sagaStepName: 'step-1',
    sagaStepDescription: null,
    sagaEventHint: 'step',
    sagaPublishedAt: '2024-01-01T00:00:00.000Z',
    statusBefore: null,
    statusAfter: SagaStatus.RUNNING,
    topic: 'test',
    partition: 0,
    offset: '1',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('eventsToWaterfallSpans', () => {
  it('returns empty for no events', () => {
    const result = eventsToWaterfallSpans([], []);
    expect(result.tracks).toEqual([]);
    expect(result.spans).toEqual([]);
  });

  it('creates correct spans for 3-event saga', () => {
    const saga = makeSaga();
    const events: SagaEventDto[] = [
      makeEvent({ sagaEventId: 'evt-1', sagaStepName: 'step-1', sagaPublishedAt: '2024-01-01T00:00:00.000Z' }),
      makeEvent({ sagaEventId: 'evt-2', sagaStepName: 'step-2', sagaPublishedAt: '2024-01-01T00:00:03.000Z' }),
      makeEvent({ sagaEventId: 'evt-3', sagaStepName: 'step-3', sagaEventHint: 'final', sagaPublishedAt: '2024-01-01T00:00:08.000Z' }),
    ];

    const result = eventsToWaterfallSpans(events, [saga]);

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].trackId).toBe('saga-1');
    expect(result.spans).toHaveLength(3);

    // First span: 0ms to 3000ms
    expect(result.spans[0].startMs).toBe(0);
    expect(result.spans[0].durationMs).toBe(3000);
    expect(result.spans[0].label).toBe('step-1');

    // Second span: 3000ms to 8000ms
    expect(result.spans[1].startMs).toBe(3000);
    expect(result.spans[1].durationMs).toBe(5000);

    // Third span: 8000ms to saga end (10000ms)
    expect(result.spans[2].startMs).toBe(8000);
    expect(result.spans[2].durationMs).toBe(2000);
    expect(result.spans[2].estimated).toBe(false);
  });

  it('creates tracks for fork scenario', () => {
    const root = makeSaga({
      sagaId: 'root',
      sagaRootId: 'root',
      status: SagaStatus.RUNNING,
      endedAt: null,
      updatedAt: '2024-01-01T00:00:05.000Z',
    });
    const child = makeSaga({
      sagaId: 'child',
      sagaRootId: 'root',
      sagaParentId: 'root',
      startedAt: '2024-01-01T00:00:02.000Z',
      updatedAt: '2024-01-01T00:00:06.000Z',
    });

    const events: SagaEventDto[] = [
      makeEvent({ sagaEventId: 'r1', sagaId: 'root', sagaRootId: 'root', sagaStepName: 'init', sagaPublishedAt: '2024-01-01T00:00:00.000Z' }),
      makeEvent({ sagaEventId: 'c1', sagaId: 'child', sagaRootId: 'root', sagaParentId: 'root', sagaStepName: 'child-step', sagaPublishedAt: '2024-01-01T00:00:02.000Z' }),
    ];

    const result = eventsToWaterfallSpans(events, [root, child]);

    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0].trackId).toBe('root');
    expect(result.tracks[0].depth).toBe(0);
    expect(result.tracks[1].trackId).toBe('child');
    expect(result.tracks[1].depth).toBe(1);
  });

  it('marks RUNNING saga last span as estimated', () => {
    const saga = makeSaga({
      status: SagaStatus.RUNNING,
      endedAt: null,
    });
    const events: SagaEventDto[] = [
      makeEvent({ sagaEventId: 'evt-1', sagaStepName: 'step-1', sagaPublishedAt: '2024-01-01T00:00:00.000Z' }),
    ];

    const result = eventsToWaterfallSpans(events, [saga]);
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0].estimated).toBe(true);
  });
});
