# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev         # Next.js dev server on port 3200
pnpm build       # Production build
pnpm start       # Production server on port 3200
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm test:watch  # vitest (watch)
```

Environment variable: `BACKEND_URL` (default `http://localhost:3100`).

## Architecture

### Rendering strategy

```
Server Components (pages) → initial data fetch via serverFetch()
  └─ Client Components → filters, SSE listeners, interactive charts
       └─ React.lazy + Suspense → WaterfallChart, FlamegraphChart (heavy)
```

Server Components (`app/page.tsx`, `app/sagas/[sagaId]/page.tsx`) call the backend directly using `BACKEND_URL`. Client Components go through the Next.js rewrite proxy (`/api/v1/*` → `BACKEND_URL/v1/*`), configured in `next.config.mjs`.

### Real-time strategy

SSE is implemented with native `EventSource` (no library). The lifecycle:
1. `EventSource` connects to `/api/v1/stream/sagas[/...]`
2. On message: debounce 300ms, then `queryClient.invalidateQueries()`
3. On error: exponential backoff reconnect (1s → 30s cap)
4. Fallback: `refetchInterval: 10_000` when SSE is disconnected
5. Deduplication: rolling `Set` of 1000 event IDs to skip duplicates

**Home table SSE** — updates existing rows only. New sagas arriving via SSE are NOT added to the table; instead a refresh banner appears. This is intentional to avoid disorienting table jumps.

**Detail page SSE** — uses absolute `BACKEND_URL` (not the proxy), and invalidates both `saga-events` and `saga-events-all` query keys.

### Filters

- **Server-side** (sent as query params to backend): `rootsOnly`, `activeOnly`
- **Client-side** (applied to cached data): `stuck`, `compensating`, `recentOnly`, incident-mode sorting

### Routes

| Route | Description |
|-------|-------------|
| `/` | Metrics cards + filterable saga table |
| `/sagas/[sagaId]` | Header, timeline, causal chain, metrics, tree, waterfall, flamegraph |
| `/roots/[rootId]` | Hierarchical saga tree + table |

### Visualizations

Both charts are canvas-based (no charting library):

**WaterfallChart** — Span duration = gap between consecutive events in same saga. First span starts at `saga.startedAt`. For RUNNING sagas, the last span is open-ended (estimated). Gaps >60s are capped to avoid distortion.

**FlamegraphChart** — Mirrors saga hierarchy (root → children → steps). Width is proportional to duration. `selfMs = duration − sum(children)`. Clicking zooms into a subtree.

Both are wrapped in `React.lazy` — they don't load until the user expands the section.

### Component conventions

Each significant UI section follows this pattern:
- `Component` — main rendering
- `ComponentLoading` — skeleton state
- `ComponentEmpty` — empty/no-data state (where applicable)

### Mock data

`lib/mock/` contains generators for testing without a running backend: simple success, compensation, fork, long-running, and stuck scenarios.
