# Saga Monitor Frontend

Real-time saga orchestration monitoring dashboard built with Next.js.

## Quick Start

```bash
# 1. Start the backend (requires Postgres, Redis, Kafka)
cd ../backend
docker compose up -d
pnpm install && pnpm start:dev

# 2. Start the frontend
cd ../frontend
pnpm install
pnpm dev
# Open http://localhost:3200
```

### Environment

| Variable      | Default                 | Description          |
| ------------- | ----------------------- | -------------------- |
| `BACKEND_URL` | `http://localhost:3100` | Backend API base URL |

## Architecture

### Server vs Client Components

```
Pages (Server Components) → initial data fetch
  └─ Client Components → interactivity, SSE, charts
       └─ React.lazy + Suspense → heavy visualizations
```

- **Server Components**: `app/page.tsx`, `app/sagas/[sagaId]/page.tsx` — async data fetching
- **Client Components**: filters, tables, timeline, SSE listeners
- **Lazy loaded**: WaterfallChart, FlamegraphChart — loaded only when user expands the section

### Real-time Strategy

1. **SSE** via native `EventSource` with auto-reconnect (exponential backoff 1s→30s)
2. SSE messages **invalidate TanStack Query cache** (debounced 300ms)
3. **Fallback**: periodic refetch every 10s when SSE disconnected
4. **Deduplication**: rolling Set of 1000 event IDs prevents duplicate processing

### Component Organization

Each major component provides:

- `Component` — main rendering
- `ComponentLoading` — skeleton/loading state
- `ComponentEmpty` — empty state (when applicable)

### Views

| Route             | Description                                                                       |
| ----------------- | --------------------------------------------------------------------------------- |
| `/`               | Dashboard: metrics cards, filters, saga table with real-time highlights           |
| `/sagas/[sagaId]` | Saga detail: header, timeline, causal chain, metrics, tree, waterfall, flamegraph |
| `/roots/[rootId]` | Root tree: hierarchical view of saga tree + table                                 |

### Visualization Heuristics

**Waterfall spans**: Duration = gap between consecutive events in same saga. First span starts at `saga.startedAt`. RUNNING saga's last span is open-ended (estimated). Gaps >60s are capped.

**Flamegraph nodes**: Tree mirrors saga hierarchy (root → children → steps). Width proportional to duration. `selfMs = duration - sum(children)`. Click to zoom into subtree.

## Backend Integration

The frontend proxies all `/api/v1/*` requests to the NestJS backend via Next.js rewrites (`next.config.mjs`). Server Components call the backend directly via `serverFetch`.

### API Endpoints (from backend)

| Method | Path                            | Description                                                           |
| ------ | ------------------------------- | --------------------------------------------------------------------- |
| GET    | `/v1/sagas`                     | List sagas (cursor pagination, filters: status, sagaName, sagaRootId) |
| GET    | `/v1/sagas/:sagaId`             | Saga detail                                                           |
| GET    | `/v1/sagas/:sagaId/events`      | Saga events (cursor pagination)                                       |
| GET    | `/v1/sagas/:sagaId/metrics`     | Saga metrics (elapsed, stuck, forks, etc.)                            |
| GET    | `/v1/sagas/root/:rootId`        | Saga tree by root ID                                                  |
| SSE    | `/v1/stream/sagas`              | Global saga updates stream                                            |
| SSE    | `/v1/stream/sagas/:sagaId`      | Per-saga updates stream                                               |
| SSE    | `/v1/stream/sagas/root/:rootId` | Per-root tree updates stream                                          |

### Mock Data (for testing)

Mock data generators are available in `lib/mock/` for testing purposes. Scenarios include simple success, compensation, fork, long-running, and stuck sagas.

## Tech Stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- SASS/SCSS (CSS Modules)
- TanStack Query v5
- Native EventSource (SSE)
- Custom Canvas (Waterfall + Flamegraph)
- Vitest

## Limitations

- No authentication/authorization
- Dark mode only (no light theme toggle)
- Waterfall/flamegraph durations are estimated from event gaps (no explicit span start/end from backend)
- No virtualization for very long timelines yet (>500 events)
- Comparative metrics (p95, avg by saga-name) not implemented (backend doesn't expose aggregate endpoints yet)
