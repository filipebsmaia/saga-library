"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchSagaEvents } from "@/lib/api/sagas";

export function useSagaEvents(sagaId: string, limit: number = 50) {
  return useInfiniteQuery({
    queryKey: ["saga-events", sagaId],
    queryFn: ({ pageParam }) =>
      fetchSagaEvents(sagaId, { cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!sagaId,
  });
}
