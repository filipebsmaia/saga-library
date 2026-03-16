"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchSagaEvents } from "@/lib/api/sagas";
import { SagaEventDto } from "@/lib/types/saga";
import { useMemo } from "react";

/**
 * Fetches events for all sagas in a tree (all sagaIds),
 * returning a single flat array of all events.
 */
export function useTreeEvents(sagaIds: string[]) {
  const queries = useQueries({
    queries: sagaIds.map((id) => ({
      queryKey: ["saga-events-all", id],
      queryFn: async () => {
        const allEvents: SagaEventDto[] = [];
        let cursor: string | undefined;
        // Fetch all pages for this saga
        do {
          const page = await fetchSagaEvents(id, { cursor, limit: 100 });
          allEvents.push(...page.data);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        return allEvents;
      },
      enabled: sagaIds.length > 0,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const allEvents = useMemo(
    () => queries.flatMap((q) => q.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queries.map((q) => q.dataUpdatedAt).join(",")],
  );

  return { data: allEvents, isLoading };
}
