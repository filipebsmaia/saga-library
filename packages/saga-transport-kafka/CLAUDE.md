# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build       # tsup → dist/index.js (ESM) + dist/index.cjs (CJS) + declarations
pnpm dev         # tsup --watch
pnpm typecheck   # tsc --noEmit
```

Tests are run from the **monorepo root**:
```bash
pnpm vitest run packages/saga-transport-kafka
```

## Architecture

This package implements the `SagaTransport` interface from `@fbsm/saga-core` using KafkaJS.

### Files

- `kafka.transport.ts` — Main class. Owns the KafkaJS `Kafka`, `Producer`, and `Consumer` instances.
- `kafka-transport-options.ts` — Configuration interface extending KafkaJS options.
- `watermark-tracker.ts` — Offset commit strategy.

### Consumption: eachBatch + key-based grouping

The transport subscribes using KafkaJS `eachBatch` (not `eachMessage`). Within each batch:

1. Messages are **grouped by key** (Kafka message key = `rootSagaId` by default).
2. Groups are processed **in parallel** — different saga trees run concurrently.
3. Within each group, messages are processed **sequentially** — preserving event order within a saga tree.

This is the core throughput/ordering trade-off: parallelism across saga trees, ordering within.

### Watermark-based offset tracking (`WatermarkTracker`)

The challenge with parallel group processing: if message at offset 5 finishes before offset 3, committing offset 6 would skip offset 3 on restart.

`WatermarkTracker` solves this:
- Tracks every in-flight offset.
- On each completion, finds the **lowest offset that is still in-flight** and commits everything below it.
- This "watermark" advances only when all prior offsets are done.

The tracker operates per partition (keyed by `topic:partition`).

### Topic naming

Topics are named `topicPrefix + eventType`. The prefix is set in `KafkaTransportOptions` and passed through from `RunnerOptions.topicPrefix`. Both the producer (publish) and consumer (subscribe) apply the same prefix.

### Auto-create topics

When `autoCreateTopics: true`, `connect()` calls the Kafka admin client to create any topics that don't exist before starting the consumer. Intended for development only.

### Header serialization

All saga metadata (`saga-id`, `saga-root-id`, etc.) is written as Kafka message headers with `Buffer.from(value)`. On the consumer side, header values are decoded from `Buffer | string` to plain strings before being passed to `SagaParser`.
