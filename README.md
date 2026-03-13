# @fbsm/saga-* — Saga Choreography Library

A framework-agnostic saga choreography library for Node.js, with first-class NestJS integration and Kafka transport.

## Packages

| Package | Description |
|---------|-------------|
| [`@fbsm/saga-core`](packages/saga-core/README.md) | Framework-agnostic core: runner, publisher, parser, errors |
| [`@fbsm/saga-nestjs`](packages/saga-nestjs/README.md) | NestJS integration: dynamic module, decorators, auto-discovery |
| [`@fbsm/saga-transport-kafka`](packages/saga-transport-kafka/README.md) | KafkaJS transport adapter with eachBatch, watermark offset tracking |

## Quick Start

```bash
npm install @fbsm/saga-core @fbsm/saga-nestjs @fbsm/saga-transport-kafka
```

```typescript
import { Module } from '@nestjs/common';
import { SagaModule } from '@fbsm/saga-nestjs';
import { KafkaTransport } from '@fbsm/saga-transport-kafka';

@Module({
  imports: [
    SagaModule.forRoot({
      serviceName: 'my-service',
      transport: new KafkaTransport({
        brokers: ['localhost:9092'],
        clientId: 'my-service',
      }),
    }),
  ],
})
export class AppModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import { SagaParticipant, SagaParticipantBase, SagaHandler } from '@fbsm/saga-nestjs';
import type { IncomingEvent, Emit } from '@fbsm/saga-core';

@Injectable()
@SagaParticipant()
export class PaymentParticipant extends SagaParticipantBase {
  readonly serviceId = 'payment-service';

  @SagaHandler('order.created')
  async handleOrderCreated(event: IncomingEvent, emit: Emit): Promise<void> {
    const { orderId, amount } = event.payload as { orderId: string; amount: number };
    await emit({
      eventType: 'payment.completed',
      stepName: 'process-payment',
      payload: { orderId, transactionId: '...', amount },
    });
  }
}
```

## Documentation

| Document | Description |
|----------|-------------|
| [Concepts](packages/doc/concepts.md) | sagaId, hint, eventType, and other domain terms |
| [Core Functions](packages/doc/core-functions.md) | emit, emitToParent, start, startChild, forSaga |
| [Custom Transport](packages/doc/custom-transport.md) | Implement your own message transport |
| [Documentation Hub](packages/doc/README.md) | Full documentation index |

## API Reference

- [@fbsm/saga-core](packages/saga-core/README.md) — SagaContext, SagaPublisher, SagaRunner, errors, Kafka headers
- [@fbsm/saga-nestjs](packages/saga-nestjs/README.md) — SagaModule, @SagaParticipant, @SagaHandler, SagaPublisherProvider
- [@fbsm/saga-transport-kafka](packages/saga-transport-kafka/README.md) — KafkaTransport, KafkaTransportOptions

## Examples

Production-realistic demos with Kafka, tracing, and monitoring. See [examples/README.md](examples/README.md).

- **[order-saga](examples/order-saga/)** — 11 participants, 3 scenarios (recurring, SIM swap, bulk activation), compensation flows
- **[monitor](examples/monitor/)** — Real-time saga observability dashboard (Next.js + NestJS + Prisma)

## Development

```bash
pnpm install          # Install all dependencies
pnpm run build        # Build all packages (ESM + CJS + DTS)
pnpm run test         # Run all tests
pnpm run typecheck    # Type-check with project references
```

## License

MIT
