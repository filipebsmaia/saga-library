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
pnpm vitest run packages/saga-nestjs
```

## Architecture

This package is a thin NestJS wrapper over `@fbsm/saga-core`. It adds:

1. A dynamic module (`SagaModule`) that wires the core classes as NestJS providers
2. Decorators (`@SagaParticipant(topics)`, `@MessageHandler(topics)`) for auto-discovery
3. An injectable `SagaPublisherProvider` that delegates to `SagaPublisher`

### Module bootstrap flow

```
SagaModule.forRoot(options)
  │
  ├─ Provides: SagaRegistry, SagaParser, SagaPublisher, SagaRunner (from @fbsm/saga-core)
  ├─ Provides: SagaPublisherProvider (injectable wrapper)
  │
  └─ SagaRunnerProvider (OnModuleInit)
       │  on init:
       ├─ Discovers all @SagaParticipant classes via DiscoveryService
       ├─ Reads SAGA_PARTICIPANT_TOPICS_METADATA → saga topics
       ├─ Reads SAGA_PARTICIPANT_OPTIONS_METADATA → handler options (fork, final)
       ├─ Binds handle() as the saga handler for all declared topics
       ├─ Reads MESSAGE_HANDLER_METADATA → plain message topics → method bindings
       ├─ Binds onFail() and onRetryExhausted() if defined
       ├─ Derives serviceId from instance.constructor.name
       ├─ Calls registry.register(participant) for each
       └─ Calls runner.start()
```

### Decorator mechanics

`@SagaParticipant(topics, options?)` — class decorator. Sets SAGA_PARTICIPANT_METADATA, SAGA_PARTICIPANT_TOPICS_METADATA, and optionally SAGA_PARTICIPANT_OPTIONS_METADATA.

```typescript
@SagaParticipant('order.created')                        // single topic
@SagaParticipant(['event.a', 'event.b'])                 // multiple topics
@SagaParticipant('bulk.requested', { fork: true })       // with options
@SagaParticipant('provisioning.completed', { final: true })
```

`@MessageHandler(...topics)` — method decorator for non-saga messages. Sets MESSAGE_HANDLER_METADATA (Map of topic → method name).

### SagaParticipantBase

Participants must extend `SagaParticipantBase`. The base class requires implementing:
- `handle(event, emit)` — mandatory, handles all declared saga topics
- `onFail?(event, error, emit)` — optional, called on non-retryable error from handle
- `onRetryExhausted?(event, error, emit)` — optional, called when retries are exhausted

`serviceId` is auto-derived from `instance.constructor.name` — no manual declaration needed.

### forRootAsync

`SagaModule.forRootAsync()` uses the standard NestJS async provider pattern (`useFactory`, `inject`, `imports`). It creates the same providers but delays construction until the factory resolves, enabling integration with `ConfigService` or other async providers.

### Constants

`src/constants.ts` holds the metadata keys used by decorators and provider discovery:
- `SAGA_PARTICIPANT_METADATA` — marks a class as a saga participant
- `SAGA_PARTICIPANT_TOPICS_METADATA` — saga topics from @SagaParticipant
- `SAGA_PARTICIPANT_OPTIONS_METADATA` — handler options (fork, final)
- `MESSAGE_HANDLER_METADATA` — plain handler topic → method mappings
