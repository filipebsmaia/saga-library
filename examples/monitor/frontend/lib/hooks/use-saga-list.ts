"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchSagas } from "@/lib/api/sagas";
import { ListSagasParams } from "@/lib/types/api";

export function useSagaList(params: Omit<ListSagasParams, "cursor"> = {}) {
  return useInfiniteQuery({
    queryKey: ["sagas", params],
    queryFn: ({ pageParam }) => fetchSagas({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
