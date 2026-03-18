# Concepts

## Saga Choreography

A distributed transaction pattern where participants react to events and emit new events. No central orchestrator — coordination emerges from the event flow. Each service listens for specific events, performs local work, and publishes new events to advance the saga.

## Identity Fields

- **`sagaId`** (`string`, UUID v7) — Unique identifier for a saga instance. Generated automatically by `start()` or by the framework when forking sub-sagas.
- **`rootSagaId`** (`string`) — The ID of the top-level (root) saga. Stays the same across all child/sub-sagas. When there are no sub-sagas, `rootSagaId === sagaId`.
- **`parentSagaId`** (`string | undefined`) — The direct parent saga's ID. Only present in child/sub-sagas created via `fork` or `startChild()`. Undefined for root sagas.
- **`causationId`** (`string`) — The `eventId` of the event that triggered the current handler. Enables causal chain tracing.
- **`eventId`** (`string`, UUID v7) — Unique identifier for each published event.

## Event Metadata

- **`topic`** (`string`) — Identifies the event and determines routing. Used as the Kafka topic name (with optional prefix). Each topic maps to exactly one handler. Examples: `order.created`, `payment.completed`.
- **`stepName`** (`string`) — Logical name for the current step, used for tracing and observability. Example: `process-payment`.
- **`stepDescription`** (`string | undefined`) — Optional human-readable description of the step.
- **`key`** (`string | undefined`) — Optional partition key for message ordering. Defaults to `rootSagaId`, ensuring all events in the same saga tree go to the same partition.

## Event Hints (`EventHint`)

Type: `'compensation' | 'final' | 'fork'`

| Hint           | Meaning                                                | When Applied                                                            |
| -------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `compensation` | Marks the event as a rollback/undo step                | Manually set by the developer via `hint: 'compensation'` in emit params |
| `final`        | Marks the event as the last step of a saga or sub-saga | Auto-added by the framework when handler has `{ final: true }` option   |
| `fork`         | Marks the event as the start of a new sub-saga         | Auto-added by the framework when handler has `{ fork: true }` option    |

## Context Propagation (AsyncLocalStorage)

The library uses Node.js `AsyncLocalStorage` to propagate saga context (sagaId, rootSagaId, etc.) automatically through async call chains. Inside `start()`, `startChild()`, handler execution, and `emitToParent()` callbacks, the context is available via `SagaContext.current()` or `SagaContext.require()`.

## ID Propagation Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Root Saga (sagaId: A, rootSagaId: A)                       │
│                                                             │
│  emit({topic: 'order.created'})                             │
│       │                                                     │
│       ▼                                                     │
│  Handler (causationId: eventId of 'order.created')          │
│       │                                                     │
│       │  { fork: true }                                     │
│       ▼                                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │  Sub-Saga (sagaId: B, rootSagaId: A,         │           │
│  │           parentSagaId: A)                   │           │
│  │                                              │           │
│  │  emit({topic: 'child.step'})                 │           │
│  │       │                                      │           │
│  │       ▼                                      │           │
│  │  Handler { final: true }                     │           │
│  │       │                                      │           │
│  │       │  emitToParent()                      │           │
│  │       ▼                                      │           │
│  └───────┼──────────────────────────────────────┘           │
│          │                                                  │
│          ▼                                                  │
│  Parent handler resumes (sagaId: A)                         │
└─────────────────────────────────────────────────────────────┘
```

See also: [Core Functions](core-functions.md) for detailed usage of each function.
