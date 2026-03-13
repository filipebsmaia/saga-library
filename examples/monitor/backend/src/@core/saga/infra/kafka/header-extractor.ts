import type { ParsedSagaHeaders } from '../../domain/types/saga-headers.type';
import type { EventHint } from '../../domain/types/event-hint.type';

/**
 * Converts a Buffer or string header value to a string.
 */
function headerToString(value: Buffer | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  return value.toString('utf-8');
}

/**
 * Extracts saga headers from a Kafka message's headers map.
 * Returns null if the message has no saga-id header (not a saga event).
 *
 * Aligns with the header keys produced by @fbsm/saga-core's buildOutboundMessage():
 * saga-id, saga-causation-id, saga-event-id, saga-step-name,
 * saga-published-at, saga-schema-version, saga-root-id, saga-parent-id (optional),
 * saga-event-hint (optional), saga-name (optional), saga-description (optional),
 * saga-step-description (optional)
 */
export function extractSagaHeaders(headers: Record<string, Buffer | string | undefined>): ParsedSagaHeaders | null {
  const sagaId = headerToString(headers['saga-id']);
  if (!sagaId) return null;

  const hint = headerToString(headers['saga-event-hint']);
  const validHints: EventHint[] = ['step', 'compensation', 'final', 'fork'];
  const sagaEventHint = hint && validHints.includes(hint as EventHint) ? (hint as EventHint) : undefined;

  return {
    sagaId,
    sagaRootId: headerToString(headers['saga-root-id']) ?? sagaId,
    sagaParentId: headerToString(headers['saga-parent-id']) || undefined,
    sagaCausationId: headerToString(headers['saga-causation-id']) ?? sagaId,
    sagaEventId: headerToString(headers['saga-event-id']) ?? '',
    sagaStepName: headerToString(headers['saga-step-name']) ?? '',
    sagaStepDescription: headerToString(headers['saga-step-description']) || undefined,
    sagaEventHint,
    sagaName: headerToString(headers['saga-name']) || undefined,
    sagaDescription: headerToString(headers['saga-description']) || undefined,
    sagaPublishedAt: headerToString(headers['saga-published-at']) ?? new Date().toISOString(),
    sagaSchemaVersion: parseInt(headerToString(headers['saga-schema-version']) ?? '1', 10),
  };
}
