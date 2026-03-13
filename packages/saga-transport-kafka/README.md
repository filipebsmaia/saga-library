# @saga/transport-kafka

KafkaJS-based transport adapter for `@saga/core`. Provides `eachBatch` consumption, key-based message grouping, and watermark-based offset tracking.

## Installation

```bash
npm install @saga/transport-kafka kafkajs
```

## Usage

### With NestJS (`@saga/nestjs`)

```typescript
import { Module } from '@nestjs/common';
import { SagaModule } from '@saga/nestjs';
import { KafkaTransport } from '@saga/transport-kafka';

@Module({
  imports: [
    SagaModule.forRoot({
      serviceName: 'my-service',
      transport: new KafkaTransport({
        brokers: ['localhost:9092'],
        clientId: 'my-service',
        autoCreateTopics: true,
      }),
    }),
  ],
})
export class AppModule {}
```

### Standalone (without NestJS)

```typescript
import { SagaPublisher, SagaRunner, SagaRegistry, SagaParser, createOtelContext } from '@saga/core';
import { KafkaTransport } from '@saga/transport-kafka';

const transport = new KafkaTransport({
  brokers: ['localhost:9092'],
  clientId: 'my-service',
});

const otelCtx = createOtelContext();
const registry = new SagaRegistry();
const parser = new SagaParser();
const publisher = new SagaPublisher(transport, otelCtx);
const runner = new SagaRunner(registry, transport, publisher, parser, {
  serviceName: 'my-service',
});

// Register participants...
// registry.register(participant);

await runner.start();
```

## API Reference

### `KafkaTransport`

```typescript
import { KafkaTransport } from '@saga/transport-kafka';

const transport = new KafkaTransport({
  brokers: ['localhost:9092'],
  clientId: 'my-service',
  ssl: true,
  sasl: {
    mechanism: 'scram-sha-256',
    username: 'user',
    password: 'pass',
  },
  partitionsConsumedConcurrently: 3,
  autoCreateTopics: true,
});
```

### `KafkaTransportOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `brokers` | `string[]` | — | Kafka broker addresses (**required**) |
| `clientId` | `string` | `'saga-client'` | Client identifier |
| `ssl` | `tls.ConnectionOptions \| boolean` | — | TLS/SSL config. Pass `true` for default TLS |
| `sasl` | `SASLOptions` | — | SASL auth (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER, AWS) |
| `connectionTimeout` | `number` | `1000` | Connection timeout (ms) |
| `authenticationTimeout` | `number` | — | Authentication timeout (ms) |
| `requestTimeout` | `number` | — | Request timeout (ms) |
| `retry` | `RetryOptions` | `{ initialRetryTime: 300, retries: 10 }` | KafkaJS client retry policy |
| `logLevel` | `logLevel` | `WARN` | KafkaJS log level |
| `socketFactory` | `ISocketFactory` | — | Custom socket factory (e.g., SOCKS proxy) |
| `partitionsConsumedConcurrently` | `number` | `3` | Partitions consumed concurrently |
| `enableOtelInstrumentation` | `boolean` | — | Register KafkaJS OTel instrumentation |
| `autoCreateTopics` | `boolean` | `false` | Auto-create missing topics via admin client |
| `logger` | `SagaLogger` | `ConsoleSagaLogger` | Custom logger |

## Features

### eachBatch with Key-Based Grouping

Messages are consumed via KafkaJS `eachBatch` for high throughput. Within each batch, messages are grouped by key (default: `rootSagaId`):

- **Parallel** across different keys (different saga trees)
- **Sequential** within the same key (same saga tree)

This ensures event ordering within a saga while maximizing throughput.

### Watermark-Based Offset Tracking

Offsets are committed using a watermark strategy: only the lowest unprocessed offset is committed. This prevents message loss if a later message in the batch completes before an earlier one.

### Topic Naming

Topics are derived from event types with an optional prefix:

```
topic = topicPrefix + eventType
```

Example with `topicPrefix: 'prod.'`:
- `order.created` → topic `prod.order.created`
- `payment.completed` → topic `prod.payment.completed`

### Auto-Create Topics

When `autoCreateTopics: true`, the transport uses the Kafka admin client to create any missing topics before subscribing. Useful for development environments.

### Header-Based Metadata

All saga context metadata is propagated via Kafka headers. See [Kafka Headers](../saga-core/README.md#kafka-headers) for the full list.

---

## Further Reading

- [@saga/core](../saga-core/README.md) — Core library reference
- [@saga/nestjs](../saga-nestjs/README.md) — NestJS integration
- [Custom Transport](../doc/custom-transport.md) — Implement your own transport
