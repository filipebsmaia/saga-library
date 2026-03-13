# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build       # tsup → dist/index.js (ESM) + dist/index.cjs (CJS) + declarations
pnpm dev         # tsup --watch
pnpm typecheck   # tsc --noEmit
```

Tests are run from the **monorepo root** (no test files in this package currently):
```bash
pnpm vitest run packages/saga-nestjs
```

## Architecture

This package is a thin NestJS wrapper over `@fbsm/saga-core`. It adds:
1. A dynamic module (`SagaModule`) that wires the core classes as NestJS providers
2. Decorators (`@SagaParticipant`, `@SagaHandler`) for auto-discovery
3. An injectable `SagaPublisherProvider` that delegates to `SagaPublisher`

### Module bootstrap flow

```
SagaModule.forRoot(options)
  │
  ├─ Provides: SagaRegistry, SagaParser, SagaPublisher, SagaRunner (from @fbsm/saga-core)
  ├─ Provides: SagaPublisherProvider (injectable wrapper)
  │
  └─ SagaRunnerProvider (OnApplicationBootstrap)
       │  on bootstrap:
       ├─ Discovers all @SagaParticipant classes via NestJS ModuleRef
       ├─ Reads @SagaHandler metadata from each method
       ├─ Calls registry.register(participant) for each
       └─ Calls runner.start()
```

`SagaRunnerProvider` (`src/providers/saga-runner.provider.ts`) is the orchestration point. It uses `ModuleRef` to iterate over all registered providers and filter those with the `SAGA_PARTICIPANT_METADATA` symbol (set by `@SagaParticipant()`).

### Decorator mechanics

`@SagaParticipant()` — sets a metadata symbol on the class. Checked by `SagaRunnerProvider` during bootstrap.

`@SagaHandler(...eventTypes, options?)` — sets handler metadata on the method. The last argument is treated as `SagaHandlerOptions` if it's a plain object (not a string). This allows:
```typescript
@SagaHandler('a', 'b', { final: true })   // multiple eventTypes + options
@SagaHandler('a', { fork: true })          // single eventType + options
@SagaHandler('a')                          // no options
```

### SagaParticipantBase

Participants must extend `SagaParticipantBase`. The base class has an `on` map (`Record<string, EventHandler>`) that is auto-populated by `SagaRunnerProvider` from the `@SagaHandler` metadata, so the participant's `on` property is ready when `registry.register()` is called.

### forRootAsync

`SagaModule.forRootAsync()` uses the standard NestJS async provider pattern (`useFactory`, `inject`, `imports`). It creates the same providers but delays construction until the factory resolves, enabling integration with `ConfigService` or other async providers.

### Constants

`src/constants.ts` holds the metadata keys (`SAGA_PARTICIPANT_METADATA`, `SAGA_HANDLER_METADATA`) used by decorators and provider discovery. If adding new decorator-driven behavior, follow this pattern.
