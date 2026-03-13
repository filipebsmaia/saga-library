'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSagaDetail } from '@/lib/hooks/use-saga-detail';
import { useSagaEvents } from '@/lib/hooks/use-saga-events';
import { useSagaTree } from '@/lib/hooks/use-saga-tree';
import { useTreeEvents } from '@/lib/hooks/use-tree-events';
import { filterSubtree } from '@/lib/transformers/filter-subtree';
import { useSagaDetailStream } from '@/lib/sse/use-saga-detail-stream';
import { useSagaPredictions } from '@/lib/hooks/use-saga-predictions';
import { HeaderPanel, HeaderPanelLoading } from '@/components/detail/header-panel/header-panel';
import { Timeline, TimelineLoading, TimelineEmpty } from '@/components/detail/timeline/timeline';
import { MetricsPanel, MetricsPanelLoading } from '@/components/detail/metrics-panel/metrics-panel';
import { TreeView, TreeViewLoading } from '@/components/detail/tree-view/tree-view';
import { PaginationLoader } from '@/components/shared/pagination-loader/pagination-loader';
import { CausalChain } from '@/components/detail/causal-chain/causal-chain';
import { WaterfallSection } from '@/components/visualizations/waterfall/waterfall-section';

import styles from './live-detail.module.scss';

interface LiveDetailProps {
  sagaId: string;
}

export function LiveDetail({ sagaId }: LiveDetailProps) {
  const { data: saga, isLoading: sagaLoading } = useSagaDetail(sagaId);
  const {
    data: eventsData,
    isLoading: eventsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSagaEvents(sagaId);

  const { data: treeSagas } = useSagaTree(saga?.sagaRootId ?? '');
  const subtree = useMemo(
    () => filterSubtree(treeSagas ?? [], sagaId),
    [treeSagas, sagaId],
  );
  const subtreeIds = useMemo(() => subtree.map((s) => s.sagaId), [subtree]);
  const { data: treeEvents } = useTreeEvents(subtreeIds);

  const { recentEventIds } = useSagaDetailStream({ sagaId });
  const { data: predictions } = useSagaPredictions(sagaId, saga?.status);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();

  const allEvents = useMemo(
    () => eventsData?.pages.flatMap((p) => p.data) ?? [],
    [eventsData],
  );

  // All events from the subtree, sorted chronologically
  const allTreeEvents = useMemo(() => {
    if (treeEvents.length === 0) return allEvents;
    const deduped = new Map<string, typeof treeEvents[0]>();
    for (const e of treeEvents) deduped.set(e.sagaEventId, e);
    return [...deduped.values()].sort(
      (a, b) => new Date(a.sagaPublishedAt).getTime() - new Date(b.sagaPublishedAt).getTime(),
    );
  }, [treeEvents, allEvents]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className={styles.layout}>
      {sagaLoading || !saga ? (
        <HeaderPanelLoading />
      ) : (
        <HeaderPanel saga={saga} />
      )}

      <div className={styles.body}>
        <div className={styles.main}>
          <h2 className={styles.sectionTitle}>Event Timeline</h2>
          {eventsLoading ? (
            <TimelineLoading />
          ) : allEvents.length === 0 ? (
            <TimelineEmpty />
          ) : (
            <>
              <Timeline
                events={allTreeEvents}
                recentEventIds={recentEventIds}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
                predictions={predictions}
              />
              <PaginationLoader
                onLoadMore={handleLoadMore}
                hasMore={hasNextPage ?? false}
                isLoading={isFetchingNextPage}
              />
            </>
          )}

          {selectedEventId && allEvents.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Causal Chain</h2>
              <CausalChain events={allEvents} selectedEventId={selectedEventId} />
            </div>
          )}

          {saga && (
            <>
              <WaterfallSection sagaId={sagaId} rootId={saga.sagaRootId} />
            </>
          )}
        </div>

        <aside className={styles.sidebar}>
          {saga ? (
            <>
              <MetricsPanel sagaId={sagaId} />
              <TreeView rootId={saga.sagaRootId} currentSagaId={sagaId} />
            </>
          ) : (
            <>
              <MetricsPanelLoading />
              <TreeViewLoading />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
