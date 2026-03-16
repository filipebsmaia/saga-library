"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSagaPredictions } from "@/lib/api/sagas";
import { SagaStatus } from "@/lib/types/saga";

export function useSagaPredictions(sagaId: string, status?: SagaStatus) {
  return useQuery({
    queryKey: ["saga-predictions", sagaId],
    queryFn: () => fetchSagaPredictions(sagaId),
    enabled: !!sagaId && status !== SagaStatus.COMPLETED,
    staleTime: 30_000,
  });
}
