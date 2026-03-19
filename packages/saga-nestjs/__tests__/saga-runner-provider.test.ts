import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Injectable } from "@nestjs/common";
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { SagaRunnerProvider } from "../src/providers/saga-runner.provider";
import { SagaParticipant } from "../src/decorators/saga-participant.decorator";
import { MessageHandler } from "../src/decorators/message-handler.decorator";
import { SagaParticipantBase } from "../src/saga-participant-base";
import { SagaRunner, SagaRegistry } from "@fbsm/saga-core";
import type { IncomingEvent, Emit, PlainMessage } from "@fbsm/saga-core";
import { SagaRetryableError } from "@fbsm/saga-core";

@SagaParticipant("order.created")
class TestPaymentParticipant extends SagaParticipantBase {
  async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}
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

function createMockModuleRef(instances: object[]): Partial<ModuleRef> {
  return {
    resolve: vi.fn().mockImplementation(async (metatype: any) => {
      const found = instances.find(
        (instance) => instance.constructor === metatype,
      );
      if (!found) {
        throw new Error(`Could not find ${metatype?.name ?? "unknown"}`);
      }
      return found;
    }),
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

  it("should discover @SagaParticipant classes and register handle() for declared topics", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const moduleRef = createMockModuleRef([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("TestPaymentParticipant");

    const topics = Object.keys(participants[0].on);
    expect(topics).toContain("order.created");
  });

  it("should auto-derive serviceId from class name", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const moduleRef = createMockModuleRef([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants[0].serviceId).toBe("TestPaymentParticipant");
  });

  it("should call runner.start() on module init", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const moduleRef = createMockModuleRef([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    expect(runner.start).toHaveBeenCalledTimes(1);
  });

  it("should call runner.stop() on module destroy", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const moduleRef = createMockModuleRef([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleDestroy();

    expect(runner.stop).toHaveBeenCalledTimes(1);
  });

  it("should bind handle method to the instance correctly", async () => {
    const discovery = createMockDiscoveryService([participant]);
    const moduleRef = createMockModuleRef([participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
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
    const moduleRef = createMockModuleRef([regularInstance, participant]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("TestPaymentParticipant");
  });

  it("should include onRetryExhausted when defined", async () => {
    @SagaParticipant("some.event")
    class ParticipantWithRetry extends SagaParticipantBase {
      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}

      async onRetryExhausted(): Promise<void> {}
    }

    const instance = new ParticipantWithRetry();
    const discovery = createMockDiscoveryService([instance]);
    const moduleRef = createMockModuleRef([instance]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants[0].onRetryExhausted).toBeInstanceOf(Function);
  });

  it("should include onFail when defined", async () => {
    @SagaParticipant("some.event")
    class ParticipantWithFail extends SagaParticipantBase {
      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}

      async onFail(
        _event: IncomingEvent,
        _error: Error,
        _emit: Emit,
      ): Promise<void> {}
    }

    const instance = new ParticipantWithFail();
    const discovery = createMockDiscoveryService([instance]);
    const moduleRef = createMockModuleRef([instance]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants[0].onFail).toBeInstanceOf(Function);
  });

  it("should discover @MessageHandler methods and register plain handlers", async () => {
    @SagaParticipant("order.created")
    class ParticipantWithPlain extends SagaParticipantBase {
      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}

      @MessageHandler("legacy.order")
      async handleLegacy(_message: PlainMessage): Promise<void> {}
    }

    const instance = new ParticipantWithPlain();
    const discovery = createMockDiscoveryService([instance]);
    const moduleRef = createMockModuleRef([instance]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants[0].onPlain).toBeDefined();
    expect(participants[0].onPlain!["legacy.order"]).toBeInstanceOf(Function);
  });

  it("should register participant with handler options (fork, final)", async () => {
    @SagaParticipant("bulk-activation.requested", { fork: true })
    class ForkParticipant extends SagaParticipantBase {
      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}
    }

    const instance = new ForkParticipant();
    const discovery = createMockDiscoveryService([instance]);
    const moduleRef = createMockModuleRef([instance]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants[0].handlerOptions).toBeDefined();
    expect(
      participants[0].handlerOptions!["bulk-activation.requested"].fork,
    ).toBe(true);
  });

  it("should register participant with multiple saga topics mapping to handle()", async () => {
    @SagaParticipant(["event.a", "event.b"])
    class MultiTopicParticipant extends SagaParticipantBase {
      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}
    }

    const instance = new MultiTopicParticipant();
    const discovery = createMockDiscoveryService([instance]);
    const moduleRef = createMockModuleRef([instance]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    const topics = Object.keys(participants[0].on);
    expect(topics).toContain("event.a");
    expect(topics).toContain("event.b");
  });

  it("should resolve participant with constructor dependencies", async () => {
    @Injectable()
    class OrderRepository {
      findOrder(orderId: string) {
        return { orderId, status: "pending" };
      }
    }

    @SagaParticipant("order.paid")
    class PaymentParticipantWithDeps extends SagaParticipantBase {
      constructor(private readonly orderRepo: OrderRepository) {
        super();
      }

      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {
        this.orderRepo.findOrder("test");
      }
    }

    const orderRepo = new OrderRepository();
    const instance = new PaymentParticipantWithDeps(orderRepo);
    const discovery = createMockDiscoveryService([instance]);
    const moduleRef = createMockModuleRef([instance]);
    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("PaymentParticipantWithDeps");
    expect(participants[0].on["order.paid"]).toBeInstanceOf(Function);
  });

  it("should skip unresolvable participant and still register others", async () => {
    @SagaParticipant("broken.topic")
    class BrokenParticipant extends SagaParticipantBase {
      async handle(_event: IncomingEvent, _emit: Emit): Promise<void> {}
    }

    const brokenInstance = new BrokenParticipant();
    const discovery = createMockDiscoveryService([brokenInstance, participant]);

    // Only the working participant is resolvable; BrokenParticipant throws
    const moduleRef: Partial<ModuleRef> = {
      resolve: vi.fn().mockImplementation(async (metatype: any) => {
        if (metatype === BrokenParticipant) {
          throw new Error("NotFoundException: BrokenParticipant not found");
        }
        if (metatype === TestPaymentParticipant) {
          return participant;
        }
        throw new Error(`Unknown metatype: ${metatype?.name}`);
      }),
    };

    const provider = new SagaRunnerProvider(
      discovery as DiscoveryService,
      registry,
      runner as unknown as SagaRunner,
      moduleRef as ModuleRef,
    );

    await provider.onModuleInit();

    const participants = registry.getAll();
    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("TestPaymentParticipant");
    expect(runner.start).toHaveBeenCalledTimes(1);
  });
});
