import {
  SagaStateDto,
  SagaEventDto,
  SagaMetricsDto,
  SagaStatus,
  EventHint,
} from "@/lib/types/saga";

let idCounter = 0;

function uid(): string {
  idCounter++;
  const hex = idCounter.toString(16).padStart(4, "0");
  const rand = Math.random().toString(16).slice(2, 10);
  return `${hex}${rand}-${rand.slice(0, 4)}-4${rand.slice(4, 7)}-${rand.slice(0, 4)}-${rand}${hex}`;
}

function randomPastDate(minutesAgo: number): Date {
  return new Date(Date.now() - minutesAgo * 60_000 + Math.random() * 30_000);
}

export function generateSagaState(
  overrides: Partial<SagaStateDto> = {},
): SagaStateDto {
  const sagaId = overrides.sagaId ?? uid();
  const sagaRootId = overrides.sagaRootId ?? sagaId;
  const startedAt = overrides.startedAt ?? randomPastDate(30).toISOString();
  const updatedAt =
    overrides.updatedAt ??
    new Date(
      new Date(startedAt).getTime() + Math.random() * 600_000,
    ).toISOString();
  const status = overrides.status ?? SagaStatus.RUNNING;
  const endedAt =
    status === SagaStatus.COMPLETED ? (overrides.endedAt ?? updatedAt) : null;

  return {
    sagaId,
    sagaRootId,
    sagaParentId: null,
    sagaName: "order-processing",
    sagaDescription: null,
    status,
    currentStepName: "validate-payment",
    currentStepDescription: null,
    lastEventId: uid(),
    lastEventHint: "step",
    lastCausationId: uid(),
    startedAt,
    updatedAt,
    endedAt,
    eventCount: 5,
    schemaVersion: 1,
    lastTopic: "order.events",
    lastPartition: 0,
    lastOffset: "42",
    createdAt: startedAt,
    version: 1,
    ...overrides,
  };
}

export function generateSagaEvent(
  sagaId: string,
  rootId: string,
  index: number,
  baseTime: Date,
  overrides: Partial<SagaEventDto> = {},
): SagaEventDto {
  const publishedAt = new Date(
    baseTime.getTime() + index * (2000 + Math.random() * 5000),
  );

  return {
    sagaEventId: uid(),
    sagaId,
    sagaRootId: rootId,
    sagaParentId: null,
    sagaCausationId: index > 0 ? uid() : sagaId,
    sagaName: null,
    sagaStepName: `step-${index + 1}`,
    sagaStepDescription: null,
    sagaEventHint: "step",
    sagaPublishedAt: publishedAt.toISOString(),
    statusBefore: index > 0 ? SagaStatus.RUNNING : null,
    statusAfter: SagaStatus.RUNNING,
    topic: "order.events",
    partition: 0,
    offset: String(100 + index),
    createdAt: publishedAt.toISOString(),
    ...overrides,
  };
}

export function generateSagaMetrics(
  saga: SagaStateDto,
  eventCount: number,
  compensationCount: number = 0,
  forkCount: number = 0,
  childSagaCount: number = 0,
): SagaMetricsDto {
  const startMs = new Date(saga.startedAt).getTime();
  const endMs = saga.endedAt ? new Date(saga.endedAt).getTime() : null;
  const now = Date.now();

  return {
    sagaId: saga.sagaId,
    status: saga.status,
    elapsedMs: now - startMs,
    totalDurationMs: endMs ? endMs - startMs : null,
    lastUpdateAgoMs: now - new Date(saga.updatedAt).getTime(),
    totalEvents: eventCount,
    compensationCount,
    forkCount,
    childSagaCount,
    isStuck:
      saga.status !== SagaStatus.COMPLETED &&
      now - new Date(saga.updatedAt).getTime() > 300_000,
  };
}

const SAGA_NAMES = [
  "order-processing",
  "payment-capture",
  "inventory-reservation",
  "shipment-fulfillment",
  "refund-processing",
  "user-onboarding",
  "subscription-renewal",
  "notification-dispatch",
];

const STEP_NAMES = [
  "validate-input",
  "check-inventory",
  "reserve-stock",
  "process-payment",
  "capture-payment",
  "create-shipment",
  "send-notification",
  "update-analytics",
  "rollback-payment",
  "release-inventory",
  "finalize-order",
  "confirm-delivery",
];

export function randomSagaName(): string {
  return SAGA_NAMES[Math.floor(Math.random() * SAGA_NAMES.length)];
}

export function randomStepName(): string {
  return STEP_NAMES[Math.floor(Math.random() * STEP_NAMES.length)];
}

export function randomHint(allowFinal = false): EventHint {
  const hints: EventHint[] = ["step", "step", "step", "compensation", "fork"];
  if (allowFinal) hints.push("final");
  return hints[Math.floor(Math.random() * hints.length)];
}
