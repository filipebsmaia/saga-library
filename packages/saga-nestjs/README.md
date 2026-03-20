# @fbsm/saga-nestjs

NestJS integration for the saga choreography library. Provides a dynamic module, decorators for auto-discovery, and injectable providers.

## Installation

```bash
npm install @fbsm/saga-nestjs @fbsm/saga-core @fbsm/saga-transport-kafka
```

## API Reference

### `SagaModule`

Dynamic NestJS module. Register once globally.

```typescript
// Synchronous
SagaModule.forRoot(options: SagaModuleOptions): DynamicModule

// Asynchronous (e.g., with ConfigService)
SagaModule.forRootAsync(options: SagaModuleAsyncOptions): DynamicModule
```

**`SagaModuleOptions`** (extends `RunnerOptions`):

| Field                        | Type            | Default             | Description                                              |
| ---------------------------- | --------------- | ------------------- | -------------------------------------------------------- |
| `groupId`                    | `string`        | —                   | Kafka consumer group ID                                  |
| `transport`                  | `SagaTransport` | —                   | Transport implementation (e.g., `KafkaTransport`)        |
| `retryPolicy.maxRetries`     | `number`        | `3`                 | Max retry attempts for `SagaRetryableError`              |
| `retryPolicy.initialDelayMs` | `number`        | `200`               | Initial retry delay in ms (doubles each attempt)         |
| `fromBeginning`              | `boolean`       | `false`             | Read from beginning of topics                            |
| `topicPrefix`                | `string`        | `''`                | Prefix prepended to topic for topic names                |
| `otel.enabled`               | `boolean`       | `false`             | Enable OpenTelemetry tracing and W3C context propagation |
| `otel.exporterUrl`           | `string`        | —                   | OTel exporter URL                                        |
| `logger`                     | `SagaLogger`    | `ConsoleSagaLogger` | Custom logger                                            |

**Async configuration**:

```typescript
SagaModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    groupId: config.get("KAFKA_GROUP_ID"),
    transport: new KafkaTransport({
      brokers: config.get("KAFKA_BROKERS").split(","),
    }),
  }),
});
```

### `@SagaParticipant(topics, options?)`

Class decorator. Declares the saga topics this participant handles. Must extend `SagaParticipantBase`.

```typescript
// Single topic
@Injectable()
@SagaParticipant("order.created")
export class PaymentParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit): Promise<void> { ... }
}

// Multiple topics (same logic for all)
@Injectable()
@SagaParticipant(["inventory.failed", "inventory.compensated"])
export class InventoryCompensationParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit): Promise<void> { ... }
}

// With options
@SagaParticipant("bulk.requested", { fork: true })
@SagaParticipant("provisioning.completed", { final: true })
```

**`SagaParticipantOptions`**:

| Field   | Type                    | Description                                                                                                                                                        |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `final` | `boolean`               | Marks the handler as the last step. Auto-adds `hint: 'final'` to all emitted events.                                                                               |
| `fork`  | `boolean \| ForkConfig` | Every `emit()` inside the handler creates a new sub-saga. The framework generates a new `sagaId`, adds `hint: 'fork'`, and propagates `parentSagaId`/`rootSagaId`. |

`final` and `fork` are **mutually exclusive** — using both throws `SagaInvalidHandlerConfigError`.

Options apply uniformly to all topics in the decorator. Different options require different classes.

**Constraint**: Each topic must have exactly one saga handler across all participants. Duplicate registrations throw `SagaDuplicateHandlerError`.

**`serviceId`** is auto-derived from the class name (e.g., `PaymentParticipant` → `"PaymentParticipant"`). No manual declaration needed.

### `@MessageHandler(...topics)`

Method decorator for non-saga (plain) message consumption. Routes messages that lack saga headers to the decorated method.

```typescript
@Injectable()
@SagaParticipant("order.created")
export class OrderParticipant extends SagaParticipantBase {
  // Called when message HAS saga headers
  async handle(event: IncomingEvent, emit: Emit): Promise<void> { ... }

  // Called when message does NOT have saga headers
  @MessageHandler("order.created")
  async handlePlain(message: PlainMessage): Promise<void> { ... }
}
```

The same topic can have both a saga handler and a plain handler — routing is per-message based on whether saga metadata is present.

**`PlainMessage`**:

```typescript
interface PlainMessage<T = unknown> {
  topic: string;
  key: string;
  payload: T;
  headers: Record<string, string>;
  timestamp?: string;
}
```

### `SagaParticipantBase`

Abstract base class for saga participants.

| Property / Method     | Type                                            | Description                                                        |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `handle()`            | `(event, emit) => Promise<void>` (abstract)     | Mandatory handler for all declared saga topics                     |
| `onFail?()`           | `(event, error, emit) => Promise<void>`         | Called on non-retryable error from `handle()` (retries independently) |
| `onRetryExhausted?()` | `(event, error, emit) => Promise<void>`         | Called when `SagaRetryableError` exceeds `maxRetries`              |

### `SagaPublisherProvider`

Injectable service to initiate sagas or emit events. See [Core Functions](../doc/core-functions.md) for detailed semantics.

| Method                                      | Description                                      |
| ------------------------------------------- | ------------------------------------------------ |
| `start(fn, opts?)`                          | Start a saga (context-aware: child if inside existing context, root otherwise). Use `{ independent: true }` to force root. |
| `startChild(fn, opts?)`                     | Start a child saga linked to the current context |
| `emit(params)`                              | Emit an event in the current saga context        |
| `emitToParent(params \| fn)`                | Emit to the parent saga                          |
| `forSaga(sagaId, parentCtx?, causationId?)` | Get a bound `Emit` function for manual use       |

### `SagaHealthIndicator`

Injectable health check service. Returns `TransportHealthResult` (`{ status: 'up' | 'down', details? }`). Does **not** depend on `@nestjs/terminus` — works with any health check framework or custom controller.

```typescript
import { Controller, Get } from "@nestjs/common";
import { SagaHealthIndicator } from "@fbsm/saga-nestjs";

@Controller("health")
export class HealthController {
  constructor(private readonly sagaHealth: SagaHealthIndicator) {}

  @Get()
  async check() {
    return this.sagaHealth.check();
  }
}
```

**With `@nestjs/terminus`:**

```typescript
import { Injectable } from "@nestjs/common";
import { HealthIndicator, HealthCheckError } from "@nestjs/terminus";
import { SagaHealthIndicator } from "@fbsm/saga-nestjs";

@Injectable()
export class SagaTerminusIndicator extends HealthIndicator {
  constructor(private readonly sagaHealth: SagaHealthIndicator) {
    super();
  }

  async isHealthy(key: string) {
    const result = await this.sagaHealth.check();
    if (result.status === "down") {
      throw new HealthCheckError(key, result.details);
    }
    return this.getStatus(key, true, result.details);
  }
}
```

### Types

```typescript
type Emit = <T extends object>(params: EmitParams<T>) => Promise<void>;

interface EmitParams<T extends object = Record<string, unknown>> {
  topic: string; // Topic name for routing and Kafka
  stepName: string; // Logical step name for tracing
  stepDescription?: string;
  payload: T; // Event payload
  hint?: EventHint; // 'compensation' | 'final' | 'fork'
  key?: string; // Optional partition key
}

interface IncomingEvent<T = Record<string, unknown>> {
  eventId: string;
  sagaId: string;
  parentSagaId?: string;
  rootSagaId: string;
  causationId: string;
  topic: string;
  sagaName?: string;
  sagaDescription?: string;
  stepName: string;
  stepDescription?: string;
  occurredAt: string;
  payload: T;
  key?: string;
}
```

See [Concepts](../doc/concepts.md) for detailed explanations of each field.

---

## Examples

### 1. Simple Handler + Emit

A basic participant that handles one event and emits another.

```typescript
// payment.participant.ts
import { Injectable } from "@nestjs/common";
import { SagaParticipant, SagaParticipantBase } from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-core";

@Injectable()
@SagaParticipant("order.created")
export class PaymentParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { orderId, amount } = event.payload as {
      orderId: string;
      amount: number;
    };

    // Process payment...
    const transactionId = `txn-${Date.now()}`;

    await emit({
      topic: "payment.completed",
      stepName: "process-payment",
      payload: { orderId, transactionId, amount },
    });
  }
}
```

```typescript
// orders.controller.ts
import { Controller, Post, Body } from "@nestjs/common";
import { SagaPublisherProvider } from "@fbsm/saga-nestjs";

@Controller("orders")
export class OrdersController {
  constructor(private readonly sagaPublisher: SagaPublisherProvider) {}

  @Post()
  async create(@Body() body: { amount: number }) {
    const { sagaId } = await this.sagaPublisher.start(async () => {
      await this.sagaPublisher.emit({
        topic: "order.created",
        stepName: "create-order",
        payload: { orderId: `order-${Date.now()}`, amount: body.amount },
      });
    });

    return { sagaId };
  }
}
```

**Flow**: `POST /orders` → `order.created` → `PaymentParticipant` → `payment.completed`

### 2. Complex: Fork + Fan-Out

A handler that forks N sub-sagas and coordinates their completion via `emitToParent()`.

```typescript
// bulk-fork.participant.ts — Each emit() creates a separate sub-saga
import { Injectable } from "@nestjs/common";
import { SagaParticipant, SagaParticipantBase } from "@fbsm/saga-nestjs";
import type { IncomingEvent, Emit } from "@fbsm/saga-core";

@Injectable()
@SagaParticipant("bulk.requested", { fork: true })
export class BulkForkParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { batchId, items } = event.payload as {
      batchId: string;
      items: string[];
    };
    // N emits = N sub-sagas (each gets its own sagaId)
    for (const item of items) {
      await emit({
        topic: "item.processing.requested",
        stepName: "request-item-processing",
        payload: { batchId, item },
      });
    }
  }
}
```

```typescript
// item-completed.participant.ts — Fan-in: when all sub-sagas complete, notify parent
import { Injectable } from "@nestjs/common";
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaPublisherProvider,
} from "@fbsm/saga-nestjs";
import type { IncomingEvent } from "@fbsm/saga-core";

@Injectable()
@SagaParticipant("item.processing.completed")
export class ItemCompletedParticipant extends SagaParticipantBase {
  private completionCount = new Map<string, { total: number; done: number }>();

  constructor(private readonly sagaPublisher: SagaPublisherProvider) {
    super();
  }

  async handle(event: IncomingEvent): Promise<void> {
    const { batchId } = event.payload as { batchId: string };
    const counter = this.completionCount.get(batchId);
    if (!counter) return;

    counter.done++;
    if (counter.done >= counter.total) {
      this.completionCount.delete(batchId);
      await this.sagaPublisher.emitToParent({
        topic: "bulk.completed",
        stepName: "complete-bulk",
        payload: { batchId, totalProcessed: counter.total },
        hint: "final",
      });
    }
  }
}
```

```typescript
// item-processor.participant.ts
@Injectable()
@SagaParticipant("item.processing.requested", { final: true })
export class ItemProcessorParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { batchId, item } = event.payload as {
      batchId: string;
      item: string;
    };
    // Process item...
    await emit({
      topic: "item.processing.completed",
      stepName: "process-item",
      payload: { batchId, item, status: "done" },
    });
    // hint: 'final' auto-added by framework
  }
}
```

**Flow**:

```
POST /bulk → bulk.requested [fork x N]
  Sub-saga 1: item.processing.requested → item.processing.completed [final]
  Sub-saga 2: item.processing.requested → item.processing.completed [final]
  Sub-saga N: item.processing.requested → item.processing.completed [final]
  ← emitToParent() when all complete
→ bulk.completed [final]
```

### 3. AsyncLocalStorage Context (Fork + Final)

Full flow showing how AsyncLocalStorage context propagates through `start()` → handler → fork → final → `emitToParent()`.

```typescript
// task-fork.participant.ts — Fork: each emit creates a sub-saga with its own context
@Injectable()
@SagaParticipant("task.requested", { fork: true })
export class TaskForkParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { taskId } = event.payload as { taskId: string };
    // This emit runs in a sub-saga context automatically:
    // - New sagaId generated, parentSagaId = event.sagaId, hint: 'fork' auto-added
    await emit({
      topic: "validation.requested",
      stepName: "request-validation",
      payload: { taskId },
    });
  }
}

// task-completed.participant.ts — Parent receives the result when sub-saga calls emitToParent()
@Injectable()
@SagaParticipant("task.completed", { final: true })
export class TaskCompletedParticipant extends SagaParticipantBase {
  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { taskId, result } = event.payload as { taskId: string; result: string };
    await emit({
      topic: "task.done",
      stepName: "finish-task",
      payload: { taskId, result },
    });
    // hint: 'final' auto-added
  }
}
```

```typescript
// validator.participant.ts — Final handler in the sub-saga
@Injectable()
@SagaParticipant("validation.requested", { final: true })
export class ValidatorParticipant extends SagaParticipantBase {
  constructor(private readonly sagaPublisher: SagaPublisherProvider) {
    super();
  }

  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    const { taskId } = event.payload as { taskId: string };

    await emit({
      topic: "validation.completed",
      stepName: "validate",
      payload: { taskId, valid: true },
    });

    // Report back to parent saga (reads parentSagaId from AsyncLocalStorage)
    await this.sagaPublisher.emitToParent({
      topic: "task.completed",
      stepName: "report-to-parent",
      payload: { taskId, result: "validated" },
    });
  }
}
```

```typescript
// controller
@Post('tasks')
async createTask() {
  // start() creates a root saga context in AsyncLocalStorage
  const { sagaId } = await this.sagaPublisher.start(async () => {
    // emit() reads sagaId from ALS automatically
    await this.sagaPublisher.emit({
      topic: 'task.requested',
      stepName: 'create-task',
      payload: { taskId: `task-${Date.now()}` },
    });
  });
  return { sagaId };
}
```

**Context flow**:

```
start() → ALS context: { sagaId: A, rootSagaId: A }
  → task.requested (handler runs in context A)
    → fork creates: { sagaId: B, rootSagaId: A, parentSagaId: A }
      → validation.requested (handler runs in context B)
        → emit() reads from ALS → publishes on saga B
        → emitToParent() reads parentSagaId from ALS → publishes on saga A
  → task.completed (handler runs in context A, { final: true })
    → task.done [final]
```

### 4. Manual Mode (Without AsyncLocalStorage)

For when you need full control or can't use callbacks (e.g., Express middleware, testing).

```typescript
import { Controller, Post, Body } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import { SagaPublisherProvider } from "@fbsm/saga-nestjs";

@Controller("orders")
export class ManualOrdersController {
  constructor(private readonly sagaPublisher: SagaPublisherProvider) {}

  @Post()
  async create(@Body() body: { amount: number }) {
    // Generate your own saga ID
    const sagaId = uuidv7();

    // Get a bound emit function (no ALS needed)
    const emit = this.sagaPublisher.forSaga(sagaId);

    await emit({
      topic: "order.created",
      stepName: "create-order",
      payload: { orderId: `order-${Date.now()}`, amount: body.amount },
    });

    return { sagaId };
  }

  @Post("with-child")
  async createWithChild(@Body() body: { amount: number }) {
    const sagaId = uuidv7();
    const rootEmit = this.sagaPublisher.forSaga(sagaId);

    await rootEmit({
      topic: "order.created",
      stepName: "create-order",
      payload: { orderId: `order-${Date.now()}`, amount: body.amount },
    });

    // Manually create a child saga
    const childSagaId = uuidv7();
    const childEmit = this.sagaPublisher.forSaga(
      childSagaId,
      {
        parentSagaId: sagaId,
        rootSagaId: sagaId,
      },
      sagaId,
    ); // causationId

    await childEmit({
      topic: "fulfillment.started",
      stepName: "start-fulfillment",
      payload: { orderId: `order-${Date.now()}` },
    });

    return { sagaId, childSagaId };
  }
}
```

**When to use manual mode**:

- Testing: create emit functions with known saga IDs
- Non-callback patterns: when wrapping in a callback is impractical
- Migration: gradually adopting the library in existing code
- External triggers: when the saga ID is provided externally

> **Tip**: Prefer the callback style (`start(fn)`) for new code — it handles context propagation automatically and is less error-prone.

---

## Further Reading

- [Concepts](../doc/concepts.md) — sagaId, hint, topic, and other domain terms
- [Core Functions](../doc/core-functions.md) — detailed semantics of emit, emitToParent, etc.
- [@fbsm/saga-core API](../saga-core/README.md) — framework-agnostic core reference
- [@fbsm/saga-transport-kafka API](../saga-transport-kafka/README.md) — Kafka transport options
- [Example Projects](../../examples/README.md) — production-realistic demo applications
