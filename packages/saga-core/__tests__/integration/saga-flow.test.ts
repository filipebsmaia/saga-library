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
            eventType: "payment.processed",
            stepName: "payment",
            payload: { orderId: event.payload.orderId, amount: 100 },
          });
        });

      const inventoryHandler = vi
        .fn()
        .mockImplementation(async (event: IncomingEvent, emit: Emit) => {
          await emit({
            eventType: "inventory.reserved",
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
        eventType: "order.created",
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
            eventType: "payment.processed",
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
            eventType: "payment.refunded",
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
        eventType: "order.created",
        stepName: "order",
        payload: { orderId: "ORD-456" },
      });

      // Payment succeeded, inventory failed (non-retryable)
      expect(paymentHandler).toHaveBeenCalledTimes(1);
      expect(inventoryHandler).toHaveBeenCalledTimes(1);

      // Now trigger compensation manually
      await emit({
        eventType: "payment.compensate",
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
              eventType: "order.failed",
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
        eventType: "order.created",
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
