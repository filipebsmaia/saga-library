'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTopTypes } from '@/lib/api/sagas';
import type { TopSagaTypeDto } from '@/lib/types/trends';

export function useTopTypes() {
  return useQuery<TopSagaTypeDto[]>({
    queryKey: ['top-types'],
    queryFn: fetchTopTypes,
    refetchInterval: 60_000,
  });
}
