# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm docker:up             # Start Postgres (5432) + Redis (6379) + Kafka KRaft (9092)
pnpm prisma:generate       # Regenerate Prisma client after schema changes
pnpm prisma:migrate:dev    # Create + apply a new migration (interactive)
pnpm prisma:migrate:deploy # Apply migrations (non-interactive, for CI/prod)
pnpm start:dev             # ts-node with tsconfig-paths
pnpm build                 # nest build → dist/
pnpm test                  # vitest run
pnpm test:watch            # vitest (watch)
```

App runs on port **3100**. Swagger at `http://localhost:3100/api`.

## Architecture

```
Kafka Topics ──► KafkaProjector ──► Postgres (saga_state + saga_event_log)
                      │
                      └──► Redis Pub/Sub ──► SSE endpoints ──► Frontend
```

This is a **read-model / observer**: it only reads Kafka, never writes to the saga topics.

### KafkaProjector

Consumes **all topics** using a wildcard/regex subscription. For each message:
1. Checks for `saga-id` header — skips non-saga messages
2. Deduplicates by `saga-event-id` (idempotent)
3. **Upserts** `saga_state` (snapshot, one row per saga)
4. **Inserts** `saga_event_log` (append-only event)
5. Publishes to Redis pub/sub channels after Postgres commit

**Status derivation** from `saga-event-hint`:

| hint | status |
|------|--------|
| `step` / `fork` | RUNNING |
| `compensation` | COMPENSATING (sticky — stays until `final`) |
| `final` | COMPLETED |

COMPENSATING is sticky: once set, only `final` can transition it to COMPLETED.

### Data model

**`saga_state`** — one row per saga (snapshot). Key fields: `saga_id`, `saga_root_id`, `saga_parent_id`, `status`, `current_step_name`, `event_count`, `started_at`, `updated_at`, `ended_at`.

**`saga_event_log`** — append-only event timeline. Key fields: `saga_event_id` (PK, the dedup key), `saga_id`, `saga_step_name`, `saga_event_hint`, `status_before`, `status_after`, `saga_published_at`, `topic`, `partition`, `offset`.

### Redis key layout

| Key | Type | Purpose |
|-----|------|---------|
| `obs:saga:all` | Pub/Sub | Global SSE stream |
| `obs:saga:id:{id}` | Pub/Sub | Per-saga SSE |
| `obs:saga:root:{rootId}` | Pub/Sub | Per-root SSE |
| `obs:dash:global:counters` | HASH | Dashboard counters |
| `obs:recent:sagas` | ZSET | Recently active sagas |
| `obs:recent:events` | ZSET | Recent events |
| `obs:recent:failed` | ZSET | Sagas in COMPENSATING |

### REST endpoints

All under `/v1/sagas`:
- `GET /` — list with cursor pagination, filters: `status`, `sagaName`, `sagaRootId`, `rootsOnly`, `activeOnly`
- `GET /:sagaId` — saga detail
- `GET /:sagaId/events` — timeline (cursor pagination)
- `GET /root/:rootId` — full saga tree
- `GET /:sagaId/metrics` — execution metrics

SSE under `/v1/stream/sagas`: global, `/:sagaId`, `/root/:rootId`.

### Tests

Unit tests cover status derivation (all hint × status combinations) and Kafka header extraction (Buffer/string, optional fields, hint validation). Located in `src/**/*.spec.ts`.
