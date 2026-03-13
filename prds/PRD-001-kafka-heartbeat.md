# PRD-001 — Kafka Heartbeat: automático e manual

> **Service:** `@fbsm/saga-transport-kafka`
> **Status:** Approved
> **Created:** 2026-03-13

---

## 1. Problem statement

O `KafkaTransport` chama `heartbeat()` apenas **após** a conclusão de cada mensagem, nunca durante. O Kafka broker usa o `sessionTimeout` (padrão KafkaJS: 30 s) para detectar consumers mortos; se um handler de saga demorar mais que esse limite, o broker expulsa o consumer do grupo e dispara um **rebalance**, fazendo a mensagem ser reprocessada.

Handlers de longa duração são comuns em sagas que envolvem provisionamento de dispositivos, integrações com sistemas legados ou processamento de lotes pesados. Sem proteção de heartbeat, esses handlers causam reprocessamentos indesejados e tornam a operação instável.

## 2. Goals

- [ ] Handlers com duração > `sessionTimeout` não causam rebalance de consumer group
- [ ] Zero breaking change nas interfaces públicas (`SagaTransport`, `EventHandler`, `@SagaHandler`)
- [ ] Usuários avançados podem controlar o heartbeat manualmente via `getKafkaHeartbeat()`
- [ ] `sessionTimeout` e `heartbeatInterval` configuráveis para cenários extremos
- [ ] Exemplo funcional no order-saga demonstrando o padrão

## 3. Non-goals (out of scope)

- Não altera `saga-core`, `saga-nestjs` nem qualquer interface de transporte genérica
- Não introduz retry automático baseado em heartbeat
- Não cobre outros transportes além de Kafka
- Não modifica o comportamento de offset commit ou watermark tracking

## 4. Background & context

### Comportamento atual

```
processBatch:
  for each message:
    await handler(inbound)   ← pode demorar N segundos
    resolveOffset(...)
    await heartbeat()        ← só aqui, depois que o handler terminou
```

O KafkaJS em modo `eachBatch` não envia heartbeats automaticamente enquanto a função está rodando. O background heartbeat loop do KafkaJS opera em nível de consumer, mas durante a execução de `eachBatch` ele fica bloqueado esperando o retorno da função.

### Limites KafkaJS por padrão

| Parâmetro           | Default   | Significado                                                    |
| ------------------- | --------- | -------------------------------------------------------------- |
| `sessionTimeout`    | 30 000 ms | Tempo máximo sem heartbeat antes do broker expulsar o consumer |
| `heartbeatInterval` | 5 000 ms  | Frequência com que o consumer tenta enviar heartbeats          |

### Por que reprocessamento duplo é problemático em sagas

Em sagas, cada evento carrega estado de compensação. Um reprocessamento inesperado pode disparar etapas de negócio já executadas (ex: cobrança duplicada, provisionamento duplo) antes que o framework detecte a idempotência.

## 5. Requirements

### Functional requirements

- O sistema **must** iniciar um `setInterval` por mensagem que chama `heartbeat()` periodicamente enquanto o handler estiver rodando
- O sistema **must** cancelar o interval ao término do handler (tanto em sucesso quanto em exceção)
- O sistema **must** expor `getKafkaHeartbeat(): (() => Promise<void>) | undefined` para uso manual dentro de handlers
- O sistema **must** retornar `undefined` de `getKafkaHeartbeat()` quando chamado fora do contexto de um consumer KafkaJS
- O sistema **should** aceitar `autoHeartbeatInterval: 0` para desativar o interval automático
- O sistema **should** aceitar `sessionTimeout` e `heartbeatInterval` em `KafkaTransportOptions` e passá-los ao consumer

### Non-functional requirements

- A função `getKafkaHeartbeat()` deve usar `AsyncLocalStorage` para propagação zero-invasiva de contexto
- O overhead do `setInterval` com interval de 5 s é negligenciável para workloads típicos
- Nenhuma mudança de assinatura em interfaces exportadas por `saga-core` ou `saga-nestjs`

## 6. Technical scope

### New or changed API surface

| Type   | Method / Export         | Package                      | Description                                                           |
| ------ | ----------------------- | ---------------------------- | --------------------------------------------------------------------- |
| Export | `getKafkaHeartbeat()`   | `@fbsm/saga-transport-kafka` | Retorna a função `heartbeat` do KafkaJS via AsyncLocalStorage         |
| Option | `autoHeartbeatInterval` | `KafkaTransportOptions`      | Interval do heartbeat automático em ms. Default: 5000. 0 = desativado |
| Option | `sessionTimeout`        | `KafkaTransportOptions`      | Passado ao `kafka.consumer()`. Default: KafkaJS default (30000)       |
| Option | `heartbeatInterval`     | `KafkaTransportOptions`      | Passado ao `kafka.consumer()`. Default: KafkaJS default (3000)        |

### Schema changes

None.

### Kafka events

None.

### External integrations

None. Mudança interna ao transport layer.

## 7. Milestones

| #   | Milestone                    | Description                                                                                                |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Novas opções de configuração | Adicionar `autoHeartbeatInterval`, `sessionTimeout`, `heartbeatInterval` em `KafkaTransportOptions`        |
| 2   | Background heartbeat         | Implementar `setInterval` + `finally clearInterval` em `processBatch`, envolvendo `await handler(inbound)` |
| 3   | AsyncLocalStorage manual     | Criar `kafkaHeartbeatStore` (ALS) e `getKafkaHeartbeat()`, envolver handler com `run()`                    |
| 4   | Re-export público            | Exportar `getKafkaHeartbeat` em `index.ts`                                                                 |
| 5   | Documentação do package      | Atualizar `packages/saga-transport-kafka/CLAUDE.md` com seção Heartbeat management                         |
| 6   | Exemplo prático              | Criar `DeviceProvisioningParticipant` no order-saga (modo manual) e registrar no `TelecomModule`           |
| 7   | Endpoint de trigger          | Adicionar `POST /provisionings` no `TelecomController`                                                     |
| 8   | Guia atualizado              | Adicionar seção no `examples/order-saga/GUIDE.md` explicando os dois modos                                 |
| 9   | Testes                       | 4 novos casos de teste cobrindo auto interval, desativação, ALS e opções do consumer                       |

## 8. Acceptance criteria

- [ ] Handler com duração de 35 s não causa rebalance com `autoHeartbeatInterval: 5_000` (padrão)
- [ ] `getKafkaHeartbeat()` retorna a função `heartbeat` do KafkaJS dentro de um handler
- [ ] `getKafkaHeartbeat()` retorna `undefined` quando chamado fora de um handler Kafka
- [ ] `autoHeartbeatInterval: 0` desativa o `setInterval` sem afetar o heartbeat pós-mensagem
- [ ] `sessionTimeout` e `heartbeatInterval` são passados ao `kafka.consumer()`
- [ ] Todos os testes existentes continuam passando (zero regressão)
- [ ] 4 novos testes adicionados e passando
- [ ] `DeviceProvisioningParticipant` roda sem erros no order-saga
- [ ] `pnpm typecheck` e `pnpm run build` sem erros

## 9. Risks & dependencies

| Risk / Dependency                                                   | Likelihood | Impact | Mitigation                                                                               |
| ------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------- |
| `setInterval` em Vitest pode interferir com timers de outros testes | Baixa      | Médio  | Usar `vi.useFakeTimers()` apenas nos testes de heartbeat; demais testes não são afetados |
| `clearInterval` não chamado em caso de exceção não capturada        | Baixa      | Baixo  | O `finally` garante limpeza mesmo em exceções                                            |
| Handlers que chamam `getKafkaHeartbeat()` em outros transportes     | Baixa      | Baixo  | Retorno `undefined` + uso de `?.()` torna o código safe                                  |
| `autoHeartbeatInterval` menor que `heartbeatInterval` do broker     | Média      | Baixo  | Documentar que `autoHeartbeatInterval` deve ser menor que `sessionTimeout / 3`           |

## 10. Open questions

- [ ] Adicionar validação em runtime que lança se `autoHeartbeatInterval > 0 && autoHeartbeatInterval >= sessionTimeout`?

## 11. Decision log

| Date & Time | Decision                                                | Rationale                                                                                                                                             | Impact                                  |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 2026-03-13  | Usar AsyncLocalStorage para expor heartbeat manualmente | Evita breaking change em `EventHandler` e mantém a arquitetura de contexto consistente com o padrão já usado para `SagaContext`                       | Zero mudança em saga-core e saga-nestjs |
| 2026-03-13  | `autoHeartbeatInterval` default = 5000 ms               | Valor seguro para `sessionTimeout` de 30 s: 6 heartbeats por sessão — alinhado com a recomendação KafkaJS de `heartbeatInterval < sessionTimeout / 3` | Proteção automática sem configuração    |
| 2026-03-13  | Manter `heartbeat()` pós-mensagem (linha 190)           | O heartbeat pós-mensagem sinaliza ao broker que o consumer processou com sucesso; não é redundante com o interval                                     | Nenhum                                  |
