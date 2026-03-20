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

  describe("ancestorChain propagation", () => {
    it("should include saga-ancestor-chain header when ancestorChain is provided", async () => {
      const emit = publisher.forSaga("sub-saga-C", {
        parentSagaId: "saga-B",
        rootSagaId: "saga-A",
        ancestorChain: ["saga-B", "saga-A"],
      });
      await emit({
        topic: "child.step",
        stepName: "step",
        payload: {},
      });

      const msg = transport.publishedMessages[0];
      expect(msg.headers["saga-ancestor-chain"]).toBe("saga-B,saga-A");
    });

    it("should not include saga-ancestor-chain header when ancestorChain is empty", async () => {
      const emit = publisher.forSaga("saga-A", {
        parentSagaId: undefined,
        rootSagaId: "saga-A",
        ancestorChain: [],
      });
      await emit({
        topic: "root.step",
        stepName: "step",
        payload: {},
      });

      const msg = transport.publishedMessages[0];
      expect(msg.headers["saga-ancestor-chain"]).toBeUndefined();
    });

    it("should not include saga-ancestor-chain header when ancestorChain is undefined", async () => {
      const emit = publisher.forSaga("saga-A");
      await emit({
        topic: "root.step",
        stepName: "step",
        payload: {},
      });

      const msg = transport.publishedMessages[0];
      expect(msg.headers["saga-ancestor-chain"]).toBeUndefined();
    });

    it("start() should set ancestorChain to empty array in context", async () => {
      let capturedAncestorChain: string[] | undefined;
      await publisher.start(async () => {
        const { SagaContext } = await import("../src/context/saga-context");
        const ctx = SagaContext.require();
        capturedAncestorChain = ctx.ancestorChain;
      });

      expect(capturedAncestorChain).toEqual([]);
    });

    it("startChild() should build ancestorChain with parent sagaId prepended", async () => {
      let parentSagaId: string | undefined;
      let childAncestorChain: string[] | undefined;

      await publisher.start(async () => {
        const { SagaContext } = await import("../src/context/saga-context");
        parentSagaId = SagaContext.require().sagaId;

        await publisher.startChild(async () => {
          const childCtx = SagaContext.require();
          childAncestorChain = childCtx.ancestorChain;
        });
      });

      expect(childAncestorChain).toEqual([parentSagaId]);
    });

    it("emitToParent() with 3 levels should set correct parentSagaId (grandparent)", async () => {
      let rootId: string | undefined;
      let midId: string | undefined;

      await publisher.start(async () => {
        const { SagaContext } = await import("../src/context/saga-context");
        rootId = SagaContext.require().sagaId;

        await publisher.startChild(async () => {
          midId = SagaContext.require().sagaId;

          await publisher.startChild(async () => {
            // Leaf level (C) — emitToParent should target B with parentSagaId=A
            await publisher.emitToParent({
              topic: "leaf.done",
              stepName: "leaf-done",
              payload: { result: "ok" },
            });
          });
        });
      });

      const msg = transport.publishedMessages[0];
      expect(msg.headers["saga-id"]).toBe(midId);
      expect(msg.headers["saga-parent-id"]).toBe(rootId);
      expect(msg.headers["saga-ancestor-chain"]).toBe(rootId);
    });

    it("emitToParent() callback with 3 levels should set correct context", async () => {
      let rootId: string | undefined;
      let midId: string | undefined;
      let parentCtxInsideCallback: { sagaId: string; parentSagaId?: string; ancestorChain?: string[] } | undefined;

      await publisher.start(async () => {
        const { SagaContext } = await import("../src/context/saga-context");
        rootId = SagaContext.require().sagaId;

        await publisher.startChild(async () => {
          midId = SagaContext.require().sagaId;

          await publisher.startChild(async () => {
            await publisher.emitToParent(async () => {
              const ctx = SagaContext.require();
              parentCtxInsideCallback = {
                sagaId: ctx.sagaId,
                parentSagaId: ctx.parentSagaId,
                ancestorChain: ctx.ancestorChain,
              };
            });
          });
        });
      });

      expect(parentCtxInsideCallback!.sagaId).toBe(midId);
      expect(parentCtxInsideCallback!.parentSagaId).toBe(rootId);
      expect(parentCtxInsideCallback!.ancestorChain).toEqual([rootId]);
    });
  });

  describe("start() context-aware auto-promotion", () => {
    it("should create child saga when called inside existing context", async () => {
      let parentSagaId: string | undefined;
      let childParentSagaId: string | undefined;
      let childRootSagaId: string | undefined;
      let childAncestorChain: string[] | undefined;

      const { sagaId: rootId } = await publisher.start(async () => {
        const { SagaContext } = await import("../src/context/saga-context");
        parentSagaId = SagaContext.require().sagaId;

        const { sagaId: childId } = await publisher.start(async () => {
          const childCtx = SagaContext.require();
          childParentSagaId = childCtx.parentSagaId;
          childRootSagaId = childCtx.rootSagaId;
          childAncestorChain = childCtx.ancestorChain;
        });

        expect(childId).not.toBe(parentSagaId);
      });

      expect(childParentSagaId).toBe(parentSagaId);
      expect(childRootSagaId).toBe(rootId);
      expect(childAncestorChain).toEqual([parentSagaId]);
    });

    it("should inherit key and sagaName from parent when not overridden", async () => {
      let childKey: string | undefined;
      let childSagaName: string | undefined;

      await publisher.start(
        async () => {
          await publisher.start(async () => {
            const { SagaContext } = await import("../src/context/saga-context");
            const childCtx = SagaContext.require();
            childKey = childCtx.key;
            childSagaName = childCtx.sagaName;
          });
        },
        { key: "parent-key", sagaName: "parent-saga" },
      );

      expect(childKey).toBe("parent-key");
      expect(childSagaName).toBe("parent-saga");
    });

    it("should create independent root saga with independent: true", async () => {
      let innerParentSagaId: string | undefined;
      let innerRootSagaId: string | undefined;
      let innerSagaId: string | undefined;

      await publisher.start(async () => {
        const { sagaId } = await publisher.start(
          async () => {
            const { SagaContext } = await import("../src/context/saga-context");
            const ctx = SagaContext.require();
            innerSagaId = ctx.sagaId;
            innerParentSagaId = ctx.parentSagaId;
            innerRootSagaId = ctx.rootSagaId;
          },
          { independent: true },
        );

        innerSagaId = sagaId;
      });

      expect(innerParentSagaId).toBeUndefined();
      expect(innerRootSagaId).toBe(innerSagaId);
    });

    it("should create root saga when no context exists (regression)", async () => {
      let sagaIdFromCtx: string | undefined;
      let rootSagaIdFromCtx: string | undefined;
      let parentSagaIdFromCtx: string | undefined;

      const { sagaId } = await publisher.start(async () => {
        const { SagaContext } = await import("../src/context/saga-context");
        const ctx = SagaContext.require();
        sagaIdFromCtx = ctx.sagaId;
        rootSagaIdFromCtx = ctx.rootSagaId;
        parentSagaIdFromCtx = ctx.parentSagaId;
      });

      expect(sagaIdFromCtx).toBe(sagaId);
      expect(rootSagaIdFromCtx).toBe(sagaId);
      expect(parentSagaIdFromCtx).toBeUndefined();
    });

    it("emitToParent() should work in saga created via auto-promoted start()", async () => {
      let rootId: string | undefined;
      let midId: string | undefined;

      await publisher.start(async () => {
        const { SagaContext } = await import("../src/context/saga-context");
        rootId = SagaContext.require().sagaId;

        // auto-promoted start() creates a child
        await publisher.start(async () => {
          midId = SagaContext.require().sagaId;

          await publisher.emitToParent({
            topic: "child.done",
            stepName: "child-done",
            payload: { status: "ok" },
          });
        });
      });

      const msg = transport.publishedMessages[0];
      expect(msg.headers["saga-id"]).toBe(rootId);
      expect(msg.headers["saga-parent-id"]).toBeUndefined();
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
