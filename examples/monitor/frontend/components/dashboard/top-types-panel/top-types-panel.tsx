"use client";

import { useTopTypes } from "@/lib/hooks/use-top-types";
import { Skeleton } from "@/components/shared/skeleton/skeleton";
import { formatDuration } from "@/lib/utils/format";
import styles from "./top-types-panel.module.scss";

interface TopTypesPanelProps {
  onTypeClick?: (sagaName: string) => void;
}

export function TopTypesPanel({ onTypeClick }: TopTypesPanelProps) {
  const { data, isLoading } = useTopTypes();

  if (isLoading) return <TopTypesSkeleton />;
  if (!data || data.length === 0) return null;

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Top Saga Types</h3>
      <div className={styles.list}>
        {data.map((type) => (
          <button
            key={type.sagaName}
            className={styles.item}
            onClick={() => onTypeClick?.(type.sagaName)}
          >
            <div className={styles.itemMain}>
              <span className={styles.sagaName}>{type.sagaName}</span>
              <span className={styles.volume}>{type.volume}</span>
            </div>
            <div className={styles.itemStats}>
              <span className={styles.duration}>
                avg {formatDuration(type.avgDurationMs)}
              </span>
              {type.compensationRatio > 0 && (
                <div className={styles.ratioBar}>
                  <div
                    className={styles.ratioFill}
                    style={{
                      width: `${Math.min(type.compensationRatio * 100, 100)}%`,
                    }}
                  />
                  <span className={styles.ratioLabel}>
                    {Math.round(type.compensationRatio * 100)}% comp
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function TopTypesSkeleton() {
  return (
    <section className={styles.section}>
      <Skeleton variant="line" width="110px" height="14px" />
      <div className={styles.list}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div className={styles.skeletonItem} key={i}>
            <Skeleton variant="line" width="70%" height="13px" />
            <Skeleton variant="line" width="50%" height="11px" />
          </div>
        ))}
      </div>
    </section>
  );
}
