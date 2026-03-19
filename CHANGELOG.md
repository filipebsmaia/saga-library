# Changelog

## 0.2.0-beta.1

### Breaking Changes

- **`@SagaParticipant(topics, options?)` is now the primary entry point.** The decorator now requires topics as the first argument. `@SagaParticipant()` (no-arg) no longer exists.
- **`@SagaHandler` removed entirely.** Topic binding is now done at the class level via `@SagaParticipant("topic")`. Handler logic goes in the mandatory `handle()` method.
- **`SagaParticipantBase.serviceId` removed.** `serviceId` is auto-derived from the class name (e.g., `PaymentParticipant` → `"PaymentParticipant"`). No manual declaration needed.
- **`SagaParticipantBase.on` removed.** The `on` record was an internal detail; the provider now reads topics from decorator metadata.
- **`SagaParticipantBase.handle()` is now abstract and mandatory.** All participants must implement `handle(event, emit)`.
- **Multi-handler participants must be split.** Classes that previously had multiple `@SagaHandler` methods must be split into separate classes (one class per topic or topic group with same options).
- **`RouteEntry` redesigned.** Fields renamed from `participant`/`handler`/`options` to `sagaParticipant`/`sagaHandler`/`sagaOptions`. Supports both saga and plain handlers per topic.

### Features

- **`onFail()` error hook.** Optional method on `SagaParticipantBase` called when `handle()` throws a non-retryable error. `onFail` retries independently (same retry policy). If `onFail` retries are exhausted, `onRetryExhausted` is called with `onFail`'s error.
- **`@MessageHandler(topics)` decorator.** Method decorator for consuming non-saga (plain) messages. Routes messages without saga headers to the decorated method. Same topic can have both a saga handler and a plain handler — routing is per-message.
- **`PlainMessage` type.** New interface for plain messages: `{ topic, key, payload, headers, timestamp? }`. No saga fields.
- **Per-message routing in `SagaRunner`.** The runner now routes each message based on whether `SagaParser` finds saga metadata: saga messages → `handle()`, plain messages → `@MessageHandler`.

### Migration

1. Move topic declarations: `@SagaHandler("topic")` → `@SagaParticipant("topic")`
2. Rename handler methods to `handle()`
3. Remove `readonly serviceId = "..."` — now auto-derived from class name
4. Split multi-handler classes into separate single-topic classes
5. Remove `SagaHandler` imports
6. Implement `onFail()` where you previously caught non-retryable errors inside handlers
7. For non-saga messages: use `@MessageHandler("topic")` on a method

Before:

```typescript
@Injectable()
@SagaParticipant()
export class PaymentParticipant extends SagaParticipantBase {
  readonly serviceId = "payment-service";

  @SagaHandler("order.created")
  async handleOrderCreated(event: IncomingEvent, emit: Emit) { ... }
}
```

After:

```typescript
@Injectable()
@SagaParticipant("order.created")
export class PaymentParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit) { ... }
}
```

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
