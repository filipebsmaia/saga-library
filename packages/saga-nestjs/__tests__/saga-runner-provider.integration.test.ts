import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Injectable, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { SagaModule } from "../src/saga.module";
import { SagaParticipant } from "../src/decorators/saga-participant.decorator";
import { SagaParticipantBase } from "../src/saga-participant-base";
import {
  SagaRegistry,
  SagaRunner,
  type IncomingEvent,
  type Emit,
  type SagaTransport,
} from "@fbsm/saga-core";

// -- Stub transport that never connects to a real broker --

function createStubTransport(): SagaTransport {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
  };
}

// -- Simulated injected dependency --

@Injectable()
class OrderRepository {
  findOrder(orderId: string) {
    return { orderId, status: "pending" };
  }
}

// -- Participant with constructor DI --

@SagaParticipant("order.created")
class OrderParticipant extends SagaParticipantBase {
  constructor(private readonly orderRepo: OrderRepository) {
    super();
  }

  async handle(event: IncomingEvent, _emit: Emit): Promise<void> {
    this.orderRepo.findOrder(event.body?.orderId);
  }
}

describe("SagaRunnerProvider integration", () => {
  let testModule: TestingModule;

  afterEach(async () => {
    if (testModule) {
      await testModule.close();
    }
  });

  it("should resolve participant with constructor deps via forRoot()", async () => {
    const transport = createStubTransport();

    testModule = await Test.createTestingModule({
      imports: [
        SagaModule.forRoot({
          transport,
          groupId: "test-group",
        }),
      ],
      providers: [OrderRepository, OrderParticipant],
    }).compile();

    await testModule.init();

    const registry = testModule.get(SagaRegistry);
    const participants = registry.getAll();

    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("OrderParticipant");
    expect(participants[0].on["order.created"]).toBeInstanceOf(Function);
  });

  it("should resolve participant with constructor deps via forRootAsync()", async () => {
    const transport = createStubTransport();

    testModule = await Test.createTestingModule({
      imports: [
        SagaModule.forRootAsync({
          useFactory: async () => ({
            transport,
            groupId: "test-group-async",
          }),
        }),
      ],
      providers: [OrderRepository, OrderParticipant],
    }).compile();

    await testModule.init();

    const registry = testModule.get(SagaRegistry);
    const participants = registry.getAll();

    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("OrderParticipant");
    expect(participants[0].on["order.created"]).toBeInstanceOf(Function);
  });

  it("should resolve participant from an imported module", async () => {
    const transport = createStubTransport();

    @Module({
      providers: [OrderRepository, OrderParticipant],
      exports: [OrderParticipant],
    })
    class OrderModule {}

    testModule = await Test.createTestingModule({
      imports: [
        SagaModule.forRoot({
          transport,
          groupId: "test-group-module",
        }),
        OrderModule,
      ],
    }).compile();

    await testModule.init();

    const registry = testModule.get(SagaRegistry);
    const participants = registry.getAll();

    expect(participants).toHaveLength(1);
    expect(participants[0].serviceId).toBe("OrderParticipant");
  });
});
