'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '@/lib/api/sagas';
import { DashboardStatsDto } from '@/lib/types/saga';

export function useDashboardStats() {
  return useQuery<DashboardStatsDto>({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30_000,
  });
}
