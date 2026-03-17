import { describe, it, expect, vi } from "vitest";
import { SagaHealthIndicator } from "../src/providers/saga-health-indicator";
import type { SagaRunner } from "@fbsm/saga-core";

describe("SagaHealthIndicator", () => {
  it("should delegate to runner.healthCheck() and return up", async () => {
    const mockRunner = {
      healthCheck: vi.fn().mockResolvedValue({
        status: "up",
        details: {
          consumerGroupState: "Stable",
          groupId: "test-group",
          memberCount: 1,
        },
      }),
    } as unknown as SagaRunner;

    const indicator = new SagaHealthIndicator(mockRunner);
    const result = await indicator.check();

    expect(mockRunner.healthCheck).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("up");
  });

  it("should return down when runner reports unhealthy", async () => {
    const mockRunner = {
      healthCheck: vi.fn().mockResolvedValue({
        status: "down",
        details: { reason: "Consumer not initialized" },
      }),
    } as unknown as SagaRunner;

    const indicator = new SagaHealthIndicator(mockRunner);
    const result = await indicator.check();

    expect(result.status).toBe("down");
    expect(result.details?.reason).toBe("Consumer not initialized");
  });
});
