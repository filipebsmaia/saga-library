import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SagaRunner } from "../src/runner/saga-runner";
import { SagaRegistry } from "../src/registry/saga-registry";
import { SagaPublisher } from "../src/publisher/saga-publisher";
import { SagaParser } from "../src/parser/saga-parser";
import { SagaRetryableError } from "../src/errors/saga-retryable.error";
import { NoopOtelContext } from "../src/otel/otel-context";
import type {
  SagaTransport,
  InboundMessage,
} from "../src/transport/transport.interface";

let subscribeHandler: ((msg: InboundMessage) => Promise<void>) | null = null;

function createMockTransport(): SagaTransport {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockImplementation(async (_topics, handler) => {
      subscribeHandler = handler;
    }),
  };
}

function makeInboundMessage(
  eventType: string,
  sagaId = "saga-123",
): InboundMessage {
  return {
    topic: eventType,
    key: sagaId,
    value: JSON.stringify({
      eventType,
      occurredAt: "2024-01-01T00:00:00.000Z",
      payload: { orderId: "456" },
    }),
    headers: {
      "saga-id": sagaId,
      "saga-correlation-id": sagaId,
      "saga-causation-id": sagaId,
      "saga-event-id": "evt-001",
      "saga-step-name": "order",
      "saga-published-at": "2024-01-01T00:00:01.000Z",
      "saga-schema-version": "1",
      "saga-root-id": sagaId,
    },
  };
}

describe("SagaRunner", () => {
  let transport: SagaTransport;
  let registry: SagaRegistry;
  let publisher: SagaPublisher;
  let parser: SagaParser;

  beforeEach(() => {
    vi.useFakeTimers();
    subscribeHandler = null;
    transport = createMockTransport();
    registry = new SagaRegistry();
    const otel = new NoopOtelContext();
    publisher = new SagaPublisher(transport, otel);
    parser = new SagaParser(otel);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should connect transport and subscribe to topics on start", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({
      serviceId: "svc-a",
      on: { "order.created": handler },
    });

    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "payment-service-group",
    });

    await runner.start();

    expect(transport.connect).toHaveBeenCalled();
    expect(transport.subscribe).toHaveBeenCalledWith(
      ["order.created"],
      expect.any(Function),
      { fromBeginning: undefined, groupId: "payment-service-group" },
    );
  });

  it("should disconnect transport on stop", async () => {
    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "test-group",
    });

    await runner.start();
    await runner.stop();

    expect(transport.disconnect).toHaveBeenCalled();
  });

  it("should call handler when matching message is received", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({
      serviceId: "svc-a",
      on: { "order.created": handler },
    });

    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "test-group",
    });

    await runner.start();
    await subscribeHandler!(makeInboundMessage("order.created"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        sagaId: "saga-123",
        eventType: "order.created",
        payload: { orderId: "456" },
      }),
      expect.any(Function),
    );
  });

  it("should skip unparseable messages", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({
      serviceId: "svc-a",
      on: { "order.created": handler },
    });

    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "test-group",
    });

    await runner.start();
    await subscribeHandler!({
      topic: "saga.order.created",
      key: "saga-123",
      value: "not-json",
      headers: {},
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should skip messages with no matching handler", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({
      serviceId: "svc-a",
      on: { "order.created": handler },
    });

    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "test-group",
    });

    await runner.start();
    await subscribeHandler!(makeInboundMessage("payment.processed"));

    expect(handler).not.toHaveBeenCalled();
  });

  describe("retry with backoff", () => {
    it("should retry on SagaRetryableError with exponential backoff", async () => {
      let callCount = 0;
      const handler = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new SagaRetryableError("transient failure");
        }
      });

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
        retryPolicy: { maxRetries: 3, initialDelayMs: 100 },
      });

      await runner.start();

      const handlePromise = subscribeHandler!(
        makeInboundMessage("order.created"),
      );

      // First retry after 100ms (100 * 2^0)
      await vi.advanceTimersByTimeAsync(100);
      // Second retry after 200ms (100 * 2^1)
      await vi.advanceTimersByTimeAsync(200);

      await handlePromise;

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("should call onRetryExhausted when retries are exhausted", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new SagaRetryableError("always fails"));
      const onRetryExhausted = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        onRetryExhausted,
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
        retryPolicy: { maxRetries: 2, initialDelayMs: 10 },
      });

      await runner.start();

      const handlePromise = subscribeHandler!(
        makeInboundMessage("order.created"),
      );

      // Advance through retries: 10ms (10*2^0) + 20ms (10*2^1)
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(20);

      await handlePromise;

      // 1 initial + 2 retries = 3 calls
      expect(handler).toHaveBeenCalledTimes(3);
      expect(onRetryExhausted).toHaveBeenCalledTimes(1);
      expect(onRetryExhausted).toHaveBeenCalledWith(
        expect.objectContaining({ sagaId: "saga-123" }),
        expect.any(SagaRetryableError),
        expect.any(Function),
      );
    });

    it("should not crash if onRetryExhausted is not defined", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new SagaRetryableError("always fails"));

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
        retryPolicy: { maxRetries: 1, initialDelayMs: 10 },
      });

      await runner.start();

      const handlePromise = subscribeHandler!(
        makeInboundMessage("order.created"),
      );
      await vi.advanceTimersByTimeAsync(10);
      await handlePromise;

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("non-retryable errors", () => {
    it("should not retry non-retryable errors", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new Error("fatal"));

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makeInboundMessage("order.created"));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
