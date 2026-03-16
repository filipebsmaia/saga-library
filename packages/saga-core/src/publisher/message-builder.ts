import type { SagaEvent } from "../interfaces/saga-event.interface";
import type { OutboundMessage } from "../transport/transport.interface";

export function buildOutboundMessage<T>(
  event: SagaEvent<T>,
  topicPrefix = "",
): OutboundMessage {
  const topic = `${topicPrefix}${event.eventType}`;
  const key = event.key ?? event.rootSagaId;

  const headers: Record<string, string> = {
    "saga-id": event.sagaId,
    "saga-causation-id": event.causationId,
    "saga-event-id": event.eventId,
    "saga-step-name": event.stepName,
    "saga-published-at": event.publishedAt,
    "saga-schema-version": String(event.schemaVersion),
    "saga-root-id": event.rootSagaId,
  };

  if (event.parentSagaId) {
    headers["saga-parent-id"] = event.parentSagaId;
  }

  if (event.hint) {
    headers["saga-event-hint"] = event.hint;
  }

  if (event.sagaName) {
    headers["saga-name"] = event.sagaName;
  }

  if (event.sagaDescription) {
    headers["saga-description"] = event.sagaDescription;
  }

  if (event.stepDescription) {
    headers["saga-step-description"] = event.stepDescription;
  }

  if (event.key) {
    headers["saga-key"] = event.key;
  }

  const value = JSON.stringify({
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    payload: event.payload,
  });

  return { topic, key, value, headers };
}
