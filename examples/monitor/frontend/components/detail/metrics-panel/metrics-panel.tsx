'use client';

import { useSagaMetrics } from '@/lib/hooks/use-saga-metrics';
import { SagaStatus } from '@/lib/types/saga';
import { formatDuration, cn } from '@/lib/utils/format';
import { Skeleton } from '@/components/shared/skeleton/skeleton';
import styles from './metrics-panel.module.scss';

interface MetricsPanelProps {
  sagaId: string;
}

export function MetricsPanel({ sagaId }: MetricsPanelProps) {
  const { data: metrics, isLoading } = useSagaMetrics(sagaId);

  if (isLoading || !metrics) return <MetricsPanelLoading />;

  const items = [
    { label: 'Elapsed', value: formatDuration(metrics.elapsedMs) },
    { label: 'Total Duration', value: metrics.totalDurationMs ? formatDuration(metrics.totalDurationMs) : '—' },
    { label: 'Last Update', value: formatDuration(metrics.lastUpdateAgoMs) + ' ago' },
    { label: 'Total Events', value: String(metrics.totalEvents) },
    { label: 'Compensations', value: String(metrics.compensationCount), highlight: metrics.compensationCount > 0 },
    { label: 'Forks', value: String(metrics.forkCount) },
    { label: 'Child Sagas', value: String(metrics.childSagaCount) },
    {
      label: 'Stuck',
      value: metrics.isStuck ? 'YES' : 'No',
      highlight: metrics.isStuck,
      danger: metrics.isStuck,
    },
  ];

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Execution Metrics</h3>
      <div className={styles.list}>
        {items.map((item) => (
          <div key={item.label} className={styles.item}>
            <span className={styles.label}>{item.label}</span>
            <span
              className={cn(
                styles.value,
                item.highlight && styles.highlight,
                item.danger && styles.danger,
              )}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsPanelLoading() {
  return (
    <div className={styles.panel}>
      <Skeleton variant="line" width="130px" height="16px" />
      <div className={styles.list}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.item}>
            <Skeleton variant="line" width="70px" height="12px" />
            <Skeleton variant="line" width="50px" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
