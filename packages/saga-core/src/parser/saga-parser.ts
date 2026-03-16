import { v7 as uuidv7 } from "uuid";
import type { SagaEvent } from "../interfaces/saga-event.interface";
import type { InboundMessage } from "../transport/transport.interface";
import type { OtelContext } from "../otel/otel-context";

export class SagaParser {
  constructor(private otelCtx: OtelContext) {}

  parse<T>(message: InboundMessage): SagaEvent<T> | null {
    try {
      if (message.headers["saga-id"]) {
        return this.parseFromHeaders<T>(message);
      }

      const baggageResult = this.parseFromBaggage<T>(message);
      if (baggageResult) return baggageResult;

      const body = JSON.parse(message.value);
      if (body && body.sagaId) {
        return body as SagaEvent<T>;
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseFromHeaders<T>(message: InboundMessage): SagaEvent<T> | null {
    const headers = message.headers;
    const body = JSON.parse(message.value);

    const sagaId = headers["saga-id"];
    if (!sagaId) {
      return null;
    }

    return {
      sagaId,
      causationId: headers["saga-causation-id"] ?? sagaId,
      eventId: headers["saga-event-id"] ?? uuidv7(),
      eventType: body.eventType,
      stepName: headers["saga-step-name"] ?? "",
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      publishedAt: headers["saga-published-at"] ?? new Date().toISOString(),
      schemaVersion: 1,
      rootSagaId: headers["saga-root-id"] ?? sagaId,
      parentSagaId: headers["saga-parent-id"] || undefined,
      payload: body.payload as T,
      sagaName: headers["saga-name"] || undefined,
      sagaDescription: headers["saga-description"] || undefined,
      stepDescription: headers["saga-step-description"] || undefined,
      key: headers["saga-key"] || undefined,
    };
  }

  private parseFromBaggage<T>(message: InboundMessage): SagaEvent<T> | null {
    let sagaId: string | undefined;
    let rootSagaId: string | undefined;
    let parentSagaId: string | undefined;

    const baggageHeader = message.headers["baggage"];
    if (baggageHeader) {
      const entries = this.parseBaggageHeader(baggageHeader);
      sagaId = entries["saga.id"];
      rootSagaId = entries["saga.root.id"];
      parentSagaId = entries["saga.parent.id"];
    }

    // Fallback to OTel context extraction
    if (!sagaId) {
      const extracted = this.otelCtx.extractBaggage();
      sagaId = extracted.sagaId;
      rootSagaId = extracted.rootSagaId;
      parentSagaId = extracted.parentSagaId;
    }

    if (!sagaId) return null;

    const body = JSON.parse(message.value);

    return {
      sagaId,
      causationId: sagaId,
      eventId: uuidv7(),
      eventType: body.eventType,
      stepName: "",
      occurredAt: body.occurredAt ?? new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      schemaVersion: 1,
      rootSagaId: rootSagaId ?? sagaId,
      parentSagaId: parentSagaId || undefined,
      payload: body.payload as T,
    };
  }

  private parseBaggageHeader(baggage: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of baggage.split(",")) {
      const [key, value] = entry.trim().split("=");
      if (key && value) {
        result[key.trim()] = decodeURIComponent(value.trim());
      }
    }
    return result;
  }
}
