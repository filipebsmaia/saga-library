import { SagaStateDto, SagaEventDto, SagaMetricsDto, SagaStatus } from '@/lib/types/saga';
import { generateSagaState, generateSagaEvent, generateSagaMetrics } from './generators';

// ---------------------------------------------------------------------------
// Scenario 1: Simple successful saga (5 steps -> COMPLETED)
// ---------------------------------------------------------------------------
const simpleRootId = 'saga-simple-001';
const simpleStarted = new Date(Date.now() - 25 * 60_000);

const simpleSaga = generateSagaState({
  sagaId: simpleRootId,
  sagaRootId: simpleRootId,
  sagaName: 'order-processing',
  sagaDescription: 'Process a standard e-commerce order',
  status: SagaStatus.COMPLETED,
  currentStepName: 'finalize-order',
  lastEventHint: 'final',
  startedAt: simpleStarted.toISOString(),
  updatedAt: new Date(simpleStarted.getTime() + 12_000).toISOString(),
  endedAt: new Date(simpleStarted.getTime() + 12_000).toISOString(),
  eventCount: 5,
  version: 5,
});

const simpleEvents: SagaEventDto[] = [
  generateSagaEvent(simpleRootId, simpleRootId, 0, simpleStarted, {
    sagaStepName: 'validate-input', sagaEventHint: 'step', statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(simpleRootId, simpleRootId, 1, simpleStarted, {
    sagaStepName: 'reserve-stock', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(simpleRootId, simpleRootId, 2, simpleStarted, {
    sagaStepName: 'process-payment', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(simpleRootId, simpleRootId, 3, simpleStarted, {
    sagaStepName: 'send-notification', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(simpleRootId, simpleRootId, 4, simpleStarted, {
    sagaStepName: 'finalize-order', sagaEventHint: 'final',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.COMPLETED,
  }),
];

// ---------------------------------------------------------------------------
// Scenario 2: Compensation saga (3 steps, then 2 compensation -> COMPLETED)
// ---------------------------------------------------------------------------
const compRootId = 'saga-comp-002';
const compStarted = new Date(Date.now() - 18 * 60_000);

const compSaga = generateSagaState({
  sagaId: compRootId,
  sagaRootId: compRootId,
  sagaName: 'payment-capture',
  sagaDescription: 'Capture payment with rollback on failure',
  status: SagaStatus.COMPLETED,
  currentStepName: 'release-inventory',
  lastEventHint: 'final',
  startedAt: compStarted.toISOString(),
  updatedAt: new Date(compStarted.getTime() + 20_000).toISOString(),
  endedAt: new Date(compStarted.getTime() + 20_000).toISOString(),
  eventCount: 6,
  version: 6,
});

const compEvents: SagaEventDto[] = [
  generateSagaEvent(compRootId, compRootId, 0, compStarted, {
    sagaStepName: 'validate-input', sagaEventHint: 'step', statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(compRootId, compRootId, 1, compStarted, {
    sagaStepName: 'reserve-stock', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(compRootId, compRootId, 2, compStarted, {
    sagaStepName: 'capture-payment', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(compRootId, compRootId, 3, compStarted, {
    sagaStepName: 'rollback-payment', sagaEventHint: 'compensation',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.COMPENSATING,
  }),
  generateSagaEvent(compRootId, compRootId, 4, compStarted, {
    sagaStepName: 'release-inventory', sagaEventHint: 'compensation',
    statusBefore: SagaStatus.COMPENSATING, statusAfter: SagaStatus.COMPENSATING,
  }),
  generateSagaEvent(compRootId, compRootId, 5, compStarted, {
    sagaStepName: 'release-inventory', sagaEventHint: 'final',
    statusBefore: SagaStatus.COMPENSATING, statusAfter: SagaStatus.COMPLETED,
  }),
];

// ---------------------------------------------------------------------------
// Scenario 3: Fork saga (root + 2 child sagas)
// ---------------------------------------------------------------------------
const forkRootId = 'saga-fork-003';
const forkChild1Id = 'saga-fork-003-child-1';
const forkChild2Id = 'saga-fork-003-child-2';
const forkStarted = new Date(Date.now() - 10 * 60_000);

const forkRootSaga = generateSagaState({
  sagaId: forkRootId,
  sagaRootId: forkRootId,
  sagaName: 'shipment-fulfillment',
  sagaDescription: 'Fulfill order with parallel warehouse + carrier',
  status: SagaStatus.RUNNING,
  currentStepName: 'await-children',
  lastEventHint: 'fork',
  startedAt: forkStarted.toISOString(),
  updatedAt: new Date(forkStarted.getTime() + 8_000).toISOString(),
  eventCount: 3,
  version: 3,
});

const forkChild1Saga = generateSagaState({
  sagaId: forkChild1Id,
  sagaRootId: forkRootId,
  sagaParentId: forkRootId,
  sagaName: 'warehouse-pick',
  status: SagaStatus.COMPLETED,
  currentStepName: 'confirm-pick',
  lastEventHint: 'final',
  startedAt: new Date(forkStarted.getTime() + 4_000).toISOString(),
  updatedAt: new Date(forkStarted.getTime() + 15_000).toISOString(),
  endedAt: new Date(forkStarted.getTime() + 15_000).toISOString(),
  eventCount: 3,
  version: 3,
});

const forkChild2Saga = generateSagaState({
  sagaId: forkChild2Id,
  sagaRootId: forkRootId,
  sagaParentId: forkRootId,
  sagaName: 'carrier-booking',
  status: SagaStatus.RUNNING,
  currentStepName: 'await-carrier-response',
  lastEventHint: 'step',
  startedAt: new Date(forkStarted.getTime() + 4_000).toISOString(),
  updatedAt: new Date(forkStarted.getTime() + 10_000).toISOString(),
  eventCount: 2,
  version: 2,
});

const forkEvents: SagaEventDto[] = [
  // Root events
  generateSagaEvent(forkRootId, forkRootId, 0, forkStarted, {
    sagaStepName: 'validate-shipment', sagaEventHint: 'step', statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(forkRootId, forkRootId, 1, forkStarted, {
    sagaStepName: 'split-fulfillment', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(forkRootId, forkRootId, 2, forkStarted, {
    sagaStepName: 'fork-children', sagaEventHint: 'fork',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  // Child 1 events
  generateSagaEvent(forkChild1Id, forkRootId, 0, new Date(forkStarted.getTime() + 4_000), {
    sagaParentId: forkRootId, sagaStepName: 'locate-item', sagaEventHint: 'step', statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(forkChild1Id, forkRootId, 1, new Date(forkStarted.getTime() + 4_000), {
    sagaParentId: forkRootId, sagaStepName: 'pick-item', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(forkChild1Id, forkRootId, 2, new Date(forkStarted.getTime() + 4_000), {
    sagaParentId: forkRootId, sagaStepName: 'confirm-pick', sagaEventHint: 'final',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.COMPLETED,
  }),
  // Child 2 events
  generateSagaEvent(forkChild2Id, forkRootId, 0, new Date(forkStarted.getTime() + 4_000), {
    sagaParentId: forkRootId, sagaStepName: 'request-carrier', sagaEventHint: 'step', statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(forkChild2Id, forkRootId, 1, new Date(forkStarted.getTime() + 4_000), {
    sagaParentId: forkRootId, sagaStepName: 'await-carrier-response', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
];

// ---------------------------------------------------------------------------
// Scenario 4: Long-running saga (20+ events, RUNNING)
// ---------------------------------------------------------------------------
const longRootId = 'saga-long-004';
const longStarted = new Date(Date.now() - 45 * 60_000);

const longSteps = [
  'init-batch', 'validate-schema', 'partition-data', 'process-chunk-1', 'process-chunk-2',
  'process-chunk-3', 'process-chunk-4', 'process-chunk-5', 'aggregate-results',
  'validate-aggregation', 'enrich-data', 'transform-output', 'write-chunk-1', 'write-chunk-2',
  'write-chunk-3', 'verify-writes', 'update-index', 'notify-downstream', 'checkpoint',
  'process-chunk-6', 'process-chunk-7', 'aggregate-final',
];

const longEvents: SagaEventDto[] = longSteps.map((step, i) =>
  generateSagaEvent(longRootId, longRootId, i, longStarted, {
    sagaStepName: step,
    sagaEventHint: 'step',
    statusBefore: i > 0 ? SagaStatus.RUNNING : null,
    statusAfter: SagaStatus.RUNNING,
  }),
);

const longSaga = generateSagaState({
  sagaId: longRootId,
  sagaRootId: longRootId,
  sagaName: 'batch-data-pipeline',
  sagaDescription: 'Large batch data processing pipeline',
  status: SagaStatus.RUNNING,
  currentStepName: 'aggregate-final',
  lastEventHint: 'step',
  startedAt: longStarted.toISOString(),
  updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  eventCount: longSteps.length,
  version: longSteps.length,
});

// ---------------------------------------------------------------------------
// Scenario 5: Stuck saga (RUNNING, no update for 10 minutes)
// ---------------------------------------------------------------------------
const stuckRootId = 'saga-stuck-005';
const stuckStarted = new Date(Date.now() - 35 * 60_000);

const stuckSaga = generateSagaState({
  sagaId: stuckRootId,
  sagaRootId: stuckRootId,
  sagaName: 'subscription-renewal',
  sagaDescription: 'Monthly subscription renewal',
  status: SagaStatus.RUNNING,
  currentStepName: 'await-payment-gateway',
  lastEventHint: 'step',
  startedAt: stuckStarted.toISOString(),
  updatedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  eventCount: 3,
  version: 3,
});

const stuckEvents: SagaEventDto[] = [
  generateSagaEvent(stuckRootId, stuckRootId, 0, stuckStarted, {
    sagaStepName: 'validate-subscription', sagaEventHint: 'step', statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(stuckRootId, stuckRootId, 1, stuckStarted, {
    sagaStepName: 'charge-customer', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
  generateSagaEvent(stuckRootId, stuckRootId, 2, stuckStarted, {
    sagaStepName: 'await-payment-gateway', sagaEventHint: 'step',
    statusBefore: SagaStatus.RUNNING, statusAfter: SagaStatus.RUNNING,
  }),
];

// ---------------------------------------------------------------------------
// Additional running sagas for variety
// ---------------------------------------------------------------------------
const extraSagas: SagaStateDto[] = [
  generateSagaState({
    sagaId: 'saga-extra-006', sagaRootId: 'saga-extra-006',
    sagaName: 'refund-processing', status: SagaStatus.COMPENSATING,
    currentStepName: 'reverse-charge', lastEventHint: 'compensation',
    startedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60_000).toISOString(),
    eventCount: 4, version: 4,
  }),
  generateSagaState({
    sagaId: 'saga-extra-007', sagaRootId: 'saga-extra-007',
    sagaName: 'user-onboarding', status: SagaStatus.COMPLETED,
    currentStepName: 'welcome-email', lastEventHint: 'final',
    startedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 58 * 60_000).toISOString(),
    endedAt: new Date(Date.now() - 58 * 60_000).toISOString(),
    eventCount: 4, version: 4,
  }),
  generateSagaState({
    sagaId: 'saga-extra-008', sagaRootId: 'saga-extra-008',
    sagaName: 'notification-dispatch', status: SagaStatus.RUNNING,
    currentStepName: 'send-push', lastEventHint: 'step',
    startedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 30_000).toISOString(),
    eventCount: 2, version: 2,
  }),
  generateSagaState({
    sagaId: 'saga-extra-009', sagaRootId: 'saga-extra-009',
    sagaName: 'inventory-reservation', status: SagaStatus.RUNNING,
    currentStepName: 'check-availability', lastEventHint: 'step',
    startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 45_000).toISOString(),
    eventCount: 2, version: 2,
  }),
  generateSagaState({
    sagaId: 'saga-extra-010', sagaRootId: 'saga-extra-010',
    sagaName: 'order-processing', status: SagaStatus.COMPLETED,
    currentStepName: 'finalize-order', lastEventHint: 'final',
    startedAt: new Date(Date.now() - 120 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 118 * 60_000).toISOString(),
    endedAt: new Date(Date.now() - 118 * 60_000).toISOString(),
    eventCount: 6, version: 6,
  }),
];

// ---------------------------------------------------------------------------
// Aggregate exports
// ---------------------------------------------------------------------------
export const ALL_SAGAS: SagaStateDto[] = [
  simpleSaga,
  compSaga,
  forkRootSaga,
  forkChild1Saga,
  forkChild2Saga,
  longSaga,
  stuckSaga,
  ...extraSagas,
].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

export const ALL_EVENTS: Map<string, SagaEventDto[]> = new Map([
  [simpleRootId, simpleEvents],
  [compRootId, compEvents],
  [forkRootId, forkEvents.filter((e) => e.sagaId === forkRootId)],
  [forkChild1Id, forkEvents.filter((e) => e.sagaId === forkChild1Id)],
  [forkChild2Id, forkEvents.filter((e) => e.sagaId === forkChild2Id)],
  [longRootId, longEvents],
  [stuckRootId, stuckEvents],
]);

export const ALL_METRICS: Map<string, SagaMetricsDto> = new Map([
  [simpleRootId, generateSagaMetrics(simpleSaga, 5)],
  [compRootId, generateSagaMetrics(compSaga, 6, 2)],
  [forkRootId, generateSagaMetrics(forkRootSaga, 3, 0, 1, 2)],
  [forkChild1Id, generateSagaMetrics(forkChild1Saga, 3)],
  [forkChild2Id, generateSagaMetrics(forkChild2Saga, 2)],
  [longRootId, generateSagaMetrics(longSaga, longSteps.length)],
  [stuckRootId, generateSagaMetrics(stuckSaga, 3)],
]);

export const TREE_MAP: Map<string, SagaStateDto[]> = new Map([
  [forkRootId, [forkRootSaga, forkChild1Saga, forkChild2Saga]],
]);

// For sagas that are their own root and have no children, tree is just [self]
for (const saga of ALL_SAGAS) {
  if (!TREE_MAP.has(saga.sagaRootId)) {
    const tree = ALL_SAGAS.filter((s) => s.sagaRootId === saga.sagaRootId);
    TREE_MAP.set(saga.sagaRootId, tree);
  }
}
