import { SagaEventDto, SagaStateDto, SagaStatus } from "@/lib/types/saga";
import { WaterfallSpan, WaterfallTrack } from "@/lib/types/waterfall";

/**
 * Converts saga events and tree into waterfall spans.
 *
 * Heuristics:
 * - Span duration = gap between consecutive events in the same saga.
 * - First event's span starts at saga.startedAt.
 * - If saga is RUNNING, last span is open-ended (now - lastEvent.publishedAt), marked estimated.
 * - If saga is COMPLETED, last span ends at saga.endedAt.
 * - Gaps > 60s are capped at 60s visually and marked estimated.
 */
export function eventsToWaterfallSpans(
  allEvents: SagaEventDto[],
  treeSagas: SagaStateDto[],
): { tracks: WaterfallTrack[]; spans: WaterfallSpan[] } {
  if (allEvents.length === 0 || treeSagas.length === 0) {
    return { tracks: [], spans: [] };
  }

  // Find the root saga (earliest startedAt)
  const sortedSagas = [...treeSagas].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  const rootStart = new Date(sortedSagas[0].startedAt).getTime();

  // Build saga depth map
  const depthMap = new Map<string, number>();
  const rootSaga =
    sortedSagas.find((s) => s.sagaId === s.sagaRootId) ?? sortedSagas[0];
  function computeDepth(sagaId: string, depth: number) {
    depthMap.set(sagaId, depth);
    for (const s of sortedSagas) {
      if (s.sagaParentId === sagaId && s.sagaId !== sagaId) {
        computeDepth(s.sagaId, depth + 1);
      }
    }
  }
  computeDepth(rootSaga.sagaId, 0);

  // Group events by sagaId, deduplicating by sagaEventId
  const seenEventIds = new Set<string>();
  const eventsBySaga = new Map<string, SagaEventDto[]>();
  for (const event of allEvents) {
    if (seenEventIds.has(event.sagaEventId)) continue;
    seenEventIds.add(event.sagaEventId);
    const list = eventsBySaga.get(event.sagaId) ?? [];
    list.push(event);
    eventsBySaga.set(event.sagaId, list);
  }

  // Sort events within each saga by publishedAt
  for (const [, events] of eventsBySaga) {
    events.sort(
      (a, b) =>
        new Date(a.sagaPublishedAt).getTime() -
        new Date(b.sagaPublishedAt).getTime(),
    );
  }

  // Build tracks (ordered by depth then start time)
  const tracks: WaterfallTrack[] = sortedSagas.map((saga) => ({
    trackId: saga.sagaId,
    label: saga.sagaName ?? saga.sagaId.slice(0, 8),
    sagaId: saga.sagaId,
    depth: depthMap.get(saga.sagaId) ?? 0,
  }));

  // Build spans
  const spans: WaterfallSpan[] = [];
  const sagaMap = new Map(treeSagas.map((s) => [s.sagaId, s]));
  const now = Date.now();

  // Pre-compute each saga's total duration for percentage calculation
  const sagaDurations = new Map<string, number>();
  for (const saga of treeSagas) {
    const sagaStart = new Date(saga.startedAt).getTime();
    const sagaEnd = saga.endedAt ? new Date(saga.endedAt).getTime() : now;
    sagaDurations.set(saga.sagaId, Math.max(sagaEnd - sagaStart, 1));
  }

  for (const [sagaId, events] of eventsBySaga) {
    const saga = sagaMap.get(sagaId);
    if (!saga || events.length === 0) continue;

    const trackLabel = saga.sagaName ?? sagaId.slice(0, 8);
    const sagaTotalMs = sagaDurations.get(sagaId) ?? 1;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventTime = new Date(event.sagaPublishedAt).getTime();

      // Span start: this event's time
      const startMs = eventTime - rootStart;

      // Span end: next event's time, or saga end, or now
      let endMs: number;
      let estimated = false;

      if (i < events.length - 1) {
        endMs = new Date(events[i + 1].sagaPublishedAt).getTime() - rootStart;
      } else if (saga.status === SagaStatus.COMPLETED && saga.endedAt) {
        endMs = new Date(saga.endedAt).getTime() - rootStart;
      } else {
        endMs = now - rootStart;
        estimated = true;
      }

      let durationMs = Math.max(endMs - startMs, 1);

      // Cap very large gaps
      if (durationMs > 60_000) {
        durationMs = 60_000;
        estimated = true;
      }

      spans.push({
        id: event.sagaEventId,
        sagaId,
        trackId: sagaId,
        trackLabel,
        label: event.sagaStepName,
        hint: event.sagaEventHint,
        status: event.statusAfter,
        statusBefore: event.statusBefore,
        startMs,
        durationMs,
        estimated,
        stepDescription: event.sagaStepDescription,
        percentage: (durationMs / sagaTotalMs) * 100,
        sagaName: saga.sagaName,
        topic: event.topic,
        causationId: event.sagaCausationId,
      });
    }
  }

  return { tracks, spans };
}
