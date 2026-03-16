# @fbsm/saga-\* Documentation

Central documentation hub for the saga choreography library.

## Guides

- [Concepts](concepts.md) — sagaId, hint, eventType, and other domain concepts
- [Core Functions](core-functions.md) — emit, emitToParent, start, startChild, forSaga
- [Custom Transport](custom-transport.md) — implement your own message transport

## API Reference

- [@fbsm/saga-core](../saga-core/README.md) — framework-agnostic core: runner, publisher, parser, errors
- [@fbsm/saga-nestjs](../saga-nestjs/README.md) — NestJS integration: module, decorators, auto-discovery
- [@fbsm/saga-transport-kafka](../saga-transport-kafka/README.md) — KafkaJS transport adapter

## Examples

- [Example Projects](../../examples/README.md) — order-saga demo, monitoring dashboard
