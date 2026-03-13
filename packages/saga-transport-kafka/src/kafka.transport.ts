import { Kafka, Producer, Consumer, EachBatchPayload, IHeaders, logLevel } from 'kafkajs';
import type {
  SagaTransport,
  InboundMessage,
  OutboundMessage,
  TransportSubscribeOptions,
  SagaLogger,
} from '@saga/core';
import { ConsoleSagaLogger } from '@saga/core';
import { WatermarkTracker } from './watermark-tracker';
import type { KafkaTransportOptions } from './kafka-transport-options';

export class KafkaTransport implements SagaTransport {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer | null = null;
  private logger: SagaLogger;

  constructor(private options: KafkaTransportOptions) {
    this.logger = options.logger ?? new ConsoleSagaLogger();
    this.kafka = new Kafka({
      clientId: options.clientId ?? 'saga-client',
      brokers: options.brokers,
      ssl: options.ssl,
      sasl: options.sasl,
      connectionTimeout: options.connectionTimeout,
      authenticationTimeout: options.authenticationTimeout,
      requestTimeout: options.requestTimeout,
      retry: options.retry ?? {
        initialRetryTime: 300,
        retries: 10,
      },
      logLevel: options.logLevel ?? logLevel.WARN,
      socketFactory: options.socketFactory,
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  async publish(message: OutboundMessage): Promise<void> {
    await this.producer.send({
      topic: message.topic,
      messages: [
        {
          key: message.key,
          value: message.value,
          headers: message.headers,
        },
      ],
    });
  }

  async subscribe(
    topics: string[],
    handler: (message: InboundMessage) => Promise<void>,
    options?: TransportSubscribeOptions,
  ): Promise<void> {
    const groupId = options?.groupId ?? 'saga-default-group';

    if (this.options.autoCreateTopics) {
      await this.ensureTopicsExist(topics);
    }

    await this.connectConsumerWithRetry(groupId, topics, handler, options);
  }

  private async ensureTopicsExist(topics: string[]): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const existing = await admin.listTopics();
      const missing = topics.filter((t) => !existing.includes(t));
      if (missing.length > 0) {
        await admin.createTopics({
          topics: missing.map((t) => ({ topic: t, numPartitions: 3, replicationFactor: 1 })),
        });
      }
    } finally {
      await admin.disconnect();
    }
  }

  private async connectConsumerWithRetry(
    groupId: string,
    topics: string[],
    handler: (message: InboundMessage) => Promise<void>,
    options?: TransportSubscribeOptions,
    maxAttempts = 10,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.consumer = this.kafka.consumer({
          groupId,
          retry: { initialRetryTime: 500, retries: 8 },
        });

        await this.consumer.connect();

        for (const topic of topics) {
          await this.consumer.subscribe({
            topic,
            fromBeginning: options?.fromBeginning ?? false,
          });
        }

        await this.consumer.run({
          partitionsConsumedConcurrently: this.options.partitionsConsumedConcurrently ?? 3,
          eachBatch: async (payload: EachBatchPayload) => {
            await this.processBatch(payload, handler);
          },
        });

        return;
      } catch (err) {
        this.logger.warn(
          `[KafkaTransport] Consumer failed to start (attempt ${attempt}/${maxAttempts}): ${(err as Error).message}`,
        );

        try {
          await this.consumer?.disconnect();
        } catch {
          // ignore disconnect errors
        }
        this.consumer = null;

        if (attempt === maxAttempts) {
          throw err;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  private async processBatch(
    payload: EachBatchPayload,
    handler: (message: InboundMessage) => Promise<void>,
  ): Promise<void> {
    const { batch, resolveOffset, heartbeat, isRunning, isStale } = payload;
    const tracker = new WatermarkTracker();

    const offsets = batch.messages.map((m) => m.offset);
    tracker.reset(offsets);

    // Group messages by key (sagaId) for ordered processing within saga
    const groups = new Map<string, typeof batch.messages>();

    for (const message of batch.messages) {
      const key = message.key?.toString() ?? '__no_key__';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(message);
    }

    // Process groups in parallel, messages within each group sequentially
    await Promise.all(
      Array.from(groups.entries()).map(async ([, messages]) => {
        for (const message of messages) {
          if (!isRunning() || isStale()) {
            return;
          }

          const inbound: InboundMessage = {
            topic: batch.topic,
            key: message.key?.toString() ?? '',
            value: message.value?.toString() ?? '',
            headers: this.convertHeaders(message.headers),
          };

          await handler(inbound);

          tracker.markCompleted(message.offset);
          const committable = tracker.getCommittableOffset();
          if (committable) {
            resolveOffset(committable);
          }

          await heartbeat();
        }
      }),
    );
  }

  private convertHeaders(headers?: IHeaders): Record<string, string> {
    const result: Record<string, string> = {};
    if (!headers) return result;

    for (const [key, value] of Object.entries(headers)) {
      if (Buffer.isBuffer(value)) {
        result[key] = value.toString();
      } else if (typeof value === 'string') {
        result[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        result[key] = Buffer.isBuffer(first) ? first.toString() : String(first);
      }
    }

    return result;
  }
}
