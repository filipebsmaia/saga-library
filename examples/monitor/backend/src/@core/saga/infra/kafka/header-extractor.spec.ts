import { describe, it, expect } from 'vitest';
import { extractSagaHeaders } from './header-extractor';

describe('extractSagaHeaders', () => {
  const fullHeaders: Record<string, Buffer | string> = {
    'saga-id': Buffer.from('saga-123'),
    'saga-root-id': Buffer.from('root-456'),
    'saga-parent-id': Buffer.from('parent-789'),
    'saga-causation-id': Buffer.from('cause-111'),
    'saga-event-id': Buffer.from('evt-222'),
    'saga-step-name': Buffer.from('process-payment'),
    'saga-step-description': Buffer.from('Processing payment'),
    'saga-event-hint': Buffer.from('step'),
    'saga-name': Buffer.from('OrderSaga'),
    'saga-description': Buffer.from('Order processing saga'),
    'saga-published-at': Buffer.from('2024-01-01T00:00:00.000Z'),
    'saga-schema-version': Buffer.from('1'),
  };

  it('should extract all headers from Buffer values', () => {
    const result = extractSagaHeaders(fullHeaders);

    expect(result).not.toBeNull();
    expect(result!.sagaId).toBe('saga-123');
    expect(result!.sagaRootId).toBe('root-456');
    expect(result!.sagaParentId).toBe('parent-789');
    expect(result!.sagaCausationId).toBe('cause-111');
    expect(result!.sagaEventId).toBe('evt-222');
    expect(result!.sagaStepName).toBe('process-payment');
    expect(result!.sagaStepDescription).toBe('Processing payment');
    expect(result!.sagaEventHint).toBe('step');
    expect(result!.sagaName).toBe('OrderSaga');
    expect(result!.sagaDescription).toBe('Order processing saga');
    expect(result!.sagaPublishedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result!.sagaSchemaVersion).toBe(1);
  });

  it('should extract headers from string values', () => {
    const stringHeaders: Record<string, string> = {
      'saga-id': 'saga-str',
      'saga-root-id': 'root-str',
      'saga-event-id': 'evt-str',
      'saga-step-name': 'step-name',
      'saga-event-hint': 'final',
      'saga-published-at': '2024-06-15T12:00:00.000Z',
      'saga-schema-version': '2',
    };

    const result = extractSagaHeaders(stringHeaders);

    expect(result).not.toBeNull();
    expect(result!.sagaId).toBe('saga-str');
    expect(result!.sagaEventHint).toBe('final');
    expect(result!.sagaSchemaVersion).toBe(2);
  });

  it('should return null when saga-id header is missing', () => {
    const headers: Record<string, Buffer | string | undefined> = {
      'saga-root-id': Buffer.from('root-456'),
      'saga-event-id': Buffer.from('evt-222'),
    };

    expect(extractSagaHeaders(headers)).toBeNull();
  });

  it('should return null when saga-id header is undefined', () => {
    const headers: Record<string, Buffer | string | undefined> = {
      'saga-id': undefined,
    };

    expect(extractSagaHeaders(headers)).toBeNull();
  });

  it('should use sagaId as default for missing optional ID fields', () => {
    const minimal: Record<string, Buffer | string> = {
      'saga-id': Buffer.from('saga-only'),
      'saga-event-id': Buffer.from('evt-1'),
      'saga-step-name': Buffer.from('step1'),
      'saga-published-at': Buffer.from('2024-01-01T00:00:00.000Z'),
      'saga-schema-version': Buffer.from('1'),
    };

    const result = extractSagaHeaders(minimal);

    expect(result).not.toBeNull();
    expect(result!.sagaRootId).toBe('saga-only');
    expect(result!.sagaCausationId).toBe('saga-only');
    expect(result!.sagaParentId).toBeUndefined();
    expect(result!.sagaName).toBeUndefined();
    expect(result!.sagaDescription).toBeUndefined();
    expect(result!.sagaStepDescription).toBeUndefined();
    expect(result!.sagaEventHint).toBeUndefined();
  });

  it('should handle all valid event hints', () => {
    const hints = ['step', 'compensation', 'final', 'fork'] as const;

    for (const hint of hints) {
      const headers: Record<string, string> = {
        'saga-id': 'id',
        'saga-event-hint': hint,
      };

      const result = extractSagaHeaders(headers);
      expect(result!.sagaEventHint).toBe(hint);
    }
  });

  it('should ignore invalid event hints', () => {
    const headers: Record<string, string> = {
      'saga-id': 'id',
      'saga-event-hint': 'invalid-hint',
    };

    const result = extractSagaHeaders(headers);
    expect(result!.sagaEventHint).toBeUndefined();
  });

  it('should default schema version to 1 when missing', () => {
    const headers: Record<string, string> = {
      'saga-id': 'id',
    };

    const result = extractSagaHeaders(headers);
    expect(result!.sagaSchemaVersion).toBe(1);
  });
});
