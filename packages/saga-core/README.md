# @fbsm/saga-core

Framework-agnostic core library for saga choreography. Provides the runner, publisher, parser, registry, context management, and error types.

## Installation

```bash
npm install @fbsm/saga-core
```

## Overview

| Export          | Description                                              |
| --------------- | -------------------------------------------------------- |
| `SagaPublisher` | Creates sagas and publishes events                       |
| `SagaRunner`    | Consumes events, dispatches to handlers with retry logic |
| `SagaRegistry`  | Stores participant and handler mappings                  |
| `SagaParser`    | Parses inbound messages (3-layer fallback)               |
| `SagaContext`   | AsyncLocalStorage-based context propagation              |

## SagaContext

Uses `AsyncLocalStorage` to propagate saga metadata through async call chains.

```typescript
import { SagaContext } from "@fbsm/saga-core";

// Read current context (or undefined)
const ctx = SagaContext.current();

// Read current context (throws SagaContextNotFoundError if missing)
const ctx = SagaContext.require();
// ctx.sagaId, ctx.rootSagaId, ctx.parentSagaId, ctx.causationId, ctx.key
```

**`SagaContextData`**:

```typescript
interface SagaContextData {
  sagaId: string;
  rootSagaId: string;
  parentSagaId?: string;
  causationId: string;
  key?: string;
  sagaName?: string;
  sagaDescription?: string;
}
```

Context is set automatically by:

1. **`SagaRunner`** — wraps every handler execution with `SagaContext.run()`
2. **`SagaPublisher.start(fn)` / `startChild(fn)` / `emitToParent(fn)`** — wraps callbacks with `SagaContext.run()`

## SagaPublisher

Creates sagas and publishes events. See [Core Functions](../doc/core-functions.md) for detailed usage of each method.

```typescript
import { SagaPublisher } from "@fbsm/saga-core";

const publisher = new SagaPublisher(transport, otelContext, topicPrefix);
```

| Method                                            | Description                           |
| ------------------------------------------------- | ------------------------------------- |
| `start(fn, opts?)`                                | Context-aware: creates child if inside existing context, root otherwise |
| `startChild(fn, opts?)`                           | Create a child saga linked to current |
| `emit(params)`                                    | Publish event in current context      |
| `emitToParent(params \| fn)`                      | Emit to parent saga                   |
| `forSaga(sagaId, parentCtx?, causationId?, key?)` | Get bound `Emit` function (no ALS)    |

**`SagaStartOptions`**:

```typescript
interface SagaStartOptions {
  sagaName?: string;
  sagaDescription?: string;
  key?: string;
  independent?: boolean; // Force root saga even inside existing context
}
```

## SagaRunner

Consumes events from transport, routes to handlers, and applies retry logic.

```typescript
import { SagaRunner } from "@fbsm/saga-core";

const runner = new SagaRunner(
  registry, // SagaRegistry
  transport, // SagaTransport
  publisher, // SagaPublisher
  parser, // SagaParser
  options, // RunnerOptions
  otelContext, // OtelContext (optional)
  logger, // SagaLogger (optional)
);

await runner.start(); // Subscribe and begin consuming
await runner.stop(); // Disconnect

// Health check (delegates to transport if it implements HealthCheckable)
const health = await runner.healthCheck();
// { status: 'up' | 'down', details?: { consumerGroupState, groupId, memberCount } }
```

**`RunnerOptions`**:

```typescript
interface RunnerOptions {
  groupId: string;
  fromBeginning?: boolean;
  topicPrefix?: string;
  retryPolicy?: {
    maxRetries?: number; // default: 3
    initialDelayMs?: number; // default: 200
  };
}
```

**Handler execution flow**:

1. Parse inbound message via `SagaParser` — if parsed (saga metadata found), route to saga handler; if null (no metadata), route to plain handler
2. Look up handler in route map (`RouteEntry` supports both `sagaHandler` and `plainHandler` per topic)
3. **Saga path**: Wrap emit with `final` hint (if `{ final: true }`), fork logic (if `{ fork: true }`), set `SagaContext` via `AsyncLocalStorage`
4. Execute handler with retry on `SagaRetryableError`
5. On non-retryable error: call `participant.onFail()` if defined (with independent retry)
6. On retry exhaustion (from handle or onFail): call `participant.onRetryExhausted()` if defined
7. **Plain path**: Parse payload, call `plainHandler(PlainMessage)` — no context, no emit, no retry

## SagaParser

Parses inbound messages using a 3-layer fallback strategy:

1. **Headers** — `saga-id` header present → metadata from headers (including `saga-occurred-at`), body is the raw user payload. Topic is derived from the message's topic field
2. **W3C Baggage** — OpenTelemetry baggage present → extract saga context from baggage items
3. **Legacy envelope** — Body contains `sagaId` field → full envelope in message body

## Kafka Headers

When using the header-based format (default with `@fbsm/saga-transport-kafka`):

| Header                  | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `saga-id`               | Saga instance ID                                       |
| `saga-event-id`         | Unique event ID                                        |
| `saga-causation-id`     | ID of the event that caused this one                   |
| `saga-occurred-at`      | ISO timestamp of when the event occurred               |
| `saga-step-name`        | Logical step name                                      |
| `saga-published-at`     | ISO timestamp of publication                           |
| `saga-schema-version`   | Schema version (currently `1`)                         |
| `saga-root-id`          | Root saga ID (top-level ancestor)                      |
| `saga-parent-id`        | Parent saga ID (for sub-sagas, optional)               |
| `saga-event-hint`       | Event hint: `compensation`, `final`, `fork` (optional) |
| `saga-name`             | Saga name (optional)                                   |
| `saga-description`      | Saga description (optional)                            |
| `saga-step-description` | Step description (optional)                            |
| `saga-key`              | Partition key (optional)                               |

**Message body**: The Kafka message body contains **only the user's payload** (e.g., `{"orderId":"456"}`). Event metadata such as `occurredAt` is transmitted via the headers listed above, not in the body. The topic is derived from the Kafka message topic (i.e., `message.topic`), not from a header.

## Errors

| Error                            | Description                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `SagaError`                      | Base error class for all saga errors                                                                        |
| `SagaRetryableError`             | Throw in handlers to trigger retry with exponential backoff. `new SagaRetryableError(message, maxRetries?)` |
| `SagaDuplicateHandlerError`      | Two handlers registered for the same topic                                                                  |
| `SagaParseError`                 | Message parsing failed                                                                                      |
| `SagaTransportNotConnectedError` | Publishing to a disconnected transport                                                                      |
| `SagaContextNotFoundError`       | `emit()`/`startChild()`/`emitToParent()` called outside a saga context                                      |
| `SagaNoParentError`              | `emitToParent()` called in a saga without `parentSagaId`                                                    |
| `SagaInvalidHandlerConfigError`  | Handler has conflicting options (e.g., both `final` and `fork`)                                             |

**Retry behavior**: `SagaRetryableError` triggers exponential backoff: `initialDelayMs * 2^attempt`. After `maxRetries` attempts, `onRetryExhausted()` is called if defined. Non-retryable errors are routed to `onFail()` if defined; otherwise logged and skipped.

**Error flow**:

```
handle(event, emit)
  ├── SUCCESS → done
  ├── throws SagaRetryableError → retry → exhausted → onRetryExhausted?
  └── throws non-retryable Error
        ├── onFail defined → call onFail (retries independently)
        │     ├── onFail succeeds → done
        │     ├── onFail retries exhausted → onRetryExhausted?
        │     └── onFail throws non-retryable → log → done
        └── onFail not defined → log → done
```

## OTel Integration

```typescript
import {
  createOtelContext,
  W3cOtelContext,
  NoopOtelContext,
} from "@fbsm/saga-core";

// Auto-detect: uses W3cOtelContext if @opentelemetry/api is available, NoopOtelContext otherwise
const otelCtx = createOtelContext();

// Or explicitly:
const otelCtx = new W3cOtelContext(); // requires @opentelemetry/api
const otelCtx = new NoopOtelContext(); // no-op (no tracing)
```

The OTel context:

- Injects W3C baggage with saga context into outgoing messages
- Extracts trace context from incoming message headers
- Creates spans for publish and handle operations
- Enriches spans with saga attributes

## SagaTransport Interface

Implement this interface to use any message broker. See [Custom Transport](../doc/custom-transport.md) for a full guide.

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

## Health Checks

Transports can optionally implement the `HealthCheckable` interface to support health checks.

```typescript
import { isHealthCheckable } from "@fbsm/saga-core";
import type { HealthCheckable, TransportHealthResult } from "@fbsm/saga-core";

// Check if a transport supports health checks
if (isHealthCheckable(transport)) {
  const result: TransportHealthResult = await transport.healthCheck();
  // result.status: 'up' | 'down'
  // result.details: transport-specific details
}

// Or use SagaRunner.healthCheck() which delegates automatically
const health = await runner.healthCheck();
```

`KafkaTransport` from `@fbsm/saga-transport-kafka` implements `HealthCheckable` using `consumer.describeGroup()`. Healthy states: `Stable`, `CompletingRebalance`, `PreparingRebalance`.

## SagaLogger

```typescript
interface SagaLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

Default: `ConsoleSagaLogger` (wraps `console.log/warn/error`).

---

## Further Reading

- [Concepts](../doc/concepts.md) — sagaId, hint, topic, and other domain terms
- [Core Functions](../doc/core-functions.md) — emit, emitToParent, start, startChild, forSaga
- [@fbsm/saga-nestjs](../saga-nestjs/README.md) — NestJS decorators and auto-discovery
- [@fbsm/saga-transport-kafka](../saga-transport-kafka/README.md) — Kafka transport
