FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
WORKDIR /app

# ── Install dependencies ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY examples/monitor/backend/package.json examples/monitor/backend/
COPY examples/monitor/backend/prisma examples/monitor/backend/prisma/
RUN pnpm install --frozen-lockfile --filter @saga/monitor-backend

# ── Build ──
FROM deps AS build
COPY examples/monitor/backend examples/monitor/backend/
WORKDIR /app/examples/monitor/backend
RUN npx prisma generate
RUN npx nest build

# ── Runtime (reuse build — pnpm symlinks stay intact) ──
FROM build AS runtime
EXPOSE 3100
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
