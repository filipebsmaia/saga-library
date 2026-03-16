import { describe, it, expect } from "vitest";
import { SagaRegistry } from "../src/registry/saga-registry";
import { SagaDuplicateHandlerError } from "../src/errors/saga-duplicate-handler.error";
import type { SagaParticipant } from "../src/interfaces/saga-participant.interface";

function makeParticipant(
  serviceId: string,
  events: Record<string, () => Promise<void>>,
): SagaParticipant {
  const on: Record<string, any> = {};
  for (const [eventType, fn] of Object.entries(events)) {
    on[eventType] = fn;
  }
  return { serviceId, on };
}

describe("SagaRegistry", () => {
  it("should register and return participants", () => {
    const registry = new SagaRegistry();
    const p1 = makeParticipant("svc-a", { "event.a": async () => {} });
    const p2 = makeParticipant("svc-b", { "event.b": async () => {} });

    registry.register(p1);
    registry.register(p2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].serviceId).toBe("svc-a");
    expect(all[1].serviceId).toBe("svc-b");
  });

  it("should return a copy from getAll", () => {
    const registry = new SagaRegistry();
    const p1 = makeParticipant("svc-a", { "event.a": async () => {} });
    registry.register(p1);

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
    expect(routeMap.get("event.a")?.participant.serviceId).toBe("svc-a");
    expect(routeMap.get("event.a")?.handler).toBe(handlerA);
    expect(routeMap.get("event.b")?.participant.serviceId).toBe("svc-b");
    expect(routeMap.get("event.b")?.handler).toBe(handlerB);
  });

  it("should handle participant with multiple event types", () => {
    const registry = new SagaRegistry();
    const handlerA = async () => {};
    const handlerB = async () => {};
    registry.register(
      makeParticipant("svc-a", { "event.a": handlerA, "event.b": handlerB }),
    );

    const routeMap = registry.buildRouteMap();

    expect(routeMap.size).toBe(2);
    expect(routeMap.get("event.a")?.handler).toBe(handlerA);
    expect(routeMap.get("event.b")?.handler).toBe(handlerB);
  });

  it("should throw on duplicate event type across participants", () => {
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
});
