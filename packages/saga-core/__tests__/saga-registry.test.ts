import { describe, it, expect, vi } from "vitest";
import { SagaRegistry } from "../src/registry/saga-registry";
import { SagaDuplicateHandlerError } from "../src/errors/saga-duplicate-handler.error";
import type { SagaParticipant } from "../src/interfaces/saga-participant.interface";

function makeParticipant(
  serviceId: string,
  events: Record<string, () => Promise<void>>,
): SagaParticipant {
  const on: Record<string, any> = {};
  for (const [topic, fn] of Object.entries(events)) {
    on[topic] = fn;
  }
  return { serviceId, on };
}

describe("SagaRegistry", () => {
  it("should register and return participants", () => {
    const registry = new SagaRegistry();
    const participant1 = makeParticipant("svc-a", { "event.a": async () => {} });
    const participant2 = makeParticipant("svc-b", { "event.b": async () => {} });

    registry.register(participant1);
    registry.register(participant2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].serviceId).toBe("svc-a");
    expect(all[1].serviceId).toBe("svc-b");
  });

  it("should return a copy from getAll", () => {
    const registry = new SagaRegistry();
    const participant1 = makeParticipant("svc-a", { "event.a": async () => {} });
    registry.register(participant1);

    const all = registry.getAll();
    all.pop();

    expect(registry.getAll()).toHaveLength(1);
  });

  it("should build a route map from registered participants", () => {
    const registry = new SagaRegistry();
    const handlerA = async () => {};
    const handlerB = async () => {};
    registry.register(makeParticipant("svc-a", { "event.a": handlerA }));
    registry.register(makeParticipant("svc-b", { "event.b": handlerB }));

    const routeMap = registry.buildRouteMap();

    expect(routeMap.size).toBe(2);
    expect(routeMap.get("event.a")?.sagaParticipant?.serviceId).toBe("svc-a");
    expect(routeMap.get("event.a")?.sagaHandler).toBe(handlerA);
    expect(routeMap.get("event.b")?.sagaParticipant?.serviceId).toBe("svc-b");
    expect(routeMap.get("event.b")?.sagaHandler).toBe(handlerB);
  });

  it("should handle participant with multiple topics", () => {
    const registry = new SagaRegistry();
    const handlerA = async () => {};
    const handlerB = async () => {};
    registry.register(
      makeParticipant("svc-a", { "event.a": handlerA, "event.b": handlerB }),
    );

    const routeMap = registry.buildRouteMap();

    expect(routeMap.size).toBe(2);
    expect(routeMap.get("event.a")?.sagaHandler).toBe(handlerA);
    expect(routeMap.get("event.b")?.sagaHandler).toBe(handlerB);
  });

  it("should throw on duplicate saga handler for same topic", () => {
    const registry = new SagaRegistry();
    registry.register(makeParticipant("svc-a", { "event.a": async () => {} }));
    registry.register(makeParticipant("svc-b", { "event.a": async () => {} }));

    expect(() => registry.buildRouteMap()).toThrow(SagaDuplicateHandlerError);
  });

  it("should return empty map for empty registry", () => {
    const registry = new SagaRegistry();
    const routeMap = registry.buildRouteMap();
    expect(routeMap.size).toBe(0);
  });

  it("should allow same topic with both saga and plain handlers", () => {
    const registry = new SagaRegistry();
    const sagaHandler = vi.fn().mockResolvedValue(undefined);
    const plainHandler = vi.fn().mockResolvedValue(undefined);

    registry.register({
      serviceId: "svc-a",
      on: { "event.a": sagaHandler },
    });
    registry.register({
      serviceId: "svc-b",
      on: {},
      onPlain: { "event.a": plainHandler },
    });

    const routeMap = registry.buildRouteMap();

    expect(routeMap.size).toBe(1);
    expect(routeMap.get("event.a")?.sagaHandler).toBe(sagaHandler);
    expect(routeMap.get("event.a")?.plainHandler).toBe(plainHandler);
  });

  it("should throw on duplicate plain handler for same topic", () => {
    const registry = new SagaRegistry();
    const plainHandler1 = vi.fn().mockResolvedValue(undefined);
    const plainHandler2 = vi.fn().mockResolvedValue(undefined);

    registry.register({
      serviceId: "svc-a",
      on: {},
      onPlain: { "event.a": plainHandler1 },
    });
    registry.register({
      serviceId: "svc-b",
      on: {},
      onPlain: { "event.a": plainHandler2 },
    });

    expect(() => registry.buildRouteMap()).toThrow(SagaDuplicateHandlerError);
  });

  it("should register plain handlers correctly", () => {
    const registry = new SagaRegistry();
    const plainHandler = vi.fn().mockResolvedValue(undefined);

    registry.register({
      serviceId: "svc-a",
      on: {},
      onPlain: { "legacy.event": plainHandler },
    });

    const routeMap = registry.buildRouteMap();

    expect(routeMap.size).toBe(1);
    expect(routeMap.get("legacy.event")?.plainHandler).toBe(plainHandler);
    expect(routeMap.get("legacy.event")?.sagaHandler).toBeUndefined();
  });
});
