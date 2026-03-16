"use client";

import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { cn } from "@/lib/utils/format";
import styles from "./metrics-cards.module.scss";

export function MetricsCards() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading || !stats) return <MetricsCardsLoading />;

  return (
    <div className={styles.grid}>
      <div className={cn(styles.card, styles.running)}>
        <span className={styles.value}>{stats.running}</span>
        <span className={styles.label}>Running</span>
      </div>
      <div className={cn(styles.card, styles.compensating)}>
        <span className={styles.value}>{stats.compensatingRecent}</span>
        <span className={styles.label}>Compensating (5m)</span>
      </div>
      <div
        className={cn(
          styles.card,
          styles.stuck,
          stats.stuck > 0 && styles.stuckActive,
        )}
      >
        <span className={styles.value}>{stats.stuck}</span>
        <span className={styles.label}>Stuck</span>
      </div>
      <div className={cn(styles.card, styles.events)}>
        <span className={styles.value}>{stats.eventsPerMinute}</span>
        <span className={styles.label}>Events/min</span>
      </div>
      <div className={cn(styles.card, styles.completed)}>
        <span className={styles.value}>{stats.completed.toLocaleString()}</span>
        <span className={styles.label}>Completed</span>
      </div>
    </div>
  );
}

export function MetricsCardsLoading() {
  return (
    <div className={styles.grid}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn(styles.card, styles.skeleton)}>
          <span className={styles.skeletonValue} />
          <span className={styles.skeletonLabel} />
        </div>
      ))}
    </div>
  );
}
