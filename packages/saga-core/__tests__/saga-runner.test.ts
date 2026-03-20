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
  topic: string,
  sagaId = "saga-123",
): InboundMessage {
  return {
    topic,
    key: sagaId,
    value: JSON.stringify({ orderId: "456" }),
    headers: {
      "saga-id": sagaId,
      "saga-correlation-id": sagaId,
      "saga-causation-id": sagaId,
      "saga-event-id": "evt-001",
      "saga-step-name": "order",
      "saga-published-at": "2024-01-01T00:00:01.000Z",
      "saga-schema-version": "1",
      "saga-root-id": sagaId,
      "saga-occurred-at": "2024-01-01T00:00:00.000Z",
    },
  };
}

function makePlainMessage(
  topic: string,
  payload: Record<string, unknown> = { orderId: "456" },
): InboundMessage {
  return {
    topic,
    key: "key-123",
    value: JSON.stringify(payload),
    headers: {},
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
        topic: "order.created",
        payload: { orderId: "456" },
      }),
      expect.any(Function),
    );
  });

  it("should skip unparseable messages when no plain handler", async () => {
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
      topic: "order.created",
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

  describe("onFail error flow", () => {
    it("should call onFail on non-retryable error from handle", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fatal"));
      const onFail = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        onFail,
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makeInboundMessage("order.created"));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledWith(
        expect.objectContaining({ sagaId: "saga-123" }),
        expect.any(Error),
        expect.any(Function),
      );
    });

    it("should succeed when onFail completes without error", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new Error("fatal"));
      const onFail = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        onFail,
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makeInboundMessage("order.created"));

      expect(onFail).toHaveBeenCalledTimes(1);
      // Should NOT log error since onFail succeeded
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should retry onFail when it throws SagaRetryableError", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fatal"));
      let onFailCallCount = 0;
      const onFail = vi.fn().mockImplementation(async () => {
        onFailCallCount++;
        if (onFailCallCount <= 1) {
          throw new SagaRetryableError("transient onFail");
        }
      });

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        onFail,
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
        retryPolicy: { maxRetries: 2, initialDelayMs: 10 },
      });

      await runner.start();

      const handlePromise = subscribeHandler!(
        makeInboundMessage("order.created"),
      );

      await vi.advanceTimersByTimeAsync(10);
      await handlePromise;

      expect(handler).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledTimes(2);
    });

    it("should call onRetryExhausted when onFail retries are exhausted", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("fatal"));
      const onFail = vi
        .fn()
        .mockRejectedValue(new SagaRetryableError("onFail always fails"));
      const onRetryExhausted = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        onFail,
        onRetryExhausted,
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

      // handler: 1 call, onFail: 1 + 1 retry = 2, onRetryExhausted: 1
      expect(handler).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledTimes(2);
      expect(onRetryExhausted).toHaveBeenCalledTimes(1);
      expect(onRetryExhausted).toHaveBeenCalledWith(
        expect.objectContaining({ sagaId: "saga-123" }),
        expect.any(SagaRetryableError),
        expect.any(Function),
      );
    });

    it("should log error when onFail throws non-retryable error", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const handler = vi.fn().mockRejectedValue(new Error("fatal"));
      const onFail = vi
        .fn()
        .mockRejectedValue(new Error("onFail also fatal"));

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        onFail,
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makeInboundMessage("order.created"));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should not call onFail for retryable errors (only non-retryable)", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new SagaRetryableError("transient"));
      const onFail = vi.fn().mockResolvedValue(undefined);
      const onRetryExhausted = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        onFail,
        onRetryExhausted,
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

      expect(onFail).not.toHaveBeenCalled();
      expect(onRetryExhausted).toHaveBeenCalledTimes(1);
    });
  });

  describe("ancestorChain propagation", () => {
    it("should pass ancestorChain to handler via IncomingEvent", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();

      const message: InboundMessage = {
        topic: "order.created",
        key: "saga-B",
        value: JSON.stringify({ orderId: "456" }),
        headers: {
          "saga-id": "saga-B",
          "saga-causation-id": "saga-B",
          "saga-event-id": "evt-001",
          "saga-step-name": "order",
          "saga-published-at": "2024-01-01T00:00:01.000Z",
          "saga-schema-version": "1",
          "saga-root-id": "saga-A",
          "saga-parent-id": "saga-A",
          "saga-occurred-at": "2024-01-01T00:00:00.000Z",
          "saga-ancestor-chain": "saga-A",
        },
      };

      await subscribeHandler!(message);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sagaId: "saga-B",
          ancestorChain: ["saga-A"],
        }),
        expect.any(Function),
      );
    });

    it("should build ancestorChain for forked sub-sagas", async () => {
      let emittedMessage: any;
      const handler = vi
        .fn()
        .mockImplementation(async (_event: any, emit: any) => {
          await emit({
            topic: "child.started",
            stepName: "child",
            payload: {},
          });
        });

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": handler },
        handlerOptions: { "order.created": { fork: true } },
      });

      // Capture published messages
      (transport.publish as any).mockImplementation(async (msg: any) => {
        if (msg.topic === "child.started") {
          emittedMessage = msg;
        }
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();

      const message: InboundMessage = {
        topic: "order.created",
        key: "saga-A",
        value: JSON.stringify({ orderId: "456" }),
        headers: {
          "saga-id": "saga-A",
          "saga-causation-id": "saga-A",
          "saga-event-id": "evt-001",
          "saga-step-name": "order",
          "saga-published-at": "2024-01-01T00:00:01.000Z",
          "saga-schema-version": "1",
          "saga-root-id": "saga-A",
          "saga-occurred-at": "2024-01-01T00:00:00.000Z",
        },
      };

      await subscribeHandler!(message);

      expect(emittedMessage).toBeDefined();
      expect(emittedMessage.headers["saga-parent-id"]).toBe("saga-A");
      expect(emittedMessage.headers["saga-ancestor-chain"]).toBe("saga-A");
    });
  });

  describe("plain message routing", () => {
    it("should route plain messages to plain handler", async () => {
      const plainHandler = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: {},
        onPlain: { "legacy.event": plainHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makePlainMessage("legacy.event"));

      expect(plainHandler).toHaveBeenCalledTimes(1);
      expect(plainHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "legacy.event",
          key: "key-123",
          payload: { orderId: "456" },
        }),
      );
    });

    it("should route saga messages to saga handler even when plain handler exists", async () => {
      const sagaHandler = vi.fn().mockResolvedValue(undefined);
      const plainHandler = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": sagaHandler },
        onPlain: { "order.created": plainHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makeInboundMessage("order.created"));

      expect(sagaHandler).toHaveBeenCalledTimes(1);
      expect(plainHandler).not.toHaveBeenCalled();
    });

    it("should route plain messages to plain handler even when saga handler exists", async () => {
      const sagaHandler = vi.fn().mockResolvedValue(undefined);
      const plainHandler = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": sagaHandler },
        onPlain: { "order.created": plainHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makePlainMessage("order.created"));

      expect(plainHandler).toHaveBeenCalledTimes(1);
      expect(sagaHandler).not.toHaveBeenCalled();
    });

    it("should skip saga message when no saga handler on topic", async () => {
      const plainHandler = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: {},
        onPlain: { "order.created": plainHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makeInboundMessage("order.created"));

      expect(plainHandler).not.toHaveBeenCalled();
    });

    it("should skip plain message when no plain handler on topic", async () => {
      const sagaHandler = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: { "order.created": sagaHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makePlainMessage("order.created"));

      expect(sagaHandler).not.toHaveBeenCalled();
    });

    it("should receive PlainMessage without saga fields", async () => {
      const plainHandler = vi.fn().mockResolvedValue(undefined);

      registry.register({
        serviceId: "svc-a",
        on: {},
        onPlain: { "legacy.event": plainHandler },
      });

      const runner = new SagaRunner(registry, transport, publisher, parser, {
        groupId: "test-group",
      });

      await runner.start();
      await subscribeHandler!(makePlainMessage("legacy.event", { data: "test" }));

      const receivedMessage = plainHandler.mock.calls[0][0];
      expect(receivedMessage.topic).toBe("legacy.event");
      expect(receivedMessage.key).toBe("key-123");
      expect(receivedMessage.payload).toEqual({ data: "test" });
      expect(receivedMessage.headers).toEqual({});
      // No saga fields
      expect(receivedMessage).not.toHaveProperty("sagaId");
      expect(receivedMessage).not.toHaveProperty("rootSagaId");
      expect(receivedMessage).not.toHaveProperty("causationId");
    });
  });
});
