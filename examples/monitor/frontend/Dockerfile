FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY examples/monitor/frontend/package.json examples/monitor/frontend/
RUN pnpm install --frozen-lockfile --filter @saga/monitor-frontend

# ── Build ──
FROM deps AS build
COPY examples/monitor/frontend examples/monitor/frontend/
WORKDIR /app/examples/monitor/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# ── Runtime ──
FROM build AS runtime
EXPOSE 3200
CMD ["npx", "next", "start", "--port", "3200"]
