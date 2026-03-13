'use client';

import { useState, useMemo, lazy, Suspense } from 'react';
import { useSagaTree } from '@/lib/hooks/use-saga-tree';
import { useTreeEvents } from '@/lib/hooks/use-tree-events';
import { eventsToWaterfallSpans } from '@/lib/transformers/waterfall';
import { filterSubtree } from '@/lib/transformers/filter-subtree';
import { WaterfallLoading } from './waterfall-chart';
import styles from './waterfall-section.module.scss';

const WaterfallChart = lazy(() =>
  import('./waterfall-chart').then((m) => ({ default: m.WaterfallChart })),
);

interface WaterfallSectionProps {
  sagaId: string;
  rootId: string;
}

export function WaterfallSection({ sagaId, rootId }: WaterfallSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: treeSagas } = useSagaTree(rootId);

  const subtree = useMemo(
    () => filterSubtree(treeSagas ?? [], sagaId),
    [treeSagas, sagaId],
  );

  const sagaIds = useMemo(
    () => subtree.map((s) => s.sagaId),
    [subtree],
  );
  const { data: allEvents } = useTreeEvents(expanded ? sagaIds : []);

  const { tracks, spans } = useMemo(
    () => eventsToWaterfallSpans(allEvents, subtree),
    [allEvents, subtree],
  );

  return (
    <div className={styles.section}>
      <button className={styles.toggle} onClick={() => setExpanded(!expanded)}>
        <span className={styles.chevron}>{expanded ? '▾' : '▸'}</span>
        Span Waterfall
        {spans.length > 0 && (
          <span className={styles.count}>{spans.length} spans</span>
        )}
      </button>

      {expanded && (
        <Suspense fallback={<WaterfallLoading />}>
          {spans.length > 0 ? (
            <WaterfallChart tracks={tracks} spans={spans} />
          ) : (
            <div className={styles.empty}>No span data available</div>
          )}
        </Suspense>
      )}
    </div>
  );
}
