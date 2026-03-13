import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KafkaTransport } from '../src/kafka.transport';
import type { KafkaTransportOptions } from '../src/kafka-transport-options';

// Mock kafkajs
const mockProducerConnect = vi.fn().mockResolvedValue(undefined);
const mockProducerDisconnect = vi.fn().mockResolvedValue(undefined);
const mockProducerSend = vi.fn().mockResolvedValue(undefined);
const mockConsumerConnect = vi.fn().mockResolvedValue(undefined);
const mockConsumerDisconnect = vi.fn().mockResolvedValue(undefined);
const mockConsumerSubscribe = vi.fn().mockResolvedValue(undefined);
const mockConsumerRun = vi.fn().mockResolvedValue(undefined);
const mockAdminConnect = vi.fn().mockResolvedValue(undefined);
const mockAdminDisconnect = vi.fn().mockResolvedValue(undefined);
const mockAdminListTopics = vi.fn().mockResolvedValue([]);
const mockAdminCreateTopics = vi.fn().mockResolvedValue(undefined);

vi.mock('kafkajs', () => ({
  logLevel: { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 4, DEBUG: 5 },
  Kafka: vi.fn().mockImplementation(() => ({
    producer: () => ({
      connect: mockProducerConnect,
      disconnect: mockProducerDisconnect,
      send: mockProducerSend,
    }),
    consumer: () => ({
      connect: mockConsumerConnect,
      disconnect: mockConsumerDisconnect,
      subscribe: mockConsumerSubscribe,
      run: mockConsumerRun,
    }),
    admin: () => ({
      connect: mockAdminConnect,
      disconnect: mockAdminDisconnect,
      listTopics: mockAdminListTopics,
      createTopics: mockAdminCreateTopics,
    }),
  })),
}));

describe('KafkaTransport', () => {
  let transport: KafkaTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new KafkaTransport({
      brokers: ['localhost:9092'],
      clientId: 'test-client',
    });
  });

  describe('connect', () => {
    it('should connect the producer', async () => {
      await transport.connect();
      expect(mockProducerConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('should disconnect the producer', async () => {
      await transport.disconnect();
      expect(mockProducerDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect the consumer if subscribed', async () => {
      await transport.subscribe(['topic1'], async () => {}, { groupId: 'test-group' });
      await transport.disconnect();
      expect(mockConsumerDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('publish', () => {
    it('should send a message via the producer', async () => {
      await transport.publish({
        topic: 'saga.order.created',
        key: 'saga-123',
        value: '{"eventType":"order.created"}',
        headers: { 'saga-id': 'saga-123' },
      });

      expect(mockProducerSend).toHaveBeenCalledWith({
        topic: 'saga.order.created',
        messages: [
          {
            key: 'saga-123',
            value: '{"eventType":"order.created"}',
            headers: { 'saga-id': 'saga-123' },
          },
        ],
      });
    });
  });

  describe('subscribe', () => {
    it('should create a consumer, subscribe, and run', async () => {
      const handler = vi.fn();

      await transport.subscribe(['topic1', 'topic2'], handler, {
        groupId: 'test-group',
        fromBeginning: true,
      });

      expect(mockConsumerConnect).toHaveBeenCalledTimes(1);
      expect(mockConsumerSubscribe).toHaveBeenCalledTimes(2);
      expect(mockConsumerSubscribe).toHaveBeenCalledWith({
        topic: 'topic1',
        fromBeginning: true,
      });
      expect(mockConsumerSubscribe).toHaveBeenCalledWith({
        topic: 'topic2',
        fromBeginning: true,
      });
      expect(mockConsumerRun).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionsConsumedConcurrently: 3,
          eachBatch: expect.any(Function),
        }),
      );
    });

    it('should use custom partitionsConsumedConcurrently', async () => {
      const customTransport = new KafkaTransport({
        brokers: ['localhost:9092'],
        partitionsConsumedConcurrently: 5,
      });

      await customTransport.subscribe(['topic1'], async () => {}, { groupId: 'test-group' });

      expect(mockConsumerRun).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionsConsumedConcurrently: 5,
        }),
      );
    });
  });

  describe('batch processing', () => {
    it('should group messages by key and process sequentially within group', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const resolveOffset = vi.fn();
      const heartbeat = vi.fn().mockResolvedValue(undefined);

      // Capture the eachBatch handler
      let eachBatchHandler: Function;
      mockConsumerRun.mockImplementation(async (config: any) => {
        eachBatchHandler = config.eachBatch;
      });

      await transport.subscribe(['saga.order.created'], handler, { groupId: 'test-group' });

      // Simulate a batch with messages from two different sagas
      await eachBatchHandler!({
        batch: {
          topic: 'saga.order.created',
          messages: [
            { key: Buffer.from('saga-1'), value: Buffer.from('{"eventType":"e1"}'), offset: '0', headers: {} },
            { key: Buffer.from('saga-2'), value: Buffer.from('{"eventType":"e2"}'), offset: '1', headers: {} },
            { key: Buffer.from('saga-1'), value: Buffer.from('{"eventType":"e3"}'), offset: '2', headers: {} },
          ],
        },
        resolveOffset,
        heartbeat,
        isRunning: () => true,
        isStale: () => false,
      });

      expect(handler).toHaveBeenCalledTimes(3);
      expect(heartbeat).toHaveBeenCalledTimes(3);

      // All offsets should be resolved since all completed
      expect(resolveOffset).toHaveBeenCalled();
    });

    it('should stop processing when isRunning returns false', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const resolveOffset = vi.fn();
      const heartbeat = vi.fn().mockResolvedValue(undefined);

      let eachBatchHandler: Function;
      mockConsumerRun.mockImplementation(async (config: any) => {
        eachBatchHandler = config.eachBatch;
      });

      await transport.subscribe(['saga.order.created'], handler, { groupId: 'test-group' });

      let callCount = 0;
      await eachBatchHandler!({
        batch: {
          topic: 'saga.order.created',
          messages: [
            { key: Buffer.from('saga-1'), value: Buffer.from('{"eventType":"e1"}'), offset: '0', headers: {} },
            { key: Buffer.from('saga-1'), value: Buffer.from('{"eventType":"e2"}'), offset: '1', headers: {} },
          ],
        },
        resolveOffset,
        heartbeat,
        isRunning: () => {
          callCount++;
          return callCount <= 1;
        },
        isStale: () => false,
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should convert Buffer headers to strings', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const resolveOffset = vi.fn();
      const heartbeat = vi.fn().mockResolvedValue(undefined);

      let eachBatchHandler: Function;
      mockConsumerRun.mockImplementation(async (config: any) => {
        eachBatchHandler = config.eachBatch;
      });

      await transport.subscribe(['saga.order.created'], handler, { groupId: 'test-group' });

      await eachBatchHandler!({
        batch: {
          topic: 'saga.order.created',
          messages: [
            {
              key: Buffer.from('saga-1'),
              value: Buffer.from('{"eventType":"e1"}'),
              offset: '0',
              headers: {
                'saga-id': Buffer.from('saga-123'),
                'plain-header': 'plain-value',
              },
            },
          ],
        },
        resolveOffset,
        heartbeat,
        isRunning: () => true,
        isStale: () => false,
      });

      const inboundMsg = handler.mock.calls[0][0];
      expect(inboundMsg.headers['saga-id']).toBe('saga-123');
      expect(inboundMsg.headers['plain-header']).toBe('plain-value');
    });
  });
});
