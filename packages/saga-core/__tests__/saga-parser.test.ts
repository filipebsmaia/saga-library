import { describe, it, expect, vi } from 'vitest';
import { SagaParser } from '../src/parser/saga-parser';
import { NoopOtelContext } from '../src/otel/otel-context';
import type { InboundMessage } from '../src/transport/transport.interface';
import type { OtelContext } from '../src/otel/otel-context';

const noopOtel = new NoopOtelContext();

function makeMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    topic: 'saga.order.created',
    key: 'saga-123',
    value: JSON.stringify({
      eventType: 'order.created',
      occurredAt: '2024-01-01T00:00:00.000Z',
      payload: { orderId: '456' },
    }),
    headers: {},
    ...overrides,
  };
}

describe('SagaParser', () => {
  describe('Layer 1: Headers present', () => {
    it('should parse event from saga headers + body', () => {
      const parser = new SagaParser(noopOtel);
      const message = makeMessage({
        headers: {
          'saga-id': 'saga-123',
          'saga-causation-id': 'cause-789',
          'saga-event-id': 'evt-001',
          'saga-step-name': 'order',
          'saga-published-at': '2024-01-01T00:00:01.000Z',
          'saga-schema-version': '1',
          'saga-root-id': 'root-100',
          'saga-parent-id': 'parent-200',
        },
      });

      const event = parser.parse(message);

      expect(event).not.toBeNull();
      expect(event!.sagaId).toBe('saga-123');
      expect(event!.causationId).toBe('cause-789');
      expect(event!.eventId).toBe('evt-001');
      expect(event!.eventType).toBe('order.created');
      expect(event!.stepName).toBe('order');
      expect(event!.occurredAt).toBe('2024-01-01T00:00:00.000Z');
      expect(event!.publishedAt).toBe('2024-01-01T00:00:01.000Z');
      expect(event!.schemaVersion).toBe(1);
      expect(event!.rootSagaId).toBe('root-100');
      expect(event!.parentSagaId).toBe('parent-200');
      expect(event!.payload).toEqual({ orderId: '456' });
    });

    it('should default optional header fields', () => {
      const parser = new SagaParser(noopOtel);
      const message = makeMessage({
        headers: {
          'saga-id': 'saga-123',
          'saga-step-name': 'order',
        },
      });

      const event = parser.parse(message);

      expect(event).not.toBeNull();
      expect(event!.causationId).toBe('saga-123');
      expect(event!.eventId).toMatch(/^[0-9a-f-]{36}$/);
      expect(event!.rootSagaId).toBe('saga-123');
      expect(event!.parentSagaId).toBeUndefined();
    });
  });

  describe('Layer 2: Baggage present', () => {
    it('should parse from baggage header when saga-id is absent', () => {
      const parser = new SagaParser(noopOtel);
      const message = makeMessage({
        headers: {
          baggage: 'saga.id=saga-123,saga.root.id=root-100,saga.parent.id=parent-200',
        },
      });

      const event = parser.parse(message);

      expect(event).not.toBeNull();
      expect(event!.sagaId).toBe('saga-123');
      expect(event!.rootSagaId).toBe('root-100');
      expect(event!.parentSagaId).toBe('parent-200');
      expect(event!.eventType).toBe('order.created');
      expect(event!.payload).toEqual({ orderId: '456' });
    });

    it('should parse from OTel context when baggage header is absent', () => {
      const mockOtel: OtelContext = {
        injectBaggage: vi.fn(),
        extractBaggage: vi.fn().mockReturnValue({
          sagaId: 'otel-saga-123',
          rootSagaId: 'otel-root-100',
          parentSagaId: undefined,
        }),
        enrichSpan: vi.fn(),
      };

      const parser = new SagaParser(mockOtel);
      const message = makeMessage({ headers: {} });

      const event = parser.parse(message);

      expect(event).not.toBeNull();
      expect(event!.sagaId).toBe('otel-saga-123');
      expect(event!.rootSagaId).toBe('otel-root-100');
      expect(event!.parentSagaId).toBeUndefined();
    });
  });

  describe('Layer 3: Legacy full envelope in body', () => {
    it('should parse when body contains full SagaEvent', () => {
      const parser = new SagaParser(noopOtel);
      const legacyBody = {
        sagaId: 'saga-123',
        causationId: 'cause-789',
        eventId: 'evt-001',
        eventType: 'order.created',
        stepName: 'order',
        occurredAt: '2024-01-01T00:00:00.000Z',
        publishedAt: '2024-01-01T00:00:01.000Z',
        schemaVersion: 1,
        rootSagaId: 'root-100',
        payload: { orderId: '456' },
      };

      const message: InboundMessage = {
        topic: 'saga.order.created',
        key: 'saga-123',
        value: JSON.stringify(legacyBody),
        headers: {},
      };

      const event = parser.parse(message);

      expect(event).not.toBeNull();
      expect(event!.sagaId).toBe('saga-123');
      expect(event!.eventType).toBe('order.created');
      expect(event!.payload).toEqual({ orderId: '456' });
    });
  });

  describe('Error handling', () => {
    it('should return null for malformed JSON body', () => {
      const parser = new SagaParser(noopOtel);
      const message: InboundMessage = {
        topic: 'saga.order.created',
        key: 'saga-123',
        value: 'not-json',
        headers: {},
      };

      const event = parser.parse(message);
      expect(event).toBeNull();
    });

    it('should return null when no layer matches', () => {
      const parser = new SagaParser(noopOtel);
      const message: InboundMessage = {
        topic: 'saga.order.created',
        key: 'saga-123',
        value: JSON.stringify({ unrelated: true }),
        headers: {},
      };

      const event = parser.parse(message);
      expect(event).toBeNull();
    });
  });

  describe('Priority', () => {
    it('should prefer Layer 1 (headers) over Layer 3 (body envelope)', () => {
      const parser = new SagaParser(noopOtel);
      const message: InboundMessage = {
        topic: 'saga.order.created',
        key: 'saga-123',
        value: JSON.stringify({
          sagaId: 'body-saga-id',
          eventType: 'order.created',
          occurredAt: '2024-01-01T00:00:00.000Z',
          payload: { orderId: '456' },
        }),
        headers: {
          'saga-id': 'header-saga-id',
          'saga-step-name': 'order',
        },
      };

      const event = parser.parse(message);

      expect(event).not.toBeNull();
      expect(event!.sagaId).toBe('header-saga-id');
    });
  });
});
