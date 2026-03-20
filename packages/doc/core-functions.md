# Core Functions

These functions are available via `SagaPublisherProvider` (NestJS) or `SagaPublisher` (core). They share the same semantics.

## Overview

| Function                   | Requires Context? | Creates New Saga? | Use Case                                    |
| -------------------------- | :---------------: | :---------------: | ------------------------------------------- |
| `start(fn)`                |     Optional      | Yes (root/child)  | Entry point or context-aware child creation |
| `startChild(fn)`           |        Yes        |    Yes (child)    | Spawn related sub-process within a handler  |
| `emit(params)`             |        Yes        |        No         | Publish event in current saga               |
| `emitToParent(params\|fn)` |    Yes (child)    |        No         | Sub-saga reporting back to parent           |
| `forSaga(sagaId)`          |        No         |        No         | Manual control without AsyncLocalStorage    |

## `start(fn, opts?)`

```typescript
const { sagaId, result } = await sagaPublisher.start(
  async () => {
    await sagaPublisher.emit({
      topic: "order.created",
      stepName: "create-order",
      payload: { orderId: "123", amount: 99.9 },
    });
    return { orderId: "123" };
  },
  { sagaName: "order-flow" },
);
```

- **Context-aware**: if called inside an existing saga context, automatically delegates to `startChild()` — creating a child saga with proper `parentSagaId`, `rootSagaId`, and `ancestorChain`. This means code using `start()` works correctly both standalone and as a sub-saga without manual branching.
- If no existing context, generates a new `sagaId` (UUID v7) and sets `rootSagaId = sagaId` (root saga)
- Wraps `fn` in `AsyncLocalStorage` context
- Returns `{ sagaId, result }` where result is the return value of `fn`
- Options: `sagaName`, `sagaDescription`, `key`, `independent`
- **`independent: true`**: escape hatch to force creation of a root saga even inside an existing context

## `startChild(fn, opts?)`

```typescript
// Must be inside an existing saga context (handler or start callback)
const { sagaId: childId } = await sagaPublisher.startChild(async () => {
  await sagaPublisher.emit({
    topic: "provisioning.started",
    stepName: "start-provisioning",
    payload: { productId: "abc" },
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
  topic: "payment.completed",
  stepName: "process-payment",
  payload: { orderId, transactionId },
  hint: "compensation", // optional
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
  topic: "sub-task.completed",
  stepName: "complete-sub-task",
  payload: { result: "ok" },
  hint: "final",
});
```

**Callback** — switch context to parent, then run:

```typescript
await sagaPublisher.emitToParent(async () => {
  await sagaPublisher.emit({
    topic: "sub-task.completed",
    stepName: "complete-sub-task",
    payload: { result: "ok" },
  });
});
```

- Must be inside a child saga context (with `parentSagaId`)
- Throws `SagaNoParentError` if the current saga has no parent
- Supports multi-level bubbling (A→B→C): when C calls `emitToParent()`, the message targets B with correct `parentSagaId` pointing to A, enabling B to subsequently call `emitToParent()` to reach A
- Uses `ancestorChain` internally to reconstruct the parent's context at any depth
- Use for: sub-saga reporting completion, fan-in coordination, cascaded completion across nested sub-sagas

## `forSaga(sagaId, parentCtx?, causationId?, key?)`

```typescript
import { v7 as uuidv7 } from "uuid";

// Root saga (manual)
const sagaId = uuidv7();
const emit = sagaPublisher.forSaga(sagaId);
await emit({
  topic: "order.created",
  stepName: "create-order",
  payload: { orderId: "123" },
});

// Child saga (manual)
const childId = uuidv7();
const childEmit = sagaPublisher.forSaga(
  childId,
  {
    parentSagaId: sagaId,
    rootSagaId: sagaId,
  },
  causationEventId,
);
await childEmit({
  topic: "child.started",
  stepName: "start-child",
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
├── Yes, and it might also run inside an existing saga → start(fn) (auto-promotes to child)
├── Yes, and it must always be a root saga → start(fn, { independent: true })
│
Are you inside a handler and need to spawn a related sub-process?
├── Yes, and I want the framework to create sub-sagas per emit → @SagaParticipant("topic", { fork: true })
├── Yes, and I want explicit control over the child saga → startChild(fn) or start(fn)
│
Are you in a sub-saga and need to report back to the parent?
├── Yes → emitToParent(params)
│
Do you need to emit without AsyncLocalStorage?
├── Yes → forSaga(sagaId)
│
Otherwise → emit(params)
```
