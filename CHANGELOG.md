# Changelog

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
