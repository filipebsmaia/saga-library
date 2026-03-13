# Core Functions

These functions are available via `SagaPublisherProvider` (NestJS) or `SagaPublisher` (core). They share the same semantics.

## Overview

| Function | Requires Context? | Creates New Saga? | Use Case |
|----------|:-:|:-:|----------|
| `start(fn)` | No | Yes (root) | Entry point: HTTP controller, cron job, CLI |
| `startChild(fn)` | Yes | Yes (child) | Spawn related sub-process within a handler |
| `emit(params)` | Yes | No | Publish event in current saga |
| `emitToParent(params\|fn)` | Yes (child) | No | Sub-saga reporting back to parent |
| `forSaga(sagaId)` | No | No | Manual control without AsyncLocalStorage |

## `start(fn, opts?)`

```typescript
const { sagaId, result } = await sagaPublisher.start(async () => {
  await sagaPublisher.emit({
    eventType: 'order.created',
    stepName: 'create-order',
    payload: { orderId: '123', amount: 99.90 },
  });
  return { orderId: '123' };
}, { sagaName: 'order-flow' });
```

- Generates a new `sagaId` (UUID v7)
- Sets `rootSagaId = sagaId` (this is a root saga)
- Wraps `fn` in `AsyncLocalStorage` context
- Returns `{ sagaId, result }` where result is the return value of `fn`
- Options: `sagaName`, `sagaDescription`, `key`

## `startChild(fn, opts?)`

```typescript
// Must be inside an existing saga context (handler or start callback)
const { sagaId: childId } = await sagaPublisher.startChild(async () => {
  await sagaPublisher.emit({
    eventType: 'provisioning.started',
    stepName: 'start-provisioning',
    payload: { productId: 'abc' },
  });
});
```

- Must be called inside an existing saga context
- Generates a new `sagaId` for the child
- Sets `parentSagaId` to the current saga's ID
- Inherits `rootSagaId` from parent
- Returns `{ sagaId, result }`

## `emit(params)`

```typescript
await sagaPublisher.emit({
  eventType: 'payment.completed',
  stepName: 'process-payment',
  payload: { orderId, transactionId },
  hint: 'compensation', // optional
});
```

- Reads context from AsyncLocalStorage (`sagaId`, `rootSagaId`, `parentSagaId`, `causationId`)
- Publishes event to transport
- Throws `SagaContextNotFoundError` if called outside a saga context

## `emitToParent(params | fn)`

Two forms:

**Direct params** — publish event on the parent saga:

```typescript
await sagaPublisher.emitToParent({
  eventType: 'sub-task.completed',
  stepName: 'complete-sub-task',
  payload: { result: 'ok' },
  hint: 'final',
});
```

**Callback** — switch context to parent, then run:

```typescript
await sagaPublisher.emitToParent(async () => {
  await sagaPublisher.emit({
    eventType: 'sub-task.completed',
    stepName: 'complete-sub-task',
    payload: { result: 'ok' },
  });
});
```

- Must be inside a child saga context (with `parentSagaId`)
- Throws `SagaNoParentError` if the current saga has no parent
- Use for: sub-saga reporting completion, fan-in coordination

## `forSaga(sagaId, parentCtx?, causationId?, key?)`

```typescript
import { v7 as uuidv7 } from 'uuid';

// Root saga (manual)
const sagaId = uuidv7();
const emit = sagaPublisher.forSaga(sagaId);
await emit({
  eventType: 'order.created',
  stepName: 'create-order',
  payload: { orderId: '123' },
});

// Child saga (manual)
const childId = uuidv7();
const childEmit = sagaPublisher.forSaga(childId, {
  parentSagaId: sagaId,
  rootSagaId: sagaId,
}, causationEventId);
await childEmit({
  eventType: 'child.started',
  stepName: 'start-child',
  payload: {},
});
```

- Returns a bound `Emit` function
- No AsyncLocalStorage required
- You manage sagaId and context manually
- Useful for testing, migration, or non-callback patterns

## Which function should I use?

```
Are you starting a new saga flow?
├── Yes → start(fn)
│
Are you inside a handler and need to spawn a related sub-process?
├── Yes, and I want the framework to create sub-sagas per emit → @SagaHandler({ fork: true })
├── Yes, and I want explicit control over the child saga → startChild(fn)
│
Are you in a sub-saga and need to report back to the parent?
├── Yes → emitToParent(params)
│
Do you need to emit without AsyncLocalStorage?
├── Yes → forSaga(sagaId)
│
Otherwise → emit(params)
```
