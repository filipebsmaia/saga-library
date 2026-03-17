import { describe, it, expect, vi } from "vitest";
import { SagaRunner } from "../src/runner/saga-runner";
import { SagaRegistry } from "../src/registry/saga-registry";
import { SagaPublisher } from "../src/publisher/saga-publisher";
import { SagaParser } from "../src/parser/saga-parser";
import { NoopOtelContext } from "../src/otel/otel-context";
import type { SagaTransport } from "../src/transport/transport.interface";

function createMockTransport(): SagaTransport {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SagaRunner.healthCheck", () => {
  const otel = new NoopOtelContext();

  it("should delegate to transport when it implements HealthCheckable", async () => {
    const transport = {
      ...createMockTransport(),
      healthCheck: vi.fn().mockResolvedValue({
        status: "up",
        details: {
          consumerGroupState: "Stable",
          groupId: "test-group",
          memberCount: 1,
        },
      }),
    };

    const registry = new SagaRegistry();
    const publisher = new SagaPublisher(transport, otel);
    const parser = new SagaParser(otel);
    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "test-group",
    });

    const result = await runner.healthCheck();

    expect(transport.healthCheck).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("up");
    expect(result.details?.consumerGroupState).toBe("Stable");
  });

  it("should return up when transport does not implement HealthCheckable", async () => {
    const transport = createMockTransport();
    const registry = new SagaRegistry();
    const publisher = new SagaPublisher(transport, otel);
    const parser = new SagaParser(otel);
    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "test-group",
    });

    const result = await runner.healthCheck();

    expect(result.status).toBe("up");
    expect(result.details?.reason).toBe(
      "Transport does not support health checks",
    );
  });

  it("should return down when transport reports unhealthy", async () => {
    const transport = {
      ...createMockTransport(),
      healthCheck: vi.fn().mockResolvedValue({
        status: "down",
        details: {
          consumerGroupState: "Dead",
          groupId: "test-group",
          memberCount: 0,
        },
      }),
    };

    const registry = new SagaRegistry();
    const publisher = new SagaPublisher(transport, otel);
    const parser = new SagaParser(otel);
    const runner = new SagaRunner(registry, transport, publisher, parser, {
      groupId: "test-group",
    });

    const result = await runner.healthCheck();

    expect(result.status).toBe("down");
    expect(result.details?.consumerGroupState).toBe("Dead");
  });
});
