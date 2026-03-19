# Example Projects

This directory contains example applications demonstrating the saga choreography library. These examples showcase realistic patterns and scenarios but are **not production-ready** — they use in-memory stores, simplified error handling, and simulated delays. Use them as a reference for learning the library's API and patterns.

## Projects

### [order-saga](order-saga/)

A telecom-domain NestJS application with thin single-topic saga participants across 4 scenarios, demonstrating linear flows, sub-saga forking, fan-out/fan-in, compensation, and retry patterns. Each participant uses `@SagaParticipant(topic)` with a single `handle()` method.

**Tech stack**: NestJS + Kafka (KRaft) + Jaeger (tracing)

#### Running

```bash
# 1. Build library packages (from repo root)
pnpm run build

# 2. Start infrastructure
cd examples/order-saga
docker compose up -d    # Kafka, Kafka UI, Jaeger

# 3. Start the app
pnpm run start:dev

# 4. Trigger sagas
curl -X POST http://localhost:3000/recurrings
curl -X POST http://localhost:3000/sim-swaps
curl -X POST "http://localhost:3000/bulk-activations?lines=3"
```

#### Scenarios

**Scenario 1: Recurring Payment** — Linear saga with 7 participants, plus a product provisioning child saga.

```
POST /recurrings
  → recurring.triggered            (plan-management)
  → plan.order.requested           (plan-ordering-management)
  → order.requested                (ordering-management)
  → order.created                  (payment-management)
  → payment.approved               (ordering-management)
  → order.completed                (plan-ordering-management)
  → plan.order.completed           (plan-recurring-management)
  → recurring.completed            [final]
  → recurring.created              [fork — child saga]

Product Provisioning (child saga):
  → recurring.created              (mobile-product-lifecycle)
  → product.activation.requested   (mobile-product-provision)
  → product.provisioned            (mobile-product-lifecycle)
  → product.activated              [final]
```

**Scenario 2: SIM Swap** — Sub-saga with `{ fork: true }` and `emitToParent()` to resume parent.

```
POST /sim-swaps
  Saga A (parent):
    → sim-swap.requested           [fork]
      Saga B (sub-saga):
        → portability.validation.requested  (number-portability)  [final]
        → portability.validated
      ← emitToParent()
    → sim-swap.completed           [final]
```

**Scenario 3: Bulk Activation** — Fan-out N sub-sagas with fan-in coordination.

```
POST /bulk-activations?lines=3
  Saga A (parent):
    → bulk-activation.requested    [fork x3]
      Saga B1: line-activation.requested → line-activation.completed [final]
      Saga B2: line-activation.requested → line-activation.completed [final]
      Saga B3: line-activation.requested → line-activation.completed [final]
      ← each completes → orchestrator counts
      ← all complete → emitToParent()
    → bulk-activation.completed    [final]
```

**Compensation Flow**:

```
POST /recurrings?paymentFail=true
  → ... → order.created            (payment-management)
  → payment.rejected               [compensation]
  → order.failed                   [compensation]
  → plan.order.failed              [compensation]
  → recurring.failed               [final]
```

#### Simulation Flags

| Endpoint                            | Description                                      |
| ----------------------------------- | ------------------------------------------------ |
| `POST /recurrings`                  | Happy path                                       |
| `POST /recurrings?paymentFail=true` | Payment rejected → compensation chain            |
| `POST /recurrings?transient=true`   | Transient error → retry exhausted → compensation |
| `POST /sim-swaps`                   | SIM swap with sub-saga fork + emitToParent       |
| `POST /bulk-activations?lines=N`    | Fan-out N sub-sagas (1-10)                       |

---

### [monitor](monitor/)

Real-time saga observability dashboard with a NestJS backend and Next.js frontend.

**Tech stack**: NestJS + Prisma + PostgreSQL + Redis (backend) | Next.js 14 + TanStack Query + SSE (frontend)

**Features**:

- Consumes all Kafka topics and builds a read-model of saga state
- Dashboard with metrics, filters, and real-time saga table
- Detail view with timeline, dependency tree, waterfall, and flamegraph visualizations
- Server-Sent Events for live updates

See [backend README](monitor/backend/README.md) and [frontend README](monitor/frontend/README.md) for architecture details.
