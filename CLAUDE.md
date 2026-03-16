# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (monorepo)

```bash
pnpm install          # Install all dependencies
pnpm run build        # Build all packages (ESM + CJS + declarations)
pnpm run test         # Run all tests (Vitest)
pnpm run test:watch   # Watch mode
pnpm run test:coverage
pnpm run typecheck    # Type-check all packages
pnpm run clean        # Remove build artifacts
```

### Running a single test

```bash
# From root, filter by test name/file
pnpm vitest run packages/saga-core/src/some.test.ts
pnpm vitest run --reporter=verbose -t "test name pattern"
```

### order-saga example

```bash
cd examples/order-saga
pnpm run docker:up    # Start Kafka + Kafka UI + Jaeger
pnpm run start:dev    # Start with ts-node (hot reload)
pnpm run load-test    # Load test script
```

### monitor backend

```bash
cd examples/monitor/backend
pnpm run docker:up          # Start Postgres + Redis + Kafka
pnpm prisma:generate        # Regenerate Prisma client after schema changes
pnpm prisma:migrate:dev     # Create and apply a new migration
pnpm prisma:migrate:deploy  # Apply migrations (production/CI)
pnpm start:dev              # Start with hot reload
pnpm test
```

### monitor frontend

```bash
cd examples/monitor/frontend
pnpm dev         # Dev server on port 3200
pnpm typecheck
pnpm test
```

## Architecture

### Packages

- **saga-core** — Framework-agnostic core. `SagaPublisher` manages emitting events (`emit`, `emitToParent`, `start`, `startChild`). `SagaRunner` consumes events with retry logic. `SagaRegistry` registers participants and handlers. `SagaParser` decodes incoming messages using a 3-layer fallback: Kafka headers → W3C Baggage → message envelope. Saga metadata propagates via **AsyncLocalStorage** (no context threading required).
- **saga-nestjs** — NestJS module. `@SagaParticipant()` / `@SagaHandler()` decorators enable auto-discovery. `SagaModule.forRoot()` / `forRootAsync()` configure the module. `SagaPublisherProvider` is the injectable service.
- **saga-transport-kafka** — KafkaJS adapter. Uses `eachBatch` with key-based grouping: parallel across saga trees, sequential within a tree. Watermark tracker prevents offset loss.

### Key concepts

- **sagaId / rootSagaId / parentSagaId** — Every saga step has a unique `sagaId`; sub-sagas track their root and parent. See [packages/doc/concepts.md](packages/doc/concepts.md).
- **hint** — Metadata on each event indicating the saga phase (`compensation`, `final`, etc.).
- **fork: true** — Handler option that creates a sub-saga for each emitted event (fan-out pattern).
- **final: true** — Handler option marking the terminal step; mutually exclusive with `fork`.
- **emitToParent()** — Emits from a sub-saga back up to the parent saga to resume it.

### Monitor (observability)

- **Backend** — Kafka projector consumes all saga events and writes a read-model to Postgres (`saga_state` + `saga_event_log`). Publishes Redis pub/sub messages for SSE. REST API exposes list, detail, events, tree, and metrics endpoints. Status derived from `saga-event-hint` header.
- **Frontend** — Next.js 14, TanStack Query v5, Server Components for initial fetch, Client Components for SSE. SSE uses native `EventSource` with exponential backoff (1s→30s). Home table SSE updates existing rows only (new sagas show a refresh banner). Detail page SSE invalidates both `saga-events` and `saga-events-all` query keys using the absolute `BACKEND_URL`. Quick filters `rootsOnly` / `activeOnly` are server-side; `stuck`, `compensating`, `recentOnly`, and incident-mode sorting are client-side.

### Build system

- **tsup** builds each package to dual ESM (`dist/index.js`) + CJS (`dist/index.cjs`) with TypeScript declarations.
- **TypeScript project references** (`tsconfig.json` at root) wire the packages together; `tsconfig.base.json` holds shared compiler options.
- **Vitest** is configured at root via `vitest.config.ts` as a multi-project setup covering all three packages.

## Coding conventions

- **Always use braces** on control structures (`if`, `else`, `for`, `while`), even for single-line bodies.
- **Descriptive variable names** — never single-letter or abbreviated names (`i`, `j`, `e`, `s`, `p`, `qf`, etc.). `index` is acceptable for loop counters; standard callback params like `event` are fine.
