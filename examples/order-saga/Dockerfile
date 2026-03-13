FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
WORKDIR /app

# ── Install all workspace dependencies (including linked packages) ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/saga-core/package.json packages/saga-core/
COPY packages/saga-nestjs/package.json packages/saga-nestjs/
COPY packages/saga-transport-kafka/package.json packages/saga-transport-kafka/
COPY examples/order-saga/package.json examples/order-saga/
RUN pnpm install --frozen-lockfile --filter @saga/example-saga...

# ── Build workspace packages + app ──
FROM deps AS build
COPY packages packages/
COPY examples/order-saga examples/order-saga/
RUN pnpm -r --filter './packages/**' run build
WORKDIR /app/examples/order-saga
RUN npx tsc

# ── Runtime ──
FROM build AS runtime
EXPOSE 3000
CMD ["node", "dist/main.js"]
