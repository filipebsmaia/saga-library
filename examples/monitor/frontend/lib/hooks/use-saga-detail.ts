"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSagaDetail } from "@/lib/api/sagas";

export function useSagaDetail(sagaId: string) {
  return useQuery({
    queryKey: ["saga", sagaId],
    queryFn: () => fetchSagaDetail(sagaId),
    enabled: !!sagaId,
  });
}
