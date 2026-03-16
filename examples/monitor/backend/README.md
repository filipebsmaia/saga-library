# Saga Monitor Backend

Backend de observabilidade para sagas coreografadas. Consome eventos Kafka, projeta estado da saga, e expõe APIs REST + SSE para monitoramento em tempo real.

## Visão Arquitetural

```
Kafka Topics ──► Kafka Projector ──► Postgres (saga_state + saga_event_log)
                       │
                       └──► Redis Pub/Sub ──► SSE Endpoints ──► Dashboard
```

O sistema é um **read-model**: observa sagas sem interferir na execução. Usa headers Kafka (`saga-id`, `saga-event-hint`, etc.) como fonte principal de informação.

### Componentes

1. **Kafka Projector** — Consome todos os tópicos, filtra mensagens com `saga-id` header, deduplica por `saga-event-id`, projeta estado em Postgres e publica no Redis
2. **REST API** — Listagem, detalhe, timeline, árvore root/child, métricas
3. **SSE API** — Streams em tempo real via Redis pub/sub
4. **Redis** — Pub/Sub (realtime), contadores (dashboard), sorted sets (recentes)

## Como Rodar

### 1. Subir infraestrutura

```bash
docker compose up -d
```

Serviços: Postgres (5432), Redis (6379), Kafka KRaft (9092)

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Gerar Prisma Client e rodar migrations

```bash
pnpm prisma:generate
pnpm prisma:migrate:dev
```

### 4. Iniciar aplicação

```bash
pnpm start:dev
```

App roda na porta 3100. Swagger disponível em `http://localhost:3100/api`.

### 5. Testar com order-saga

```bash
# Em outro terminal, na raiz do monorepo:
cd examples/order-saga
npm run docker:up   # Se ainda não subiu Kafka
npm run start:dev

# Trigger uma saga:
curl -X POST http://localhost:3000/recurrings
```

## Endpoints

### REST (`/v1/sagas`)

| Método | Path                        | Descrição                                                              |
| ------ | --------------------------- | ---------------------------------------------------------------------- |
| GET    | `/v1/sagas`                 | Lista sagas (filtros: status, sagaName, sagaRootId; cursor pagination) |
| GET    | `/v1/sagas/:sagaId`         | Detalhe da saga                                                        |
| GET    | `/v1/sagas/:sagaId/events`  | Timeline de eventos (cursor pagination)                                |
| GET    | `/v1/sagas/root/:rootId`    | Árvore de sagas por root ID                                            |
| GET    | `/v1/sagas/:sagaId/metrics` | Métricas da execução                                                   |

### SSE (`/v1/stream/sagas`)

| Path                            | Descrição                      |
| ------------------------------- | ------------------------------ |
| `/v1/stream/sagas`              | Stream global de updates       |
| `/v1/stream/sagas/:sagaId`      | Updates de uma saga específica |
| `/v1/stream/sagas/root/:rootId` | Updates da árvore raiz         |

## Modelo de Dados

### `saga_state` — Snapshot atual (uma linha por saga)

Campos principais: `saga_id` (PK), `saga_root_id`, `saga_parent_id`, `status` (RUNNING/COMPENSATING/COMPLETED), `current_step_name`, `event_count`, `started_at`, `updated_at`, `ended_at`

### `saga_event_log` — Timeline append-only (uma linha por evento)

Campos principais: `saga_event_id` (PK), `saga_id`, `saga_step_name`, `saga_event_hint`, `status_before`, `status_after`, `saga_published_at`, `topic`, `partition`, `offset`

## Derivação de Status

| `saga-event-hint` | Status resultante     |
| ----------------- | --------------------- |
| `step`            | RUNNING               |
| `fork`            | RUNNING               |
| `compensation`    | COMPENSATING (sticky) |
| `final`           | COMPLETED             |

COMPENSATING é "sticky" — uma vez compensando, permanece compensando até receber `final`.

## Performance

- **Idempotência**: Dedup por `saga-event-id` antes de processar
- **Upsert eficiente**: `saga_state` usa upsert com version increment
- **Append-only**: `saga_event_log` é insert-only
- **Índices**: Otimizados para leitura por status, root_id, saga_id, período
- **Separação leitura**: Listagem usa `saga_state`, timeline usa `saga_event_log`
- **Consistência**: Postgres commit primeiro, Redis publish depois
- **Trade-off SSE**: Pequena janela onde DB tem dado mas Redis ainda não notificou — aceitável para observabilidade

## Redis Keys

| Key                        | Tipo    | Uso                     |
| -------------------------- | ------- | ----------------------- |
| `obs:saga:all`             | Pub/Sub | Stream global SSE       |
| `obs:saga:id:{id}`         | Pub/Sub | Stream por saga         |
| `obs:saga:root:{rootId}`   | Pub/Sub | Stream por raiz         |
| `obs:dash:global:counters` | HASH    | Contadores do dashboard |
| `obs:recent:sagas`         | ZSET    | Sagas recentes          |
| `obs:recent:events`        | ZSET    | Eventos recentes        |
| `obs:recent:failed`        | ZSET    | Sagas compensando       |

## Testes

```bash
pnpm test        # Rodar testes
pnpm test:watch  # Watch mode
```

Testes unitários cobrem:

- Derivação de status (todas as combinações hint × status)
- Extração de headers Kafka (Buffer/string, campos opcionais, validação de hints)

## Limitações e Próximos Passos

- [ ] Métricas comparativas por saga-name (p95, duração média)
- [ ] Cache de snapshot em Redis com TTL
- [ ] Batch processing otimizado no projector
- [ ] Testes de integração com Postgres real
- [ ] Testes E2E (Kafka → Postgres → REST)
- [ ] Healthcheck endpoint
- [ ] Profundidade da árvore nas métricas
- [ ] Suporte a multi-tenant
