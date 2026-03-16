"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { QueryClient, InfiniteData } from "@tanstack/react-query";
import { useSseStore } from "@/lib/sse/sse-provider";
import { SagaSseMessage } from "@/lib/types/sse";
import { SagaStateDto } from "@/lib/types/saga";
import { CursorPaginationResult } from "@/lib/types/api";

const FLUSH_INTERVAL = 300;
const HIGHLIGHT_DURATION = 3_000;

type SagaPages = InfiniteData<CursorPaginationResult<SagaStateDto>>;

export interface SseInvalidationResult {
  recentlyUpdatedIds: Set<string>;
  newSagasCount: number;
  resetNewCount: () => void;
}

// SSE message may arrive in old format (rootId, stepName) or new enriched format (sagaRootId, currentStepName)
// We handle both transparently.
function getField<T>(
  source: Record<string, unknown>,
  ...keys: string[]
): T | undefined {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return source[key] as T;
    }
  }
  return undefined;
}

function sseToPartialUpdate(message: SagaSseMessage): Partial<SagaStateDto> {
  const raw = message as unknown as Record<string, unknown>;
  return {
    status: message.status,
    currentStepName: getField<string>(raw, "currentStepName", "stepName") ?? "",
    currentStepDescription:
      getField<string>(raw, "currentStepDescription") ?? null,
    lastEventId: message.eventId,
    lastEventHint:
      (getField(
        raw,
        "lastEventHint",
        "eventHint",
      ) as SagaStateDto["lastEventHint"]) ?? null,
    lastTopic: getField<string>(raw, "lastTopic") ?? null,
    updatedAt: message.updatedAt,
    endedAt: getField<string>(raw, "endedAt") ?? null,
    eventCount: getField<number>(raw, "eventCount") ?? undefined,
  };
}

/**
 * Subscribes to SSE store and merges saga updates directly into the
 * React Query cache for sagas already visible in the table.
 *
 * New sagas (not in cache) are NOT added — instead a counter is
 * incremented so the UI can show a "N new sagas" refresh banner.
 */
export function useSseInvalidation(
  queryClient: QueryClient,
): SseInvalidationResult {
  const store = useSseStore();

  const pendingMessages = useRef(new Map<string, SagaSseMessage>());
  const flushTimer = useRef<ReturnType<typeof setTimeout>>();
  const clearTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // External store for highlight set + new sagas counter
  const highlightRef = useRef(new Set<string>());
  const newCountRef = useRef(0);
  const newSeenIdsRef = useRef(new Set<string>());
  const subscribersRef = useRef(new Set<() => void>());

  // Stable snapshot ref — only replaced inside notify/reset to keep
  // useSyncExternalStore from seeing a new object on every getSnapshot call.
  const resetNewCount = useCallback(() => {
    newCountRef.current = 0;
    newSeenIdsRef.current.clear();
    snapshotRef.current = {
      recentlyUpdatedIds: highlightRef.current,
      newSagasCount: 0,
      resetNewCount,
    };
    subscribersRef.current.forEach((callback) => callback());
  }, []);

  const snapshotRef = useRef<SseInvalidationResult>({
    recentlyUpdatedIds: highlightRef.current,
    newSagasCount: 0,
    resetNewCount,
  });

  const notify = useCallback(() => {
    snapshotRef.current = {
      recentlyUpdatedIds: highlightRef.current,
      newSagasCount: newCountRef.current,
      resetNewCount,
    };
    subscribersRef.current.forEach((callback) => callback());
  }, [resetNewCount]);

  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const SERVER_SNAPSHOT: SseInvalidationResult = useMemo(
    () => ({
      recentlyUpdatedIds: new Set<string>(),
      newSagasCount: 0,
      resetNewCount: () => {},
    }),
    [],
  );
  const getServerSnapshot = useCallback(
    () => SERVER_SNAPSHOT,
    [SERVER_SNAPSHOT],
  );

  useEffect(() => {
    if (!store) {
      return;
    }

    const unsubscribe = store.subscribeMessage(() => {
      const message = store.getMessage();
      if (!message) {
        return;
      }

      // Keep only the latest message per sagaId
      pendingMessages.current.set(message.sagaId, message);

      // Schedule flush if not already scheduled
      if (flushTimer.current) {
        return;
      }

      flushTimer.current = setTimeout(() => {
        flushTimer.current = undefined;
        const batch = new Map(pendingMessages.current);
        pendingMessages.current.clear();

        // Merge into React Query cache (only existing sagas)
        const sagaQueries = queryClient.getQueriesData<SagaPages>({
          queryKey: ["sagas"],
        });
        const allExistingIds = new Set<string>();

        for (const [queryKey, pageData] of sagaQueries) {
          if (!pageData?.pages?.length) {
            continue;
          }

          const updatedPages = pageData.pages.map((page) => {
            const items = page?.data;
            if (!Array.isArray(items)) {
              return page;
            }
            return {
              ...page,
              data: items.map((saga) => {
                if (!saga?.sagaId) {
                  return saga;
                }
                allExistingIds.add(saga.sagaId);
                const update = batch.get(saga.sagaId);
                if (!update) {
                  return saga;
                }
                return { ...saga, ...sseToPartialUpdate(update) };
              }),
            };
          });

          queryClient.setQueryData<SagaPages>(queryKey, {
            ...pageData,
            pages: updatedPages,
          });
        }

        // Count new sagas not present in any query cache
        for (const sagaId of batch.keys()) {
          if (
            !allExistingIds.has(sagaId) &&
            !newSeenIdsRef.current.has(sagaId)
          ) {
            newSeenIdsRef.current.add(sagaId);
            newCountRef.current++;
          }
        }

        // Update highlights (only for existing sagas that were updated)
        const updatedIds = new Set<string>();
        for (const sagaId of batch.keys()) {
          if (allExistingIds.has(sagaId)) {
            updatedIds.add(sagaId);
          }
        }

        if (updatedIds.size > 0) {
          highlightRef.current = new Set([
            ...highlightRef.current,
            ...updatedIds,
          ]);
        }
        notify();

        // Clear highlights after duration
        if (updatedIds.size > 0) {
          const highlightTimer = setTimeout(() => {
            const remaining = new Set(highlightRef.current);
            updatedIds.forEach((sagaId) => remaining.delete(sagaId));
            highlightRef.current = remaining;
            notify();
          }, HIGHLIGHT_DURATION);
          clearTimers.current.push(highlightTimer);
        }
      }, FLUSH_INTERVAL);
    });

    return () => {
      unsubscribe();
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }
      clearTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, [store, queryClient, notify]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
