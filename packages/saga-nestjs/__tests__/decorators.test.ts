import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { SagaParticipant } from "../src/decorators/saga-participant.decorator";
import { MessageHandler } from "../src/decorators/message-handler.decorator";
import {
  SAGA_PARTICIPANT_METADATA,
  SAGA_PARTICIPANT_TOPICS_METADATA,
  SAGA_PARTICIPANT_OPTIONS_METADATA,
  MESSAGE_HANDLER_METADATA,
} from "../src/constants";

describe("@SagaParticipant(topics)", () => {
  it("should set SAGA_PARTICIPANT_METADATA on the class", () => {
    @SagaParticipant("order.created")
    class TestParticipant {}

    const metadata = Reflect.getMetadata(
      SAGA_PARTICIPANT_METADATA,
      TestParticipant,
    );
    expect(metadata).toBe(true);
  });

  it("should store a single topic as an array", () => {
    @SagaParticipant("order.created")
    class TestParticipant {}

    const topics = Reflect.getMetadata(
      SAGA_PARTICIPANT_TOPICS_METADATA,
      TestParticipant,
    );
    expect(topics).toEqual(["order.created"]);
  });

  it("should store multiple topics", () => {
    @SagaParticipant(["inventory.failed", "inventory.compensated"])
    class TestParticipant {}

    const topics = Reflect.getMetadata(
      SAGA_PARTICIPANT_TOPICS_METADATA,
      TestParticipant,
    );
    expect(topics).toEqual(["inventory.failed", "inventory.compensated"]);
  });

  it("should store options when provided", () => {
    @SagaParticipant("bulk-activation.requested", { fork: true })
    class TestParticipant {}

    const options = Reflect.getMetadata(
      SAGA_PARTICIPANT_OPTIONS_METADATA,
      TestParticipant,
    );
    expect(options).toEqual({ fork: true });
  });

  it("should store final option", () => {
    @SagaParticipant("provisioning.completed", { final: true })
    class TestParticipant {}

    const options = Reflect.getMetadata(
      SAGA_PARTICIPANT_OPTIONS_METADATA,
      TestParticipant,
    );
    expect(options).toEqual({ final: true });
  });

  it("should not set options metadata when no options provided", () => {
    @SagaParticipant("order.created")
    class TestParticipant {}

    const options = Reflect.getMetadata(
      SAGA_PARTICIPANT_OPTIONS_METADATA,
      TestParticipant,
    );
    expect(options).toBeUndefined();
  });
});

describe("@MessageHandler()", () => {
  it("should map a single topic to the method", () => {
    class TestParticipant {
      @MessageHandler("legacy.order")
      async handleLegacy() {}
    }

    const map: Map<string, string | symbol> = Reflect.getMetadata(
      MESSAGE_HANDLER_METADATA,
      TestParticipant,
    );

    expect(map).toBeInstanceOf(Map);
    expect(map.get("legacy.order")).toBe("handleLegacy");
  });

  it("should map multiple topics to the same method", () => {
    class TestParticipant {
      @MessageHandler("legacy.a", "legacy.b")
      async handleLegacy() {}
    }

    const map: Map<string, string | symbol> = Reflect.getMetadata(
      MESSAGE_HANDLER_METADATA,
      TestParticipant,
    );

    expect(map.get("legacy.a")).toBe("handleLegacy");
    expect(map.get("legacy.b")).toBe("handleLegacy");
  });

  it("should accumulate handlers from multiple methods", () => {
    class TestParticipant {
      @MessageHandler("legacy.a")
      async handleA() {}

      @MessageHandler("legacy.b")
      async handleB() {}
    }

    const map: Map<string, string | symbol> = Reflect.getMetadata(
      MESSAGE_HANDLER_METADATA,
      TestParticipant,
    );

    expect(map.size).toBe(2);
    expect(map.get("legacy.a")).toBe("handleA");
    expect(map.get("legacy.b")).toBe("handleB");
  });
});
