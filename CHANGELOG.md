# Changelog

## 0.1.0-beta.4

### Breaking Changes

- **Message body now contains only the user payload.** `occurredAt` moved to the `saga-occurred-at` Kafka header. The topic is now derived from the Kafka message topic (`message.topic`), not from a header. The message body is no longer a JSON envelope — it is the raw user payload (e.g., `{"orderId":"456"}`). Consumers that previously read `body.topic`, `body.occurredAt`, or `body.payload` must now read `occurredAt` from the header, `topic` from the message topic, and treat the entire body as the payload.
- **`eventType` renamed to `topic`** — The `eventType` field in `EmitParams`, `SagaEvent`, and `IncomingEvent` has been renamed to `topic`. This also changes the wire format: the JSON message body now uses `"topic"` instead of `"eventType"`.
- **OTel span attribute `saga.event.type` renamed to `saga.topic`**.

### Migration

Replace `eventType` with `topic` in all emit calls and event handlers:

Before:

```typescript
await emit({ eventType: 'order.created', stepName: 'create', payload: { ... } });
```

After:

```typescript
await emit({ topic: 'order.created', stepName: 'create', payload: { ... } });
```

In handlers, `event.eventType` becomes `event.topic`.

## 0.1.0-beta.3

### Features

- **`SagaHealthIndicator`** — New injectable NestJS health check service that validates Kafka consumer connectivity via `consumer.describeGroup()`. Healthy states: `Stable`, `CompletingRebalance`, `PreparingRebalance`. Works with any health check framework (no `@nestjs/terminus` dependency).
- **`HealthCheckable` interface** — New optional interface for transports that support health checks. `KafkaTransport` implements it. Use `isHealthCheckable()` type guard for runtime detection.
- **`SagaRunner.healthCheck()`** — Delegates to the transport's health check if available.

## 0.1.0-beta.2

### Breaking Changes

- **`RunnerOptions.serviceName` replaced by `RunnerOptions.groupId`** — The `serviceName` field has been removed. Use `groupId` instead, which is passed directly to the transport's consumer group without any suffix.

### Migration

If you previously used `serviceName: 'my-service'`, replace it with `groupId: 'my-service-group'` to preserve the same consumer group ID.

Before:

```typescript
SagaModule.forRoot({
  serviceName: 'my-service',
  transport: new KafkaTransport({ ... }),
})
```

After:

```typescript
SagaModule.forRoot({
  groupId: 'my-service-group',
  transport: new KafkaTransport({ ... }),
})
```
