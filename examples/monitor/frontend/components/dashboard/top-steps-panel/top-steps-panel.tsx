"use client";

import { useTopSteps } from "@/lib/hooks/use-top-steps";
import { Skeleton } from "@/components/shared/skeleton/skeleton";
import { formatDuration } from "@/lib/utils/format";
import styles from "./top-steps-panel.module.scss";

interface TopStepsPanelProps {
  onStepClick?: (stepName: string) => void;
}

export function TopStepsPanel({ onStepClick }: TopStepsPanelProps) {
  const { data, isLoading } = useTopSteps();

  if (isLoading) return <TopStepsSkeleton />;
  if (!data || data.length === 0) return null;

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Slowest Steps</h3>
      <div className={styles.list}>
        {data.map((step) => (
          <button
            key={`${step.stepName}-${step.sagaName}`}
            className={styles.item}
            onClick={() => onStepClick?.(step.stepName)}
          >
            <div className={styles.itemMain}>
              <span className={styles.stepName}>{step.stepName}</span>
              {step.sagaName && (
                <span className={styles.sagaName}>{step.sagaName}</span>
              )}
            </div>
            <div className={styles.itemStats}>
              <span className={styles.count}>{step.count}x</span>
              <span className={styles.duration}>
                avg {formatDuration(step.avgDurationMs)}
              </span>
              <span className={styles.p95}>
                p95 {formatDuration(step.p95DurationMs)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TopStepsSkeleton() {
  return (
    <section className={styles.section}>
      <Skeleton variant="line" width="100px" height="14px" />
      <div className={styles.list}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div className={styles.skeletonItem} key={i}>
            <Skeleton variant="line" width="60%" height="13px" />
            <Skeleton variant="line" width="40%" height="11px" />
          </div>
        ))}
      </div>
    </section>
  );
}
