import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Kafka, Consumer, logLevel, EachMessagePayload } from "kafkajs";
import { EventEmitter } from "events";

export type EventHintValue = "step" | "compensation" | "final" | "fork";

export interface SagaTraceEvent {
  sagaId: string;
  rootSagaId: string;
  parentSagaId?: string;
  topic: string;
  stepName: string;
  stepDescription?: string;
  eventId: string;
  correlationId: string;
  causationId: string;
  hint: EventHintValue;
  topic: string;
  payload: unknown;
  occurredAt: string;
  receivedAt: string;
  sagaName?: string;
  sagaDescription?: string;
}

@Injectable()
export class MonitorService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger("SagaMonitor");
  private consumer: Consumer | null = null;
  private readonly events = new Map<string, SagaTraceEvent[]>();

  private readonly ALL_TOPICS = [
    "recurring.triggered",
    "plan.order.requested",
    "order.requested",
    "order.created",
    "payment.approved",
    "payment.rejected",
    "order.completed",
    "order.failed",
    "plan.order.completed",
    "plan.order.failed",
    "recurring.completed",
    "recurring.failed",
    "recurring.created",
    "product.activation.requested",
    "product.provisioned",
    "product.activated",
    // SIM Swap scenario
    "sim-swap.requested",
    "portability.validation.requested",
    "portability.validated",
    "sim-swap.completed",
    // Bulk Activation scenario
    "bulk-activation.requested",
    "line-activation.requested",
    "line-activation.completed",
    "bulk-activation.completed",
    // Plan Upgrade scenario
    "upgrade.requested",
    "upgrade.eligible",
    "upgrade.approved",
    "migration.started",
    "migration.provisioned",
    "migration.activated",
    "migration.activation-failed",
    "migration.rolled-back",
  ];

  async onModuleInit(): Promise<void> {
    const kafka = new Kafka({
      clientId: `saga-monitor-${process.env.HOSTNAME ?? "local"}`,
      brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
      retry: { initialRetryTime: 300, retries: 10 },
      logLevel: logLevel.WARN,
    });

    this.consumer = kafka.consumer({
      groupId: `saga-monitor-${Date.now()}`,
      retry: { initialRetryTime: 500, retries: 8 },
    });

    try {
      await this.consumer.connect();
      this.logger.log("Monitor consumer connected");

      for (const topic of this.ALL_TOPICS) {
        try {
          await this.consumer.subscribe({ topic, fromBeginning: true });
        } catch (subErr) {
          this.logger.warn(
            `Failed to subscribe to ${topic}: ${(subErr as Error).message}`,
          );
        }
      }

      this.logger.log(`Subscribed to ${this.ALL_TOPICS.length} topics`);

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          try {
            this.handleMessage(payload);
          } catch (msgErr) {
            this.logger.error(
              `Error handling message: ${(msgErr as Error).message}`,
            );
          }
        },
      });

      this.logger.log(`Monitor consumer running`);
    } catch (err) {
      this.logger.error(
        `Monitor consumer failed to start: ${(err as Error).message}`,
      );
      this.logger.error((err as Error).stack ?? "");
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  getEventsBySaga(): Map<string, SagaTraceEvent[]> {
    return this.events;
  }

  getAllSagas(): Array<{
    sagaId: string;
    rootSagaId: string;
    parentSagaId?: string;
    sagaName?: string;
    status: string;
    groupStatus: string;
    eventCount: number;
    firstEvent: string;
    lastEvent: string;
    startedAt: string;
    lastUpdatedAt: string;
  }> {
    // Build parent chain groups to compute groupStatus
    const groupRoots = new Map<string, string>(); // sagaId → rootId
    const visited = new Set<string>();
    const findRoot = (id: string): string => {
      if (visited.has(id)) return id;
      visited.add(id);
      const evts = this.events.get(id);
      if (!evts || evts.length === 0) return id;
      const parentId = evts[0].parentSagaId;
      if (parentId && this.events.has(parentId)) return findRoot(parentId);
      return id;
    };
    for (const sagaId of this.events.keys()) {
      visited.clear();
      groupRoots.set(sagaId, findRoot(sagaId));
    }

    // Compute group status by merging events of all sagas in each group
    const groupsByRoot = new Map<string, SagaTraceEvent[]>();
    for (const [sagaId, events] of this.events) {
      const rootId = groupRoots.get(sagaId) ?? sagaId;
      const merged = groupsByRoot.get(rootId) ?? [];
      merged.push(...events);
      groupsByRoot.set(rootId, merged);
    }
    const groupStatusMap = new Map<string, string>();
    for (const [rootId, mergedEvents] of groupsByRoot) {
      if (mergedEvents.length === 0) continue;
      mergedEvents.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      groupStatusMap.set(rootId, this.deriveSagaStatus(mergedEvents));
    }

    const sagas: Array<{
      sagaId: string;
      rootSagaId: string;
      parentSagaId?: string;
      sagaName?: string;
      status: string;
      groupStatus: string;
      eventCount: number;
      firstEvent: string;
      lastEvent: string;
      startedAt: string;
      lastUpdatedAt: string;
    }> = [];

    for (const [sagaId, events] of this.events) {
      if (events.length === 0) continue;
      const rootId = groupRoots.get(sagaId) ?? sagaId;
      sagas.push({
        sagaId,
        rootSagaId: events[0].rootSagaId,
        parentSagaId: events[0].parentSagaId,
        sagaName: events[0].sagaName,
        status: this.deriveSagaStatus(events),
        groupStatus: groupStatusMap.get(rootId) ?? "running",
        eventCount: events.length,
        firstEvent: events[0].topic,
        lastEvent: events[events.length - 1].topic,
        startedAt: events[0].receivedAt,
        lastUpdatedAt: events[events.length - 1].receivedAt,
      });
    }

    return sagas.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getAggregatedStats(): {
    counts: {
      running: number;
      completed: number;
      failed: number;
      compensating: number;
      total: number;
    };
    sagasByType: Record<string, number>;
    consumerLag: { avgMs: number; samples: number };
    durations: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
      count: number;
    };
    totalEvents: number;
  } {
    let running = 0;
    let completed = 0;
    let failed = 0;
    let compensating = 0;
    let totalLag = 0;
    let lagCount = 0;
    const durations: number[] = [];
    const sagasByType: Record<string, number> = {};
    let totalEvents = 0;

    for (const [, events] of this.events) {
      if (events.length === 0) continue;
      totalEvents += events.length;

      const status = this.deriveSagaStatus(events);
      if (status === "running") running++;
      else if (status === "completed") completed++;
      else if (status === "failed") failed++;
      else if (status === "compensating") compensating++;

      // Duration for finished sagas
      if (status !== "running") {
        const start = new Date(events[0].occurredAt).getTime();
        const end = new Date(events[events.length - 1].occurredAt).getTime();
        durations.push(end - start);
      }

      // Consumer lag
      for (const ev of events) {
        const lag =
          new Date(ev.receivedAt).getTime() - new Date(ev.occurredAt).getTime();
        if (lag >= 0) {
          totalLag += lag;
          lagCount++;
        }
      }

      // By saga name
      const name = events[0].sagaName ?? "unknown";
      sagasByType[name] = (sagasByType[name] ?? 0) + 1;
    }

    durations.sort((a, b) => a - b);
    const p = (arr: number[], pct: number) =>
      arr.length
        ? arr[Math.max(0, Math.ceil((pct / 100) * arr.length) - 1)]
        : 0;

    return {
      counts: {
        running,
        completed,
        failed,
        compensating,
        total: this.events.size,
      },
      sagasByType,
      consumerLag: {
        avgMs: lagCount ? Math.round(totalLag / lagCount) : 0,
        samples: lagCount,
      },
      durations: {
        p50: p(durations, 50),
        p90: p(durations, 90),
        p95: p(durations, 95),
        p99: p(durations, 99),
        count: durations.length,
      },
      totalEvents,
    };
  }

  getDurationsByType(): Array<{
    sagaName: string;
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
  }> {
    const byType = new Map<string, number[]>();

    for (const [, events] of this.events) {
      if (events.length === 0) continue;
      const status = this.deriveSagaStatus(events);
      if (status === "running") continue; // only finished sagas

      const name = events[0].sagaName ?? "unknown";
      const start = new Date(events[0].occurredAt).getTime();
      const end = new Date(events[events.length - 1].occurredAt).getTime();
      const dur = end - start;

      if (!byType.has(name)) byType.set(name, []);
      byType.get(name)!.push(dur);
    }

    const p = (arr: number[], pct: number) =>
      arr.length
        ? arr[Math.max(0, Math.ceil((pct / 100) * arr.length) - 1)]
        : 0;

    const result: Array<{
      sagaName: string;
      count: number;
      avg: number;
      min: number;
      max: number;
      p50: number;
      p90: number;
      p95: number;
    }> = [];

    for (const [name, durations] of byType) {
      durations.sort((a, b) => a - b);
      const sum = durations.reduce((s, d) => s + d, 0);
      result.push({
        sagaName: name,
        count: durations.length,
        avg: Math.round(sum / durations.length),
        min: durations[0],
        max: durations[durations.length - 1],
        p50: p(durations, 50),
        p90: p(durations, 90),
        p95: p(durations, 95),
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }

  getEventsForSagaGroup(sagaId: string): Record<string, SagaTraceEvent[]> {
    const result: Record<string, SagaTraceEvent[]> = {};

    // Find all sagas that belong to this group (walk parentSagaId chain)
    const visited = new Set<string>();
    const findRoot = (id: string): string => {
      if (visited.has(id)) return id;
      visited.add(id);
      const events = this.events.get(id);
      if (!events || events.length === 0) return id;
      const parentId = events[0].parentSagaId;
      if (parentId && this.events.has(parentId)) return findRoot(parentId);
      return id;
    };

    const rootId = findRoot(sagaId);

    // Collect all sagas whose root is the same
    for (const [id, events] of this.events) {
      if (events.length === 0) continue;
      visited.clear();
      if (findRoot(id) === rootId) {
        result[id] = events;
      }
    }

    // Fallback: if nothing found, return just the requested saga
    if (Object.keys(result).length === 0 && this.events.has(sagaId)) {
      result[sagaId] = this.events.get(sagaId)!;
    }

    return result;
  }

  private deriveSagaStatus(events: SagaTraceEvent[]): string {
    const last = events[events.length - 1];
    const hasCompensation = events.some((e) => e.hint === "compensation");
    if (last.hint === "final") return hasCompensation ? "failed" : "completed";
    if (hasCompensation) return "compensating";
    return "running";
  }

  private handleMessage(payload: EachMessagePayload): void {
    const { topic, message } = payload;
    const headers = message.headers ?? {};

    const sagaId = this.headerToString(headers["saga-id"]);
    if (!sagaId) return;

    let parsedPayload: unknown = {};
    try {
      parsedPayload = JSON.parse(message.value?.toString() ?? "{}");
    } catch {
      // ignore parse errors
    }

    const event: SagaTraceEvent = {
      sagaId,
      rootSagaId: this.headerToString(headers["saga-root-id"]) ?? sagaId,
      parentSagaId: this.headerToString(headers["saga-parent-id"]),
      topic,
      stepName: this.headerToString(headers["saga-step-name"]) ?? "",
      eventId: this.headerToString(headers["saga-event-id"]) ?? "",
      correlationId: this.headerToString(headers["saga-correlation-id"]) ?? "",
      causationId: this.headerToString(headers["saga-causation-id"]) ?? "",
      hint:
        (this.headerToString(headers["saga-event-hint"]) as EventHintValue) ??
        "step",
      topic,
      payload: parsedPayload,
      occurredAt: this.headerToString(headers["saga-occurred-at"]) ?? new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      sagaName: this.headerToString(headers["saga-name"]),
      sagaDescription: this.headerToString(headers["saga-description"]),
      stepDescription: this.headerToString(headers["saga-step-description"]),
    };

    if (!this.events.has(sagaId)) {
      this.events.set(sagaId, []);
    }
    this.events.get(sagaId)!.push(event);

    this.emit("saga-event", event);
    this.logger.debug(`[${sagaId.slice(0, 8)}] ${event.topic}`);
  }

  private headerToString(value: unknown): string | undefined {
    if (Buffer.isBuffer(value)) return value.toString();
    if (typeof value === "string") return value;
    return undefined;
  }
}
