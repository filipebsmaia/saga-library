import { describe, it, expect, vi, beforeEach } from "vitest";
import { KafkaTransport } from "../src/kafka.transport";

const mockConsumerConnect = vi.fn().mockResolvedValue(undefined);
const mockConsumerDisconnect = vi.fn().mockResolvedValue(undefined);
const mockConsumerSubscribe = vi.fn().mockResolvedValue(undefined);
const mockConsumerRun = vi.fn().mockResolvedValue(undefined);
const mockDescribeGroup = vi.fn();
const mockConsumerFactory = vi.fn().mockReturnValue({
  connect: mockConsumerConnect,
  disconnect: mockConsumerDisconnect,
  subscribe: mockConsumerSubscribe,
  run: mockConsumerRun,
  describeGroup: mockDescribeGroup,
});

vi.mock("kafkajs", () => ({
  logLevel: { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 4, DEBUG: 5 },
  Kafka: vi.fn().mockImplementation(() => ({
    producer: () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
    }),
    consumer: mockConsumerFactory,
    admin: () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTopics: vi.fn().mockResolvedValue([]),
      createTopics: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}));

function makeGroupDescription(state: string) {
  return {
    groupId: "test-group",
    state,
    protocolType: "consumer",
    protocol: "RoundRobinAssigner",
    members: [
      { memberId: "member-1", clientId: "client-1", clientHost: "/127.0.0.1" },
    ],
  };
}

describe("KafkaTransport.healthCheck", () => {
  let transport: KafkaTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumerFactory.mockReturnValue({
      connect: mockConsumerConnect,
      disconnect: mockConsumerDisconnect,
      subscribe: mockConsumerSubscribe,
      run: mockConsumerRun,
      describeGroup: mockDescribeGroup,
    });
    transport = new KafkaTransport({
      brokers: ["localhost:9092"],
      clientId: "test-client",
    });
  });

  it("should return down when consumer is not initialized", async () => {
    const result = await transport.healthCheck();

    expect(result.status).toBe("down");
    expect(result.details).toEqual({ reason: "Consumer not initialized" });
  });

  it("should return up when consumer group state is Stable", async () => {
    mockDescribeGroup.mockResolvedValue(makeGroupDescription("Stable"));
    await transport.subscribe(["topic1"], async () => {}, {
      groupId: "test-group",
    });

    const result = await transport.healthCheck();

    expect(result.status).toBe("up");
    expect(result.details).toEqual({
      consumerGroupState: "Stable",
      groupId: "test-group",
      memberCount: 1,
    });
  });

  it("should return up when consumer group state is CompletingRebalance", async () => {
    mockDescribeGroup.mockResolvedValue(
      makeGroupDescription("CompletingRebalance"),
    );
    await transport.subscribe(["topic1"], async () => {}, {
      groupId: "test-group",
    });

    const result = await transport.healthCheck();

    expect(result.status).toBe("up");
    expect(result.details?.consumerGroupState).toBe("CompletingRebalance");
  });

  it("should return up when consumer group state is PreparingRebalance", async () => {
    mockDescribeGroup.mockResolvedValue(
      makeGroupDescription("PreparingRebalance"),
    );
    await transport.subscribe(["topic1"], async () => {}, {
      groupId: "test-group",
    });

    const result = await transport.healthCheck();

    expect(result.status).toBe("up");
    expect(result.details?.consumerGroupState).toBe("PreparingRebalance");
  });

  it("should return down when consumer group state is Dead", async () => {
    mockDescribeGroup.mockResolvedValue(makeGroupDescription("Dead"));
    await transport.subscribe(["topic1"], async () => {}, {
      groupId: "test-group",
    });

    const result = await transport.healthCheck();

    expect(result.status).toBe("down");
    expect(result.details?.consumerGroupState).toBe("Dead");
  });

  it("should return down when consumer group state is Empty", async () => {
    mockDescribeGroup.mockResolvedValue(makeGroupDescription("Empty"));
    await transport.subscribe(["topic1"], async () => {}, {
      groupId: "test-group",
    });

    const result = await transport.healthCheck();

    expect(result.status).toBe("down");
    expect(result.details?.consumerGroupState).toBe("Empty");
  });

  it("should return down when describeGroup throws", async () => {
    mockDescribeGroup.mockRejectedValue(new Error("Broker unavailable"));
    await transport.subscribe(["topic1"], async () => {}, {
      groupId: "test-group",
    });

    const result = await transport.healthCheck();

    expect(result.status).toBe("down");
    expect(result.details).toEqual({
      reason: "Failed to describe consumer group",
      error: "Broker unavailable",
    });
  });
});
