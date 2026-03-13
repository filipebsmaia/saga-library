'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSagaList } from '@/lib/hooks/use-saga-list';
import { useSseStatus } from '@/lib/sse/sse-provider';
import { useSseInvalidation } from '@/lib/hooks/use-sse-invalidation';
import { SagaFilters, SagaFilterValues } from '@/components/dashboard/saga-filters/saga-filters';
import { SagaTable, SagaTableLoading, SagaTableEmpty } from '@/components/dashboard/saga-table/saga-table';
import { PaginationLoader } from '@/components/shared/pagination-loader/pagination-loader';
import { SagaStateDto, SagaStatus } from '@/lib/types/saga';
import { CursorPaginationResult } from '@/lib/types/api';
import styles from './live-saga-table.module.scss';

const STUCK_THRESHOLD = 300_000;

interface LiveSagaTableProps {
  initialData?: CursorPaginationResult<SagaStateDto>;
}

export function LiveSagaTable({ initialData }: LiveSagaTableProps) {
  const [filters, setFilters] = useState<SagaFilterValues>({});
  const queryClient = useQueryClient();
  const { status: sseStatus } = useSseStatus();

  // SSE: update existing sagas in-place + count new unseen sagas
  const { recentlyUpdatedIds, newSagasCount, resetNewCount } = useSseInvalidation(queryClient);

  const queryParams = useMemo(
    () => ({
      status: filters.status,
      sagaName: filters.sagaName,
      sagaRootId: filters.searchId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      rootsOnly: filters.quickFilters?.rootsOnly || undefined,
      activeOnly: filters.quickFilters?.activeOnly || filters.quickFilters?.incidentMode || undefined,
      compensating: filters.quickFilters?.compensating || undefined,
      stuck: filters.quickFilters?.stuck || undefined,
    }),
    [filters],
  );

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSagaList(queryParams);

  // Fallback: refetch when SSE is disconnected
  useEffect(() => {
    if (sseStatus !== 'disconnected') {
      return;
    }
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['sagas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['attention-items'] });
    }, 10_000);
    return () => clearInterval(interval);
  }, [sseStatus, queryClient]);

  const allSagas = useMemo(() => {
    if (data) {
      return data.pages.flatMap((page) => page.data);
    }
    if (initialData) {
      return initialData.data;
    }
    return [];
  }, [data, initialData]);

  // Client-side: recentOnly (time-based) + incident mode sorting
  // Server-side: rootsOnly, activeOnly, compensating, stuck
  const filteredSagas = useMemo(() => {
    let result = allSagas;
    const quickFilters = filters.quickFilters;
    if (!quickFilters) {
      return result;
    }
    const now = Date.now();

    if (quickFilters.recentOnly) {
      result = result.filter((saga) => now - new Date(saga.updatedAt).getTime() < 60_000);
    }

    // Incident mode: sort by priority (stuck first, then compensating, then running)
    if (quickFilters.incidentMode) {
      result = [...result].sort((a, b) => {
        const priority = (saga: SagaStateDto) => {
          const isStuck = saga.status !== SagaStatus.COMPLETED && now - new Date(saga.updatedAt).getTime() > STUCK_THRESHOLD;
          if (isStuck) {
            return 0;
          }
          if (saga.status === SagaStatus.COMPENSATING) {
            return 1;
          }
          return 2;
        };
        return priority(a) - priority(b);
      });
    }

    return result;
  }, [allSagas, filters.quickFilters]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const incidentMode = filters.quickFilters?.incidentMode ?? false;

  const handleRefresh = useCallback(() => {
    resetNewCount();
    queryClient.resetQueries({ queryKey: ['sagas'] });
  }, [resetNewCount, queryClient]);

  return (
    <>
      <SagaFilters values={filters} onChange={setFilters} />

      {newSagasCount > 0 && (
        <button className={styles.refreshBanner} onClick={handleRefresh}>
          {newSagasCount} new saga{newSagasCount !== 1 ? 's' : ''} — Click to refresh
        </button>
      )}

      {isLoading && !initialData ? (
        <SagaTableLoading />
      ) : filteredSagas.length === 0 ? (
        <SagaTableEmpty />
      ) : (
        <>
          <SagaTable sagas={filteredSagas} recentlyUpdatedIds={recentlyUpdatedIds} incidentMode={incidentMode} />
          <PaginationLoader
            onLoadMore={handleLoadMore}
            hasMore={hasNextPage ?? false}
            isLoading={isFetchingNextPage}
          />
        </>
      )}
    </>
  );
}
