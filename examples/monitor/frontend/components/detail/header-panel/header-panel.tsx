"use client";

import { SagaStateDto } from "@/lib/types/saga";
import { StatusBadge } from "@/components/shared/status-badge/status-badge";
import { CopyButton } from "@/components/shared/copy-button/copy-button";
import { HintBadge } from "@/components/shared/hint-badge/hint-badge";
import { TimestampCell } from "@/components/shared/timestamp-cell/timestamp-cell";
import { formatDuration } from "@/lib/utils/format";
import { Skeleton } from "@/components/shared/skeleton/skeleton";
import { useSsePause } from "@/lib/sse/sse-provider";
import Link from "next/link";
import styles from "./header-panel.module.scss";

interface HeaderPanelProps {
  saga: SagaStateDto;
}

export function HeaderPanel({ saga }: HeaderPanelProps) {
  const elapsed = saga.endedAt
    ? new Date(saga.endedAt).getTime() - new Date(saga.startedAt).getTime()
    : Date.now() - new Date(saga.startedAt).getTime();

  const { paused, setPaused } = useSsePause();

  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <div className={styles.titleRow}>
          <StatusBadge status={saga.status} />
          <h1 className={styles.name}>{saga.sagaName ?? "Unnamed Saga"}</h1>
          {saga.sagaDescription && (
            <span className={styles.description}>{saga.sagaDescription}</span>
          )}
        </div>
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => setPaused(!paused)}
          >
            {paused ? "Resume Stream" : "Pause Stream"}
          </button>
          {saga.sagaRootId !== saga.sagaId && (
            <Link
              href={`/roots/${saga.sagaRootId}`}
              className={styles.actionBtn}
            >
              View Root Tree
            </Link>
          )}
          {saga.sagaRootId === saga.sagaId && (
            <Link
              href={`/roots/${saga.sagaRootId}`}
              className={styles.actionBtn}
            >
              Tree View
            </Link>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.label}>Saga ID</span>
          <CopyButton text={saga.sagaId} displayText={saga.sagaId} />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Root ID</span>
          <CopyButton text={saga.sagaRootId} displayText={saga.sagaRootId} />
        </div>
        {saga.sagaParentId && (
          <div className={styles.field}>
            <span className={styles.label}>Parent ID</span>
            <Link href={`/sagas/${saga.sagaParentId}`} className={styles.link}>
              <CopyButton
                text={saga.sagaParentId}
                displayText={saga.sagaParentId}
              />
            </Link>
          </div>
        )}
        <div className={styles.field}>
          <span className={styles.label}>Current Step</span>
          <span className={styles.value}>{saga.currentStepName}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Last Hint</span>
          <HintBadge hint={saga.lastEventHint} />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Started</span>
          <TimestampCell iso={saga.startedAt} />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Updated</span>
          <TimestampCell iso={saga.updatedAt} />
        </div>
        {saga.endedAt && (
          <div className={styles.field}>
            <span className={styles.label}>Ended</span>
            <TimestampCell iso={saga.endedAt} />
          </div>
        )}
        <div className={styles.field}>
          <span className={styles.label}>Elapsed</span>
          <span className={styles.valueMono}>{formatDuration(elapsed)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Events</span>
          <span className={styles.valueMono}>{saga.eventCount}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Version</span>
          <span className={styles.valueMono}>v{saga.schemaVersion}</span>
        </div>
      </div>
    </div>
  );
}

export function HeaderPanelLoading() {
  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <div className={styles.titleRow}>
          <Skeleton variant="badge" width="100px" />
          <Skeleton variant="line" width="200px" height="24px" />
        </div>
      </div>
      <div className={styles.grid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles.field}>
            <Skeleton variant="line" width="60px" height="12px" />
            <Skeleton variant="line" width="120px" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
