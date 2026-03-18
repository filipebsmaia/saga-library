import { describe, it, expect, vi, beforeEach } from "vitest";
import { SagaPublisher } from "../src/publisher/saga-publisher";
import { NoopOtelContext } from "../src/otel/otel-context";
import type {
  SagaTransport,
  OutboundMessage,
} from "../src/transport/transport.interface";
import type { OtelContext } from "../src/otel/otel-context";

function createMockTransport(): SagaTransport & {
  publishedMessages: OutboundMessage[];
} {
  const publishedMessages: OutboundMessage[] = [];
  return {
    publishedMessages,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockImplementation(async (msg: OutboundMessage) => {
      publishedMessages.push(msg);
    }),
    subscribe: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockOtel(): OtelContext & {
  injectBaggage: ReturnType<typeof vi.fn>;
  enrichSpan: ReturnType<typeof vi.fn>;
} {
  return {
    injectBaggage: vi.fn(),
    extractBaggage: vi.fn().mockReturnValue({}),
    enrichSpan: vi.fn(),
    withSpan: vi
      .fn()
      .mockImplementation(
        async (
          _name: string,
          _attrs: Record<string, string>,
          fn: () => Promise<any>,
        ) => fn(),
      ),
    injectTraceContext: vi.fn(),
    withExtractedSpan: vi
      .fn()
      .mockImplementation(
        async (
          _name: string,
          _attrs: Record<string, string>,
          _headers: Record<string, string>,
          fn: () => Promise<any>,
        ) => fn(),
      ),
  };
}

describe("SagaPublisher", () => {
  let transport: ReturnType<typeof createMockTransport>;
  let otel: ReturnType<typeof createMockOtel>;
  let publisher: SagaPublisher;

  beforeEach(() => {
    transport = createMockTransport();
    otel = createMockOtel();
    publisher = new SagaPublisher(transport, otel);
  });

  describe("forSaga (genesis — no parent context)", () => {
    it("should return an Emit that publishes with rootSagaId = sagaId", async () => {
      const emit = publisher.forSaga("saga-123");
      await emit({
        topic: "order.created",
        stepName: "order",
        payload: { orderId: "456" },
      });

      expect(transport.publishedMessages).toHaveLength(1);
      const msg = transport.publishedMessages[0];

      expect(msg.topic).toBe("order.created");
      expect(msg.key).toBe("saga-123");
      expect(msg.headers["saga-id"]).toBe("saga-123");
      expect(msg.headers["saga-root-id"]).toBe("saga-123");
      expect(msg.headers["saga-parent-id"]).toBeUndefined();
      expect(msg.headers["saga-schema-version"]).toBe("1");
      expect(msg.headers["saga-occurred-at"]).toBeDefined();

      const body = JSON.parse(msg.value);
      expect(body).toEqual({ orderId: "456" });
    });
  });

  describe("forSaga (sub-saga — with parent context)", () => {
    it("should propagate parentSagaId and rootSagaId", async () => {
      const emit = publisher.forSaga("sub-saga-789", {
        parentSagaId: "parent-456",
        rootSagaId: "root-123",
      });
      await emit({
        topic: "payment.processed",
        stepName: "payment",
        payload: { amount: 100 },
      });

      const msg = transport.publishedMessages[0];
      expect(msg.headers["saga-id"]).toBe("sub-saga-789");
      expect(msg.headers["saga-root-id"]).toBe("root-123");
      expect(msg.headers["saga-parent-id"]).toBe("parent-456");
    });
  });

  describe("publish", () => {
    it("should call otelCtx.injectBaggage and enrichSpan", async () => {
      const emit = publisher.forSaga("saga-123");
      await emit({
        topic: "order.created",
        stepName: "order",
        payload: { orderId: "456" },
      });

      expect(otel.injectBaggage).toHaveBeenCalledWith(
        "saga-123",
        "saga-123",
        undefined,
      );
      expect(otel.enrichSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          "saga.id": "saga-123",
          "saga.topic": "order.created",
          "saga.step.name": "order",
          "saga.root.id": "saga-123",
        }),
      );
    });

    it("should call transport.publish with OutboundMessage", async () => {
      const emit = publisher.forSaga("saga-123");
      await emit({
        topic: "order.created",
        stepName: "order",
        payload: { orderId: "456" },
      });

      expect(transport.publish).toHaveBeenCalledTimes(1);
      expect(transport.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "order.created",
          key: "saga-123",
        }),
      );
    });
  });

  describe("with NoopOtelContext", () => {
    it("should work without errors", async () => {
      const noopPublisher = new SagaPublisher(transport, new NoopOtelContext());
      const emit = noopPublisher.forSaga("saga-123");
      await emit({
        topic: "order.created",
        stepName: "order",
        payload: { orderId: "456" },
      });

      expect(transport.publishedMessages).toHaveLength(1);
    });
  });
});
