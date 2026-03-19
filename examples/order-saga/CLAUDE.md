# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm docker:up    # Start Kafka (KRaft) + Kafka UI (8080) + Jaeger (16686)
pnpm docker:down  # Stop infrastructure
pnpm start:dev    # Run with ts-node (no build needed)
pnpm build        # tsc compilation
pnpm load-test    # Node.js load test script
```

App runs on port **3000**. Monitor UI at `http://localhost:3000/monitor`.

### Triggering scenarios

```bash
# Scenario 1: Recurring billing
curl -X POST http://localhost:3000/recurrings
curl -X POST "http://localhost:3000/recurrings?paymentFail=true"   # triggers compensation
curl -X POST "http://localhost:3000/recurrings?transient=true"     # triggers retry/exhaustion

# Scenario 2: SIM Swap (sub-saga + resume parent)
curl -X POST http://localhost:3000/sim-swaps

# Scenario 3: Bulk Activation (fan-out N sub-sagas)
curl -X POST "http://localhost:3000/bulk-activations?lines=5"

# Scenario 4: Plan Upgrade (approval gate + compensation)
curl -X POST http://localhost:3000/upgrades

# Read state
curl http://localhost:3000/recurrings
curl http://localhost:3000/orders
curl http://localhost:3000/sim-swaps
curl http://localhost:3000/bulk-activations
```

## Architecture

There are two top-level domains in `src/`:

- **`telecom/`** — Current implementation. Participants live in `telecom/participants/{recurring,swap,activation,upgrade}/`.
- **`recurring-flow/`** — Earlier prototype. Kept for reference but not the active code path.

### Scenarios and patterns

**Scenario 1 — Recurring Billing** (`telecom/participants/recurring/`): Linear chain split into thin single-topic participants. Multi-handler classes have been split: `OrderRequestedParticipant`, `PaymentApprovedParticipant`, `PaymentRejectedParticipant` (from ordering-management), `PlanOrderRequestedParticipant`, `OrderCompletedBridgeParticipant`, `OrderFailedBridgeParticipant` (from plan-ordering-management), etc. `PaymentManagementParticipant` checks `paymentFail` flag and either completes or emits a `compensation` hint to roll back the chain.

**Scenario 2 — SIM Swap** (`telecom/participants/swap/`): `SimSwapForkParticipant` uses `@SagaParticipant("sim-swap.requested", { fork: true })` to spawn a `NumberPortability` sub-saga. `PortabilityValidatedParticipant` calls `emitToParent()` to resume the parent. Demonstrates the fork → sub-saga → emitToParent → resume pattern.

**Scenario 3 — Bulk Activation** (`telecom/participants/activation/`): `BulkActivationForkParticipant` uses `@SagaParticipant("bulk-activation.requested", { fork: true })` to fan out N `LineActivation` sub-sagas. `LineActivationCompletedParticipant` coordinates fan-in via a counter in `BulkActivationStore`.

**Scenario 4 — Plan Upgrade** (`telecom/participants/upgrade/`): Linear saga with an `UpgradeApproval` gate. Demonstrates multi-step compensation rollback triggered mid-chain. Each step is a separate thin participant class.

### Stores

Participants use in-memory stores (`telecom/stores/`) as their local state. Each store is a simple injectable NestJS service (`@Injectable()`) holding a `Map`. There is no database — state is lost on restart. Stores are updated inside handlers and read by REST controllers.

### Monitor integration

`src/monitor/` is a lightweight SSE endpoint + HTML dashboard embedded directly in the order-saga app (port 3000). It is separate from the full `examples/monitor` dashboard (port 3200) and uses a simple in-memory projection without Postgres/Redis.

### Tracing

`src/tracing.ts` sets up OpenTelemetry with the OTLP exporter pointing to Jaeger. It must be imported **before** any other module (done in `main.ts`). The `SagaModule` is configured with `otel.enabled: true` to use `W3cOtelContext`.

### delay.ts

`telecom/delay.ts` provides simulated async delays used by participants to mimic real service latency. Adjust values there to speed up or slow down scenario execution.
