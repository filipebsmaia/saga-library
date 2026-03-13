'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSagaMetrics } from '@/lib/api/sagas';

export function useSagaMetrics(sagaId: string) {
  return useQuery({
    queryKey: ['saga-metrics', sagaId],
    queryFn: () => fetchSagaMetrics(sagaId),
    enabled: !!sagaId,
    refetchInterval: 10_000,
  });
}
