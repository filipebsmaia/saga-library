import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SagaRunner } from "../../src/runner/saga-runner";
import { SagaRegistry } from "../../src/registry/saga-registry";
import { SagaPublisher } from "../../src/publisher/saga-publisher";
import { SagaParser } from "../../src/parser/saga-parser";
import { SagaRetryableError } from "../../src/errors/saga-retryable.error";
import { NoopOtelContext } from "../../src/otel/otel-context";
import { InMemoryTransport } from "../support/in-memory-transport";
import type { IncomingEvent } from "../../src/interfaces/incoming-event.interface";
import type { Emit } from "../../src/interfaces/emit.type";

describe("Integration: Saga Flow", () => {
  let transport: InMemoryTransport;
  let registry: SagaRegistry;
  let publisher: SagaPublisher;
  let parser: SagaParser;
  const otel = new NoopOtelContext();

  beforeEach(() => {
    transport = new InMemoryTransport();
    registry = new SagaRegistry();
    parser = new SagaParser(otel);
    publisher = new SagaPublisher(transport, otel);
  });

  describe("Happy path: order → payment → inventory", () => {
    it("should propagate events through the saga chain", async () => {
      const paymentHandler = vi
        .fn()
        .mockImplementation(async (event: IncomingEvent, emit: Emit) => {
          await emit({
            topic: "payment.processed",
            stepName: "payment",
            payload: { orderId: event.payload.orderId, amount: 100 },
          });
        });

      const inventoryHandler = vi
        .fn()
        .mockImplementation(async (event: IncomingEvent, emit: Emit) => {
          await emit({
            topic: "inventory.reserved",
            stepName: "inventory",
            payload: { orderId: (event.payload as any).orderId },
          });
        });

      registry.register({
        serviceId: "payment-service",
        on: { "order.created": paymentHandler },
      });

      registry.register({
        serviceId: "inventory-service",
        on: { "payment.processed": inventoryHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();

      // Kick off the saga
      const emit = publisher.forSaga("saga-001");
      await emit({
        topic: "order.created",
        stepName: "order",
        payload: { orderId: "ORD-123" },
      });

      // Verify chain executed
      expect(paymentHandler).toHaveBeenCalledTimes(1);
      expect(inventoryHandler).toHaveBeenCalledTimes(1);

      // Verify events published
      const messages = transport.getPublishedMessages();
      const topics = messages.map((m) => m.topic);
      expect(topics).toContain("order.created");
      expect(topics).toContain("payment.processed");
      expect(topics).toContain("inventory.reserved");

      // Verify sagaId propagation
      const allKeys = messages.map((m) => m.key);
      expect(allKeys.every((k) => k === "saga-001")).toBe(true);

      await runner.stop();
    });
  });

  describe("Compensation flow", () => {
    it("should handle non-retryable errors and allow compensation", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const paymentHandler = vi
        .fn()
        .mockImplementation(async (_event: IncomingEvent, emit: Emit) => {
          await emit({
            topic: "payment.processed",
            stepName: "payment",
            payload: { status: "ok" },
          });
        });

      const inventoryHandler = vi.fn().mockImplementation(async () => {
        throw new Error("Out of stock");
      });

      const compensationHandler = vi
        .fn()
        .mockImplementation(async (_event: IncomingEvent, emit: Emit) => {
          await emit({
            topic: "payment.refunded",
            stepName: "compensation",
            payload: { reason: "inventory_failed" },
          });
        });

      registry.register({
        serviceId: "payment-service",
        on: {
          "order.created": paymentHandler,
          "payment.compensate": compensationHandler,
        },
      });

      registry.register({
        serviceId: "inventory-service",
        on: { "payment.processed": inventoryHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();

      const emit = publisher.forSaga("saga-002");
      await emit({
        topic: "order.created",
        stepName: "order",
        payload: { orderId: "ORD-456" },
      });

      // Payment succeeded, inventory failed (non-retryable)
      expect(paymentHandler).toHaveBeenCalledTimes(1);
      expect(inventoryHandler).toHaveBeenCalledTimes(1);

      // Now trigger compensation manually
      await emit({
        topic: "payment.compensate",
        stepName: "compensation",
        payload: { reason: "inventory_failed" },
      });

      expect(compensationHandler).toHaveBeenCalledTimes(1);

      const messages = transport.getPublishedMessages();
      const topics = messages.map((m) => m.topic);
      expect(topics).toContain("payment.refunded");

      consoleSpy.mockRestore();
      await runner.stop();
    });
  });

  describe("Multi-level emitToParent (A → B → C → emitToParent bubbling)", () => {
    it("should propagate correct parentSagaId through 3 levels of fork + emitToParent", async () => {
      const publishedMessages = transport.getPublishedMessages;

      // Level A (root): forks to B
      const levelAHandler = vi
        .fn()
        .mockImplementation(async (_event: IncomingEvent, emit: Emit) => {
          await emit({
            topic: "level-b.start",
            stepName: "fork-to-b",
            payload: {},
          });
        });

      // Level B: forks to C
      const levelBHandler = vi
        .fn()
        .mockImplementation(async (_event: IncomingEvent, emit: Emit) => {
          await emit({
            topic: "level-c.start",
            stepName: "fork-to-c",
            payload: {},
          });
        });

      // Level C (leaf): emitToParent back to B
      const levelCHandler = vi
        .fn()
        .mockImplementation(async (_event: IncomingEvent, emit: Emit) => {
          // This emit goes through the publisher's emitToParent-equivalent:
          // The handler receives a bound emit for C's saga, but we need to
          // emit back to B. In the runner, the handler's emit is bound to the sub-saga.
          // To test emitToParent, we use the SagaContext + publisher directly.
          const { SagaContext } = await import("../../src/context/saga-context");
          const ctx = SagaContext.require();
          // Emit to parent using the forSaga pattern (same as emitToParent params overload)
          const parentAncestorChain = (ctx.ancestorChain ?? []).slice(1);
          const grandparent = parentAncestorChain[0];
          const parentEmit = publisher.forSaga(
            ctx.parentSagaId!,
            {
              parentSagaId: grandparent,
              rootSagaId: ctx.rootSagaId,
              ancestorChain: parentAncestorChain,
            },
            ctx.causationId,
            ctx.key,
          );
          await parentEmit({
            topic: "level-b.child-done",
            stepName: "c-reports-to-b",
            payload: { from: "C" },
          });
        });

      // Level B handler for child-done: emitToParent back to A
      const levelBChildDoneHandler = vi
        .fn()
        .mockImplementation(async (_event: IncomingEvent, emit: Emit) => {
          const { SagaContext } = await import("../../src/context/saga-context");
          const ctx = SagaContext.require();
          const parentAncestorChain = (ctx.ancestorChain ?? []).slice(1);
          const grandparent = parentAncestorChain[0];
          const parentEmit = publisher.forSaga(
            ctx.parentSagaId!,
            {
              parentSagaId: grandparent,
              rootSagaId: ctx.rootSagaId,
              ancestorChain: parentAncestorChain,
            },
            ctx.causationId,
            ctx.key,
          );
          await parentEmit({
            topic: "level-a.child-done",
            stepName: "b-reports-to-a",
            payload: { from: "B" },
          });
        });

      // Final handler at A
      const levelAChildDoneHandler = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "level-a-service",
        on: {
          "order.start": levelAHandler,
          "level-a.child-done": levelAChildDoneHandler,
        },
        handlerOptions: { "order.start": { fork: true } },
      });

      registry.register({
        serviceId: "level-b-service",
        on: {
          "level-b.start": levelBHandler,
          "level-b.child-done": levelBChildDoneHandler,
        },
        handlerOptions: { "level-b.start": { fork: true } },
      });

      registry.register({
        serviceId: "level-c-service",
        on: { "level-c.start": levelCHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();

      // Kick off root saga
      const rootEmit = publisher.forSaga("saga-A");
      await rootEmit({
        topic: "order.start",
        stepName: "start",
        payload: {},
      });

      // Verify all handlers were called
      expect(levelAHandler).toHaveBeenCalledTimes(1);
      expect(levelBHandler).toHaveBeenCalledTimes(1);
      expect(levelCHandler).toHaveBeenCalledTimes(1);
      expect(levelBChildDoneHandler).toHaveBeenCalledTimes(1);
      expect(levelAChildDoneHandler).toHaveBeenCalledTimes(1);

      // Verify the critical fix: messages have correct parentSagaId
      const messages = transport.getPublishedMessages();

      // Find the message from C to B (level-b.child-done)
      const cToBMessage = messages.find(
        (msg) => msg.topic === "level-b.child-done",
      );
      expect(cToBMessage).toBeDefined();
      // The sagaId should be B's sagaId (we're emitting on B's saga)
      const bSagaId = cToBMessage!.headers["saga-id"];
      // B's parentSagaId should be A
      expect(cToBMessage!.headers["saga-parent-id"]).toBe("saga-A");

      // Find the message from B to A (level-a.child-done)
      const bToAMessage = messages.find(
        (msg) => msg.topic === "level-a.child-done",
      );
      expect(bToAMessage).toBeDefined();
      // The sagaId should be A's sagaId
      expect(bToAMessage!.headers["saga-id"]).toBe("saga-A");
      // A has no parent
      expect(bToAMessage!.headers["saga-parent-id"]).toBeUndefined();

      await runner.stop();
    });
  });

  describe("Retry exhausted", () => {
    it("should retry and call onRetryExhausted when all retries fail", async () => {
      vi.useFakeTimers();

      const handler = vi
        .fn()
        .mockRejectedValue(new SagaRetryableError("service unavailable"));
      const onRetryExhausted = vi
        .fn()
        .mockImplementation(
          async (
            _event: IncomingEvent,
            _error: SagaRetryableError,
            emit: Emit,
          ) => {
            await emit({
              topic: "order.failed",
              stepName: "order",
              payload: { reason: "retries_exhausted" },
            });
          },
        );

      registry.register({
        serviceId: "payment-service",
        on: { "order.created": handler },
        onRetryExhausted,
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
        retryPolicy: { maxRetries: 2, initialDelayMs: 10 },
      });

      await runner.start();

      const emit = publisher.forSaga("saga-003");
      const emitPromise = emit({
        topic: "order.created",
        stepName: "order",
        payload: { orderId: "ORD-789" },
      });

      // Advance through retries: 10ms + 20ms
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(20);

      await emitPromise;

      // 1 initial + 2 retries = 3
      expect(handler).toHaveBeenCalledTimes(3);
      expect(onRetryExhausted).toHaveBeenCalledTimes(1);

      const messages = transport.getPublishedMessages();
      const topics = messages.map((m) => m.topic);
      expect(topics).toContain("order.failed");

      vi.useRealTimers();
      await runner.stop();
    });
  });
});
