# Custom Transport

Implement the `SagaTransport` interface to use any message broker (RabbitMQ, Redis Streams, NATS, etc.).

## SagaTransport Interface

```typescript
import type {
  SagaTransport,
  OutboundMessage,
  InboundMessage,
  TransportSubscribeOptions,
} from "@fbsm/saga-core";
```

```typescript
interface SagaTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(message: OutboundMessage): Promise<void>;
  subscribe(
    topics: string[],
    handler: (message: InboundMessage) => Promise<void>,
    options?: TransportSubscribeOptions,
  ): Promise<void>;
}
```

## Message Types

```typescript
interface OutboundMessage {
  topic: string; // Event type (with optional prefix)
  key: string; // Partition/routing key (default: rootSagaId)
  value: string; // JSON-serialized user payload only (no envelope)
  headers: Record<string, string>; // All saga metadata headers (including saga-occurred-at)
}

interface InboundMessage {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
}

interface TransportSubscribeOptions {
  fromBeginning?: boolean;
  groupId?: string;
}
```

## Implementation Guide

1. **`connect()`** — Establish connection to your broker.
2. **`subscribe(topics, handler, options)`** — Create consumers for each topic, call `handler` for each message. Respect `groupId` for consumer groups and `fromBeginning` for offset strategy.
3. **`publish(message)`** — Send message to `message.topic`. Propagate `message.headers` and use `message.key` for partitioning/ordering.
4. **`disconnect()`** — Gracefully close connections.

## Example Skeleton

```typescript
import type {
  SagaTransport,
  OutboundMessage,
  InboundMessage,
  TransportSubscribeOptions,
} from "@fbsm/saga-core";

export class RedisStreamsTransport implements SagaTransport {
  constructor(private redisUrl: string) {}

  async connect(): Promise<void> {
    // Connect to Redis
  }

  async disconnect(): Promise<void> {
    // Close connections
  }

  async publish(message: OutboundMessage): Promise<void> {
    // XADD to stream named message.topic
    // Include message.headers as field-value pairs
    // Use message.key for consumer group routing
  }

  async subscribe(
    topics: string[],
    handler: (message: InboundMessage) => Promise<void>,
    options?: TransportSubscribeOptions,
  ): Promise<void> {
    // Create consumer group (options.groupId)
    // XREADGROUP from each topic stream
    // Parse messages and call handler()
  }
}
```

## Message Format

The message body (`value`) contains **only the user's payload** as JSON (e.g., `{"orderId":"456"}`). Saga metadata such as `saga-occurred-at` (ISO timestamp) is transmitted via `headers`. The topic is derived from the message's topic field (e.g., `message.topic` in Kafka), not from a header. Your transport must preserve headers faithfully for `SagaParser` to reconstruct the full event.

## Important Notes

- Headers must be propagated faithfully (they contain saga context metadata).
- The `key` field should be used for ordering guarantees (messages with the same key should be processed sequentially).
- The library expects at-least-once delivery semantics.
- See [@fbsm/saga-transport-kafka](../saga-transport-kafka/README.md) for a production reference implementation.

[Documentation Hub](README.md)
