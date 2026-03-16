import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Injectable } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { SagaRunnerProvider } from "../src/providers/saga-runner.provider";
import { SagaParticipant } from "../src/decorators/saga-participant.decorator";
import { SagaHandler } from "../src/decorators/saga-handler.decorator";
import { SagaParticipantBase } from "../src/saga-participant-base";
import { SagaRunner, SagaRegistry } from "@fbsm/saga-core";
import type { IncomingEvent, Emit } from "@fbsm/saga-core";

@SagaParticipant()
@Injectable()
class TestPaymentParticipant extends SagaParticipantBase {
  readonly serviceId = "payment-service";

  @SagaHandler("order.created")
  async process(_event: IncomingEvent, _emit: Emit): Promise<void> {}

  @SagaHandler("inventory.failed", "inventory.compensated")
  async compensate(_event: IncomingEvent, _emit: Emit): Promise<void> {}
}

function createMockDiscoveryService(
  instances: object[],
): Partial<DiscoveryService> {
  return {
    getProviders: () =>
      instances.map((instance) => ({
        instance,
        metatype: instance.constructor,
        name: instance.constructor.name,
        token: instance.constructor.name,
        isAlias: false,
      })) as any,
  };
}

describe("SagaRunnerProvider", () => {
  let registry: SagaRegistry;
  let runner: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let participant: TestPaymentParticipant;

  beforeEach(() => {
    registry = new SagaRegistry();
    runner = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    participant = new TestPaymentParticipant();
  });

  it("should discover @SagaParticipant classes and register handlers", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("payment-service");

    const eventTypes = Object.keys(participants[0].on);
    expect(eventTypes).toContain("order.created");
    expect(eventTypes).toContain("inventory.failed");
    expect(eventTypes).toContain("inventory.compensated");
  });

  it("should call runner.start() on module init", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
    );

    await provider.onModuleInit();

    expect(runner.start).toHaveBeenCalledTimes(1);
  });

  it("should call runner.stop() on module destroy", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
    );

    await provider.onModuleDestroy();

    expect(runner.stop).toHaveBeenCalledTimes(1);
  });

  it("should bind methods to the instance correctly", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    const handler = participants[0].on["order.created"];
    expect(handler).toBeInstanceOf(Function);
  });

  it("should skip providers without @SagaParticipant metadata", async () => {
    @Injectable()
    class RegularService {
      doSomething() {}
    }

    const regularInstance = new RegularService();
    const discovery = createMockDiscoveryService([
      regularInstance,
      participant,
    ]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("payment-service");
  });

  it("should include onRetryExhausted when defined", async () => {
    @SagaParticipant()
    @Injectable()
    class ParticipantWithRetry extends SagaParticipantBase {
      readonly serviceId = "retry-service";

      @SagaHandler("some.event")
      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}

      async onRetryExhausted(): Promise<void> {}
    }

    const instance = new ParticipantWithRetry();
    const discovery = createMockDiscoveryService([instance]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants[0].onRetryExhausted).toBeInstanceOf(Function);
  });
});
