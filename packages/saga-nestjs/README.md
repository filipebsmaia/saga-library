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

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `serviceName` | `string` | — | Consumer group prefix (`${serviceName}-group`) |
| `transport` | `SagaTransport` | — | Transport implementation (e.g., `KafkaTransport`) |
| `retryPolicy.maxRetries` | `number` | `3` | Max retry attempts for `SagaRetryableError` |
| `retryPolicy.initialDelayMs` | `number` | `200` | Initial retry delay in ms (doubles each attempt) |
| `fromBeginning` | `boolean` | `false` | Read from beginning of topics |
| `topicPrefix` | `string` | `''` | Prefix prepended to eventType for topic names |
| `otel.enabled` | `boolean` | `false` | Enable OpenTelemetry tracing and W3C context propagation |
| `otel.exporterUrl` | `string` | — | OTel exporter URL |
| `logger` | `SagaLogger` | `ConsoleSagaLogger` | Custom logger |

**Async configuration**:
```typescript
SagaModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    serviceName: config.get('SERVICE_NAME'),
    transport: new KafkaTransport({
      brokers: config.get('KAFKA_BROKERS').split(','),
    }),
  }),
})
```

### `@SagaParticipant()`

Class decorator. Marks a class for auto-discovery by the saga runner. Must extend `SagaParticipantBase`.

```typescript
@Injectable()
@SagaParticipant()
export class PaymentParticipant extends SagaParticipantBase {
  readonly serviceId = 'payment-service';
}
```

### `@SagaHandler(...eventTypes, options?)`

Method decorator. Registers a method as the handler for one or more event types. Accepts an optional options object as the last argument.

```typescript
// Single event type
@SagaHandler('order.created')
async handleOrderCreated(event: IncomingEvent, emit: Emit) {}

// Multiple event types
@SagaHandler('inventory.failed', 'inventory.compensated')
async handleInventoryIssue(event: IncomingEvent, emit: Emit) {}
```

**`SagaHandlerOptions`**:

| Field | Type | Description |
|-------|------|-------------|
| `final` | `boolean` | Marks the handler as the last step. Auto-adds `hint: 'final'` to all emitted events. |
| `fork` | `boolean \| ForkConfig` | Every `emit()` inside the handler creates a new sub-saga. The framework generates a new `sagaId`, adds `hint: 'fork'`, and propagates `parentSagaId`/`rootSagaId`. |

`final` and `fork` are **mutually exclusive** — using both throws `SagaInvalidHandlerConfigError`.

**Constraint**: Each event type must have exactly one handler across all participants. Duplicate registrations throw `SagaDuplicateHandlerError`.

### `SagaParticipantBase`

Abstract base class for saga participants.

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `serviceId` | `string` (abstract) | Unique service identifier |
| `on` | `Record<string, EventHandler>` | Auto-populated handler registry |
| `onRetryExhausted?()` | `(event, error, emit) => Promise<void>` | Called when `SagaRetryableError` exceeds `maxRetries` |

### `SagaPublisherProvider`

Injectable service to initiate sagas or emit events. See [Core Functions](../doc/core-functions.md) for detailed semantics.

| Method | Description |
|--------|-------------|
| `start(fn, opts?)` | Start a new root saga |
| `startChild(fn, opts?)` | Start a child saga linked to the current context |
| `emit(params)` | Emit an event in the current saga context |
| `emitToParent(params \| fn)` | Emit to the parent saga |
| `forSaga(sagaId, parentCtx?, causationId?)` | Get a bound `Emit` function for manual use |

### Types

```typescript
type Emit = <T extends object>(params: EmitParams<T>) => Promise<void>;

interface EmitParams<T extends object = Record<string, unknown>> {
  eventType: string;       // Event type (also used as topic name)
  stepName: string;        // Logical step name for tracing
  stepDescription?: string;
  payload: T;              // Event payload
  hint?: EventHint;        // 'compensation' | 'final' | 'fork'
  key?: string;            // Optional partition key
}

interface IncomingEvent<T = Record<string, unknown>> {
  eventId: string;
  sagaId: string;
  parentSagaId?: string;
  rootSagaId: string;
  causationId: string;
  eventType: string;
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
import { Injectable } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
} from '@fbsm/saga-nestjs';
import type { IncomingEvent, Emit } from '@fbsm/saga-core';

@Injectable()
@SagaParticipant()
export class PaymentParticipant extends SagaParticipantBase {
  readonly serviceId = 'payment-service';

  @SagaHandler('order.created')
  async handleOrderCreated(event: IncomingEvent, emit: Emit): Promise<void> {
    const { orderId, amount } = event.payload as {
      orderId: string;
      amount: number;
    };

    // Process payment...
    const transactionId = `txn-${Date.now()}`;

    await emit({
      eventType: 'payment.completed',
      stepName: 'process-payment',
      payload: { orderId, transactionId, amount },
    });
  }
}
```

```typescript
// orders.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { SagaPublisherProvider } from '@fbsm/saga-nestjs';

@Controller('orders')
export class OrdersController {
  constructor(private readonly sagaPublisher: SagaPublisherProvider) {}

  @Post()
  async create(@Body() body: { amount: number }) {
    const { sagaId } = await this.sagaPublisher.start(async () => {
      await this.sagaPublisher.emit({
        eventType: 'order.created',
        stepName: 'create-order',
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
// bulk-orchestration.participant.ts
import { Injectable } from '@nestjs/common';
import {
  SagaParticipant,
  SagaParticipantBase,
  SagaHandler,
  SagaPublisherProvider,
} from '@fbsm/saga-nestjs';
import type { IncomingEvent, Emit } from '@fbsm/saga-core';

@Injectable()
@SagaParticipant()
export class BulkOrchestrationParticipant extends SagaParticipantBase {
  readonly serviceId = 'bulk-orchestration';

  private completionCount = new Map<string, { total: number; done: number }>();

  constructor(private readonly sagaPublisher: SagaPublisherProvider) {
    super();
  }

  // Each emit() inside this handler creates a separate sub-saga
  @SagaHandler('bulk.requested', { fork: true })
  async handleBulkRequested(event: IncomingEvent, emit: Emit): Promise<void> {
    const { batchId, items } = event.payload as {
      batchId: string;
      items: string[];
    };

    this.completionCount.set(batchId, { total: items.length, done: 0 });

    // N emits = N sub-sagas (each gets its own sagaId)
    for (const item of items) {
      await emit({
        eventType: 'item.processing.requested',
        stepName: 'request-item-processing',
        payload: { batchId, item },
      });
    }
  }

  // Called when each sub-saga completes
  @SagaHandler('item.processing.completed')
  async handleItemCompleted(event: IncomingEvent): Promise<void> {
    const { batchId } = event.payload as { batchId: string };

    const counter = this.completionCount.get(batchId);
    if (!counter) return;

    counter.done++;

    // Fan-in: when all sub-sagas complete, notify parent
    if (counter.done >= counter.total) {
      this.completionCount.delete(batchId);

      await this.sagaPublisher.emitToParent({
        eventType: 'bulk.completed',
        stepName: 'complete-bulk',
        payload: { batchId, totalProcessed: counter.total },
        hint: 'final',
      });
    }
  }
}
```

```typescript
// item-processor.participant.ts
@Injectable()
@SagaParticipant()
export class ItemProcessorParticipant extends SagaParticipantBase {
  readonly serviceId = 'item-processor';

  @SagaHandler('item.processing.requested', { final: true })
  async handleProcessing(event: IncomingEvent, emit: Emit): Promise<void> {
    const { batchId, item } = event.payload as {
      batchId: string;
      item: string;
    };

    // Process item...

    await emit({
      eventType: 'item.processing.completed',
      stepName: 'process-item',
      payload: { batchId, item, status: 'done' },
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
// orchestration.participant.ts
@Injectable()
@SagaParticipant()
export class OrchestrationParticipant extends SagaParticipantBase {
  readonly serviceId = 'orchestration';

  // Fork: each emit creates a sub-saga with its own context
  // Inside the handler, SagaContext.current() returns the PARENT saga context
  // The framework wraps each emit in a NEW context for the sub-saga
  @SagaHandler('task.requested', { fork: true })
  async handleTaskRequested(event: IncomingEvent, emit: Emit): Promise<void> {
    const { taskId } = event.payload as { taskId: string };

    // This emit runs in a sub-saga context automatically:
    // - New sagaId generated
    // - parentSagaId = event.sagaId (the parent)
    // - rootSagaId inherited
    // - hint: 'fork' auto-added
    await emit({
      eventType: 'validation.requested',
      stepName: 'request-validation',
      payload: { taskId },
    });
  }

  // Parent receives the result when sub-saga calls emitToParent()
  @SagaHandler('task.completed', { final: true })
  async handleTaskCompleted(event: IncomingEvent, emit: Emit): Promise<void> {
    const { taskId, result } = event.payload as {
      taskId: string;
      result: string;
    };

    await emit({
      eventType: 'task.done',
      stepName: 'finish-task',
      payload: { taskId, result },
    });
    // hint: 'final' auto-added
  }
}
```

```typescript
// validator.participant.ts
@Injectable()
@SagaParticipant()
export class ValidatorParticipant extends SagaParticipantBase {
  readonly serviceId = 'validator';

  constructor(private readonly sagaPublisher: SagaPublisherProvider) {
    super();
  }

  // Final handler in the sub-saga
  @SagaHandler('validation.requested', { final: true })
  async handleValidation(event: IncomingEvent, emit: Emit): Promise<void> {
    const { taskId } = event.payload as { taskId: string };

    // Emit within the sub-saga (hint: 'final' auto-added)
    await emit({
      eventType: 'validation.completed',
      stepName: 'validate',
      payload: { taskId, valid: true },
    });

    // Report back to parent saga
    // emitToParent reads parentSagaId from AsyncLocalStorage
    await this.sagaPublisher.emitToParent({
      eventType: 'task.completed',
      stepName: 'report-to-parent',
      payload: { taskId, result: 'validated' },
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
      eventType: 'task.requested',
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
import { Controller, Post, Body } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { SagaPublisherProvider } from '@fbsm/saga-nestjs';

@Controller('orders')
export class ManualOrdersController {
  constructor(private readonly sagaPublisher: SagaPublisherProvider) {}

  @Post()
  async create(@Body() body: { amount: number }) {
    // Generate your own saga ID
    const sagaId = uuidv7();

    // Get a bound emit function (no ALS needed)
    const emit = this.sagaPublisher.forSaga(sagaId);

    await emit({
      eventType: 'order.created',
      stepName: 'create-order',
      payload: { orderId: `order-${Date.now()}`, amount: body.amount },
    });

    return { sagaId };
  }

  @Post('with-child')
  async createWithChild(@Body() body: { amount: number }) {
    const sagaId = uuidv7();
    const rootEmit = this.sagaPublisher.forSaga(sagaId);

    await rootEmit({
      eventType: 'order.created',
      stepName: 'create-order',
      payload: { orderId: `order-${Date.now()}`, amount: body.amount },
    });

    // Manually create a child saga
    const childSagaId = uuidv7();
    const childEmit = this.sagaPublisher.forSaga(childSagaId, {
      parentSagaId: sagaId,
      rootSagaId: sagaId,
    }, sagaId); // causationId

    await childEmit({
      eventType: 'fulfillment.started',
      stepName: 'start-fulfillment',
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

- [Concepts](../doc/concepts.md) — sagaId, hint, eventType, and other domain terms
- [Core Functions](../doc/core-functions.md) — detailed semantics of emit, emitToParent, etc.
- [@fbsm/saga-core API](../saga-core/README.md) — framework-agnostic core reference
- [@fbsm/saga-transport-kafka API](../saga-transport-kafka/README.md) — Kafka transport options
- [Example Projects](../../examples/README.md) — production-realistic demo applications
