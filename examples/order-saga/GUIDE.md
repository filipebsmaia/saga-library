# Guia de Uso — Telecom Saga Example

Este projeto demonstra o uso da biblioteca `@fbsm/saga-nestjs` com três cenários reais de telecomunicações, cada um explorando um padrão diferente de saga coreografada.

---

## Sumário

- [Pré-requisitos](#pré-requisitos)
- [Início Rápido](#início-rápido)
- [Arquitetura](#arquitetura)
- [Conceitos Fundamentais](#conceitos-fundamentais)
  - [Participant](#participant)
  - [Handler](#handler)
  - [Emit](#emit)
  - [EventHint](#eventhint)
  - [SagaRetryableError](#sagaretryableerror)
  - [Stores (Estado Local)](#stores-estado-local)
- [Cenário 1 — Recurring Billing (Cadeia Linear)](#cenário-1--recurring-billing-cadeia-linear)
- [Cenário 2 — SIM Swap (Parent → Sub-Saga → Parent Resume)](#cenário-2--sim-swap-parent--sub-saga--parent-resume)
- [Cenário 3 — Bulk Activation (Fan-Out / Fan-In)](#cenário-3--bulk-activation-fan-out--fan-in)
- [Sub-Sagas em Detalhe](#sub-sagas-em-detalhe)
- [Referência de Endpoints](#referência-de-endpoints)
- [Observabilidade](#observabilidade)
- [Configuração](#configuração)

---

## Pré-requisitos

- **Node.js** >= 18
- **pnpm** (gerenciador de pacotes do monorepo)
- **Docker** e **Docker Compose** (para Kafka, Jaeger e Kafka UI)

## Início Rápido

```bash
# 1. Subir a infraestrutura (Kafka, Kafka UI, Jaeger)
cd examples/order-saga
pnpm docker:up

# 2. Instalar dependências (na raiz do monorepo)
cd ../..
pnpm install

# 3. Build dos pacotes (na raiz do monorepo)
pnpm build

# 4. Iniciar a aplicação
cd examples/order-saga
pnpm start:dev

# 5. Abrir o monitor no browser
open http://localhost:3000/monitor
```

### Testando os 3 cenários

```bash
# Cenário 1: Recurring billing (happy path)
curl -X POST http://localhost:3000/recurrings
  
# Cenário 1: Com falha de pagamento (compensation)
curl -X POST "http://localhost:3000/recurrings?paymentFail=true"

# Cenário 1: Com erro transiente (retry + exhaustion)
curl -X POST "http://localhost:3000/recurrings?transient=true"

# Cenário 2: SIM Swap (parent espera sub-saga)
curl -X POST http://localhost:3000/sim-swaps

# Cenário 3: Bulk Activation (fan-out 5 sub-sagas)
curl -X POST "http://localhost:3000/bulk-activations?lines=5"
```

### Consultando estado

```bash
curl http://localhost:3000/recurrings
curl http://localhost:3000/orders
curl http://localhost:3000/products
curl http://localhost:3000/sim-swaps
curl http://localhost:3000/bulk-activations
```

### Encerrando

```bash
# Parar a aplicação: Ctrl+C no terminal

# Derrubar a infraestrutura
pnpm docker:down
```

---

## Arquitetura

```
┌──────────────────────────────────────────────────────┐
│                    NestJS App (:3000)                 │
│                                                      │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  Controller  │  │  Stores    │  │  Monitor     │  │
│  │  (HTTP API)  │  │  (Estado)  │  │  (SSE + UI)  │  │
│  └──────┬───────┘  └─────▲──────┘  └──────▲───────┘  │
│         │                │                │          │
│  ┌──────▼────────────────┴────────────────┴───────┐  │
│  │              SagaModule (@fbsm/saga-nestjs)          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │Publisher  │  │ Runner   │  │ Participants │  │  │
│  │  │(forSaga) │  │(dispatch)│  │ (handlers)   │  │  │
│  │  └────┬─────┘  └────▲─────┘  └──────────────┘  │  │
│  └───────┼──────────────┼──────────────────────────┘  │
└──────────┼──────────────┼────────────────────────────┘
           │    Kafka     │
           ▼              │
    ┌──────────────────────┐
    │   Apache Kafka       │
    │   (um tópico por     │
    │    tipo de evento)   │
    └──────────────────────┘
```

Cada **tipo de evento** corresponde a um **tópico Kafka**. Não existe um orquestrador central — os participantes reagem a eventos e emitem novos eventos, formando a coreografia.

---

## Conceitos Fundamentais

### Participant

Um participant é uma classe NestJS decorada com `@SagaParticipant()` que estende `SagaParticipantBase`. Cada participant tem um `serviceId` único e um ou mais handlers.

```typescript
import { Injectable } from '@nestjs/common';
import { SagaParticipant, SagaParticipantBase, SagaHandler } from '@fbsm/saga-nestjs';
import type { IncomingEvent, Emit } from '@fbsm/saga-nestjs';

@Injectable()
@SagaParticipant()
export class MeuParticipant extends SagaParticipantBase {
  readonly serviceId = 'meu-servico';

  @SagaHandler('pedido.criado')
  async handlePedidoCriado(event: IncomingEvent, emit: Emit): Promise<void> {
    // processar evento...
    await emit('pedido.processado', 'processar-pedido', { id: '123' });
  }
}
```

**Registrar no módulo:**

```typescript
@Module({
  providers: [MeuParticipant],
})
export class MeuModule {}
```

### Handler

O decorator `@SagaHandler(...eventTypes)` registra um método como handler para um ou mais tipos de evento.

```typescript
// Handler para um evento
@SagaHandler('order.created')
async handle(event: IncomingEvent, emit: Emit): Promise<void> { }

// Handler para múltiplos eventos
@SagaHandler('order.completed', 'order.failed')
async handle(event: IncomingEvent, emit: Emit): Promise<void> {
  if (event.eventType === 'order.completed') { /* ... */ }
  if (event.eventType === 'order.failed') { /* ... */ }
}
```

O handler recebe dois argumentos:

| Argumento | Tipo | Descrição |
|-----------|------|-----------|
| `event` | `IncomingEvent` | Evento recebido com payload, sagaId, etc. |
| `emit` | `Emit` | Função para emitir o próximo evento **na mesma saga** |

### Emit

A função `emit` publica um evento no Kafka vinculado à saga atual.

```typescript
await emit(eventType, stepName, payload, options?)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `eventType` | `string` | Tipo do evento (vira o tópico Kafka) |
| `stepName` | `string` | Identificador do passo (para rastreamento) |
| `payload` | `object` | Dados do evento |
| `options` | `{ hint?: EventHint }` | Opcional — dica sobre a natureza do evento |

**Quando usar `emit` vs `sagaPublisher.forSaga()`:**

| Cenário | O que usar |
|---------|-----------|
| Emitir na **mesma saga** | `emit(...)` (recebido como 2o parâmetro do handler) |
| Criar uma **sub-saga** | `sagaPublisher.forSaga(novoSagaId, { parentSagaId, rootSagaId })` |
| Retomar a **saga pai** | `sagaPublisher.forSaga(parentSagaId, { parentSagaId, rootSagaId })` |

### EventHint

O hint é um metadado que indica a **natureza** do evento. É propagado no header `saga-event-hint` do Kafka e usado pelo monitor para colorir e categorizar eventos.

| Hint | Quando usar |
|------|-------------|
| *(sem hint)* | Evento de progresso normal dentro da saga |
| `'terminal'` | Último evento da saga ou sub-saga — indica que ela **terminou** |
| `'compensation'` | Evento de compensação/rollback (falha) |
| `'spawn'` | Evento que **cria** uma nova sub-saga |

```typescript
// Progresso normal — sem hint
await emit('order.created', 'create-order', { orderId });

// Saga terminou com sucesso
await emit('order.completed', 'complete', { orderId }, { hint: 'terminal' });

// Compensação (falha)
await emit('order.failed', 'fail', { reason }, { hint: 'compensation' });

// Criando sub-saga
await subEmit('validation.requested', 'spawn-validation', data, { hint: 'spawn' });
```

### SagaRetryableError

Para erros **transientes** (timeout de API, indisponibilidade temporária), lance `SagaRetryableError`. O runner fará retry automático com backoff exponencial.

```typescript
import { SagaRetryableError } from '@fbsm/saga-nestjs';

@SagaHandler('order.created')
async handle(event: IncomingEvent, emit: Emit): Promise<void> {
  const response = await fetch('https://api-pagamento.com/pay');

  if (response.status === 503) {
    throw new SagaRetryableError('Gateway temporariamente indisponível');
  }
}
```

Para tratar o caso de **retries esgotados**, implemente `onRetryExhausted`:

```typescript
@Injectable()
@SagaParticipant()
export class PaymentParticipant extends SagaParticipantBase {
  readonly serviceId = 'payment';

  @SagaHandler('order.created')
  async handle(event: IncomingEvent, emit: Emit): Promise<void> {
    throw new SagaRetryableError('Timeout', 2); // max 2 retries
  }

  override async onRetryExhausted(
    event: IncomingEvent,
    error: SagaRetryableError,
    emit: Emit,
  ): Promise<void> {
    // Emitir compensação quando retries acabam
    await emit('payment.rejected', 'payment-exhausted', {
      reason: `Retries esgotados: ${error.message}`,
    }, { hint: 'compensation' });
  }
}
```

**Comportamento do retry:**

| Tentativa | Delay |
|-----------|-------|
| 1a | `initialDelayMs` (padrão: 500ms) |
| 2a | `initialDelayMs * 2` |
| 3a | `initialDelayMs * 4` |
| ... | backoff exponencial |

> Erros que **não** são `SagaRetryableError` são logados e descartados (sem retry).

### Stores (Estado Local)

Cada cenário usa stores in-memory para manter o estado dos registros. Em produção, seriam substituídos por um banco de dados.

```typescript
@Injectable()
export class OrderStore {
  private readonly records = new Map<string, OrderRecord>();

  create(orderId: string, sagaId: string, data: { ... }): OrderRecord { }
  updateStatus(orderId: string, status: OrderStatus): void { }
  findOne(orderId: string): OrderRecord | undefined { }
  findAll(): OrderRecord[] { }
}
```

Os stores são injetados nos participants e no controller via NestJS DI.

---

## Cenário 1 — Recurring Billing (Cadeia Linear)

Demonstra: **cadeia de eventos**, **compensação** e **retry com exaustão**.

### Fluxo Happy Path

```
POST /recurrings
       │
       ▼
  recurring.triggered
       │
       ▼  plan-management
  plan.order.requested
       │
       ▼  plan-ordering-management
  order.requested
       │
       ▼  ordering-management
  order.created
       │
       ▼  payment-management
  payment.approved
       │
       ▼  ordering-management
  order.completed
       │
       ▼  plan-ordering-management
  plan.order.completed
       │
       ▼  plan-recurring-management
  recurring.completed [terminal]
       │
       ▼  (nova saga independente)
  recurring.created [spawn] → product.activation.requested → product.provisioned → product.activated [terminal]
```

### Fluxo com Falha de Pagamento (Compensation)

```
POST /recurrings?paymentFail=true

  ... mesmo fluxo até order.created ...
       │
       ▼  payment-management
  payment.rejected [compensation]
       │
       ▼  ordering-management
  order.failed [compensation]
       │
       ▼  plan-ordering-management
  plan.order.failed [compensation]
       │
       ▼  plan-recurring-management
  recurring.failed [terminal]
```

### Fluxo com Erro Transiente (Retry)

```
POST /recurrings?transient=true

  ... mesmo fluxo até order.created ...
       │
       ▼  payment-management
  ❌ SagaRetryableError("Payment gateway timeout")
  ⏱ retry 1 (500ms) → ❌ falha
  ⏱ retry 2 (1000ms) → ❌ falha
  → onRetryExhausted → payment.rejected [compensation]
       │
       ▼  (mesmo fluxo de compensation acima)
```

### Participants

| Participant | Eventos | Responsabilidade |
|---|---|---|
| `plan-management` | `recurring.triggered` | Recebe trigger e inicia o fluxo de pedido |
| `plan-ordering-management` | `plan.order.requested`, `order.completed`, `order.failed` | Bridge entre domínios plan ↔ ordering |
| `ordering-management` | `order.requested`, `payment.approved`, `payment.rejected` | Gerencia ciclo de vida do pedido |
| `payment-management` | `order.created` | Processa pagamento (retry + compensation) |
| `plan-recurring-management` | `plan.order.completed`, `plan.order.failed` | Finaliza ciclo, inicia próximo |
| `mobile-product-lifecycle` | `recurring.created`, `product.provisioned` | Gerencia provisionamento do produto |
| `mobile-product-provision` | `product.activation.requested` | Provisiona produto na rede |

---

## Cenário 2 — SIM Swap (Parent → Sub-Saga → Parent Resume)

Demonstra: **sub-saga com retorno ao parent**. A saga pai espera a sub-saga completar antes de finalizar.

### Fluxo

```
POST /sim-swaps
       │
       ▼
  sim-swap.requested                    ← saga pai
       │
       ▼  sim-swap-orchestration
  portability.validation.requested      ← sub-saga [spawn]
       │                                   (pai fica RUNNING)
       ▼  number-portability
  portability.validated                 ← sub-saga [terminal]
       │
       ▼  sim-swap-orchestration
  sim-swap.completed                    ← saga pai [terminal]
                                           (pai retomado e finalizado)
```

### Como funciona

1. O controller cria uma saga pai e emite `sim-swap.requested`
2. O `sim-swap-orchestration` recebe o evento e **cria uma sub-saga** para validação:
   ```typescript
   const validationSagaId = uuidv7();
   const subEmit = this.sagaPublisher.forSaga(validationSagaId, {
     parentSagaId: event.sagaId,
     rootSagaId: event.rootSagaId,
   });
   await subEmit('portability.validation.requested', 'request-validation',
     { swapId, msisdn }, { hint: 'spawn' });
   // NÃO emite terminal — pai fica vivo
   ```
3. O `number-portability` processa a validação e emite `portability.validated` com `{ hint: 'terminal' }` — encerrando a **sub-saga**
4. O `sim-swap-orchestration` recebe o resultado da sub-saga e **retoma a saga pai**:
   ```typescript
   const parentEmit = this.sagaPublisher.forSaga(swap.sagaId, {
     parentSagaId: swap.sagaId,
     rootSagaId: event.rootSagaId,
   });
   await parentEmit('sim-swap.completed', 'complete', data, { hint: 'terminal' });
   ```

### Ponto-chave

O `SimSwapStore` mantém o mapeamento entre `validationSagaId` (sub-saga) e `sagaId` (pai). Quando a sub-saga completa, o orchestrator faz lookup no store para encontrar o sagaId do pai.

---

## Cenário 3 — Bulk Activation (Fan-Out / Fan-In)

Demonstra: **N sub-sagas em paralelo** com barreira de completude. A saga pai só finaliza quando **todas** as sub-sagas completam.

### Fluxo (com 3 linhas)

```
POST /bulk-activations?lines=3
       │
       ▼
  bulk-activation.requested                 ← saga pai
       │
       ▼  bulk-activation-orchestration
  ┌────┼────┐
  │    │    │
  ▼    ▼    ▼
  line-activation.requested (×3)            ← 3 sub-sagas [spawn]
  │    │    │                                  (pai fica RUNNING)
  ▼    ▼    ▼
  line-activation                           ← processamento paralelo
  │    │    │
  ▼    ▼    ▼
  line-activation.completed (×3)            ← sub-sagas [terminal]
       │
       ▼  bulk-activation-orchestration
  (fan-in: conta completions)
  completedLines == totalLines?
       │ sim
       ▼
  bulk-activation.completed                 ← saga pai [terminal]
```

### Como funciona

1. O controller cria a saga pai e emite `bulk-activation.requested`
2. O `bulk-activation-orchestration` recebe e faz **fan-out** de N sub-sagas:
   ```typescript
   for (let i = 0; i < lines; i++) {
     const subSagaId = uuidv7();
     this.bulkStore.addSubSaga(bulkId, subSagaId);

     const subEmit = this.sagaPublisher.forSaga(subSagaId, {
       parentSagaId: event.sagaId,
       rootSagaId: event.rootSagaId,
     });

     await subEmit('line-activation.requested', 'request-line', {
       bulkId, lineIndex: i, lineNumber,
     }, { hint: 'spawn' });
   }
   // NÃO emite terminal — pai espera todas
   ```
3. Cada `line-activation` processa independentemente e emite `line-activation.completed` com `{ hint: 'terminal' }`
4. O `bulk-activation-orchestration` recebe cada completion e incrementa o contador (**fan-in**):
   ```typescript
   const bulk = this.bulkStore.incrementCompleted(bulkId);

   if (bulk.completedLines >= bulk.totalLines) {
     // TODAS completaram — retoma e finaliza o pai
     const parentEmit = this.sagaPublisher.forSaga(bulk.sagaId, { ... });
     await parentEmit('bulk-activation.completed', 'complete', data, { hint: 'terminal' });
   }
   ```

### Ponto-chave

O `BulkActivationStore` mantém o contador `completedLines` como **barreira de fan-in**. Cada sub-saga que completa incrementa o contador. Quando `completedLines >= totalLines`, a saga pai é retomada e finalizada.

---

## Sub-Sagas em Detalhe

### O que é uma sub-saga?

Uma sub-saga é uma saga independente que possui um **parentSagaId** e um **rootSagaId**. Ela é criada quando um participant precisa delegar trabalho a outro fluxo sem finalizar a saga pai.

### Quando usar sub-sagas

| Padrão | Quando usar | Exemplo |
|--------|-------------|---------|
| **Sem sub-saga** | Fluxo linear, cada passo emite para o próximo | Recurring billing |
| **Sub-saga com retorno** | Precisa de um resultado antes de continuar | SIM swap → validação → continua swap |
| **Fan-out de sub-sagas** | Precisa executar N operações em paralelo | Bulk activation → N ativações |
| **Sub-saga fire-and-forget** | Trabalho independente que não afeta o pai | Recurring → provisionamento de produto |

### Como criar uma sub-saga

```typescript
import { v7 as uuidv7 } from 'uuid';

// 1. Gerar novo sagaId para a sub-saga
const subSagaId = uuidv7();

// 2. Criar emit vinculado à sub-saga, com contexto do pai
const subEmit = this.sagaPublisher.forSaga(subSagaId, {
  parentSagaId: event.sagaId,     // quem é o pai
  rootSagaId: event.rootSagaId,   // raiz da árvore (não muda)
});

// 3. Emitir o primeiro evento da sub-saga
await subEmit('sub-task.requested', 'start-sub-task', {
  ...dados,
  parentSagaId: event.sagaId,     // passar no payload para lookup posterior
}, { hint: 'spawn' });

// 4. NÃO emitir terminal aqui — o pai fica "esperando"
```

### Como retomar a saga pai

```typescript
// No handler que recebe o resultado da sub-saga:

// 1. Buscar o sagaId do pai (via store ou payload)
const parent = this.store.findBySagaId(event.sagaId);

// 2. Criar emit vinculado ao PAI
const parentEmit = this.sagaPublisher.forSaga(parent.sagaId, {
  parentSagaId: parent.sagaId,
  rootSagaId: event.rootSagaId,
});

// 3. Emitir terminal no pai
await parentEmit('parent-task.completed', 'resume-parent', {
  resultado: '...',
}, { hint: 'terminal' });
```

### Propagação de IDs

```
rootSagaId     → Sempre o mesmo ao longo de toda a árvore
parentSagaId   → O sagaId do pai imediato
sagaId         → Único por saga/sub-saga

Exemplo (Bulk Activation com 3 linhas):

  saga-001 (root, pai)     rootSagaId=saga-001, parentSagaId=undefined
    ├── saga-002 (sub)     rootSagaId=saga-001, parentSagaId=saga-001
    ├── saga-003 (sub)     rootSagaId=saga-001, parentSagaId=saga-001
    └── saga-004 (sub)     rootSagaId=saga-001, parentSagaId=saga-001
```

---

## Referência de Endpoints

### Recurring Billing

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/recurrings` | Trigger recurring (happy path) |
| `POST` | `/recurrings?paymentFail=true` | Simula rejeição de pagamento → compensation |
| `POST` | `/recurrings?transient=true` | Simula erro transiente → retry → exhaustion |
| `GET` | `/recurrings` | Lista todos os ciclos de recurring |
| `GET` | `/orders` | Lista todos os pedidos |
| `GET` | `/products` | Lista todos os produtos provisionados |

### SIM Swap

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/sim-swaps` | Inicia SIM swap (parent + sub-saga) |
| `GET` | `/sim-swaps` | Lista todos os SIM swaps |

### Bulk Activation

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/bulk-activations?lines=N` | Inicia bulk activation com N linhas (1-10, padrão 3) |
| `GET` | `/bulk-activations` | Lista todas as bulk activations |

---

## Observabilidade

| Ferramenta | URL | Descrição |
|------------|-----|-----------|
| **Saga Monitor** | http://localhost:3000/monitor | Dashboard com Trace, Waterfall e Flame Graph |
| **Jaeger UI** | http://localhost:16686 | Distributed tracing (spans por saga) |
| **Kafka UI** | http://localhost:8080 | Inspeção de tópicos e mensagens |

### Saga Monitor

O monitor oferece 3 visualizações:

- **Trace** — Lista cronológica de eventos por saga
- **Waterfall** — Timeline horizontal mostrando duração de cada evento
- **Flame Graph** — Visualização hierárquica com parent/sub-sagas

Cada visualização suporta o toggle **Grouped/Individual**:
- **Grouped** — Sub-sagas agrupadas sob o root saga
- **Individual** — Cada saga exibida separadamente

---

## Configuração

### SagaModule

```typescript
// app.module.ts
SagaModule.forRoot({
  serviceName: 'saga',
  transport: new KafkaTransport({
    brokers: ['localhost:9092'],
    clientId: 'saga',
    autoCreateTopics: true,
  }),
  retryPolicy: {
    maxRetries: 3,         // tentativas antes de chamar onRetryExhausted
    initialDelayMs: 500,   // delay base (backoff exponencial)
  },
  otel: { enabled: true }, // habilita OpenTelemetry tracing
}),
```

### Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SAGA_DELAY_MIN` | `200` | Delay mínimo (ms) da simulação nos participants |
| `SAGA_DELAY_MAX` | `2500` | Delay máximo (ms) da simulação nos participants |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | Endpoint do coletor OTLP |

### Scripts

| Script | Comando | Descrição |
|--------|---------|-----------|
| `start:dev` | `pnpm start:dev` | Inicia com ts-node (desenvolvimento) |
| `build` | `pnpm build` | Compila TypeScript |
| `start` | `pnpm start` | Inicia build compilado |
| `docker:up` | `pnpm docker:up` | Sobe Kafka + Jaeger + Kafka UI |
| `docker:down` | `pnpm docker:down` | Derruba infraestrutura |
