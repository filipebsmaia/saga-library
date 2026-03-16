# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build       # tsup → dist/index.js (ESM) + dist/index.cjs (CJS) + declarations
pnpm dev         # tsup --watch
pnpm typecheck   # tsc --noEmit (no separate lint step)
```

Tests are run from the **monorepo root**:

```bash
# From repo root:
pnpm vitest run packages/saga-core          # all tests in this package
pnpm vitest run packages/saga-core/src/some.test.ts  # single file
pnpm vitest run -t "test name"              # filter by name
```

## Architecture

The core has five collaborating classes, wired together by the consumer:

```
SagaRegistry  ←──────────── @SagaParticipant / registry.register()
     │
     ▼
SagaRunner ──► SagaParser (parse inbound) ──► handler dispatch
     │              │ 3-layer fallback:
     │              │  1. Kafka headers (saga-id present)
     │              │  2. W3C Baggage (OTel baggage)
     │              │  3. Legacy envelope (sagaId in body)
     │
     └──► SagaPublisher ──► SagaTransport.publish()
               │
               └── AsyncLocalStorage (SagaContext)
```

### Context propagation

`SagaContext` (AsyncLocalStorage) is set in two places:

1. **`SagaRunner`** — wraps every handler call in `SagaContext.run()` using the parsed inbound context.
2. **`SagaPublisher.start()` / `startChild()` / `emitToParent()`** — wraps the user callback with a newly generated context.

This means `emit()` inside any handler or `start()` callback can read `SagaContext.current()` without being explicitly passed it. `forSaga()` is the escape hatch for when ALS is unavailable (explicit context object instead).

### Handler execution pipeline (SagaRunner)

For each inbound message, `SagaRunner`:

1. Parses via `SagaParser`
2. Looks up handler in registry route map (`eventType → { participant, handler, options }`)
3. If `{ fork: true }`: wraps `emit` so each call gets a new `sagaId`, `parentSagaId`, and `hint: 'fork'`
4. If `{ final: true }`: wraps `emit` to auto-add `hint: 'final'`
5. Sets `SagaContext` via ALS
6. Executes handler with exponential-backoff retry on `SagaRetryableError` (`initialDelayMs * 2^attempt`)
7. On exhaustion: calls `participant.onRetryExhausted()` if defined

### fork vs final

- `fork: true` — each `emit()` inside the handler spawns a **new sub-saga** (new `sagaId`). The emitting saga becomes `parentSagaId` of the sub-saga.
- `final: true` — auto-appends `hint: 'final'` to all emits. Mutually exclusive with `fork` (throws `SagaInvalidHandlerConfigError`).
- `emitToParent()` — reads `parentSagaId` from ALS and publishes back to the parent saga topic. Requires a parent context (throws `SagaNoParentError` otherwise).

### OTel integration

`createOtelContext()` auto-detects whether `@opentelemetry/api` is installed:

- **Available** → returns `W3cOtelContext` (injects/extracts W3C trace context + baggage, creates spans)
- **Missing** → returns `NoopOtelContext` (no-op)

OTel context is an optional constructor parameter of both `SagaPublisher` and `SagaRunner`.

### Transport interface

`SagaTransport` is the only external dependency of the core. The interface (`src/transport/transport.interface.ts`) requires:

- `connect() / disconnect()`
- `publish(OutboundMessage)`
- `subscribe(topics[], handler, options?)`

`OutboundMessage` carries headers as `Record<string, string>` — all saga metadata flows through headers, not the payload body.

### Message building

`MessageBuilder` (`src/publisher/message-builder.ts`) assembles the `OutboundMessage` from the current ALS context + emit params. It writes all `saga-*` headers and calls `otelContext.inject()` for W3C propagation.
