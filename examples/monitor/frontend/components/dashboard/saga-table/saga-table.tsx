"use client";

import { memo } from "react";
import { SagaStateDto, SagaStatus } from "@/lib/types/saga";
import { StatusBadge } from "@/components/shared/status-badge/status-badge";
import { CopyButton } from "@/components/shared/copy-button/copy-button";
import { HintBadge } from "@/components/shared/hint-badge/hint-badge";
import { TimestampCell } from "@/components/shared/timestamp-cell/timestamp-cell";
import { formatDuration, truncateId, cn } from "@/lib/utils/format";
import Link from "next/link";
import styles from "./saga-table.module.scss";

interface SagaTableProps {
  sagas: SagaStateDto[];
  recentlyUpdatedIds?: Set<string>;
  incidentMode?: boolean;
}

const STUCK_THRESHOLD = 300_000;

interface SagaRowProps {
  saga: SagaStateDto;
  isLive: boolean;
  incidentMode: boolean;
}

const SagaRow = memo(function SagaRow({
  saga,
  isLive,
  incidentMode,
}: SagaRowProps) {
  const isStuck =
    saga.status !== SagaStatus.COMPLETED &&
    Date.now() - new Date(saga.updatedAt).getTime() > STUCK_THRESHOLD;
  const elapsed = saga.endedAt
    ? new Date(saga.endedAt).getTime() - new Date(saga.startedAt).getTime()
    : Date.now() - new Date(saga.startedAt).getTime();
  const isRoot = saga.sagaRootId === saga.sagaId;

  return (
    <Link
      href={`/sagas/${saga.sagaId}`}
      className={cn(
        styles.row,
        styles.dataRow,
        isLive && styles.live,
        incidentMode && isStuck && styles.incidentStuck,
        incidentMode &&
          saga.status === SagaStatus.COMPENSATING &&
          !isStuck &&
          styles.incidentCompensating,
      )}
    >
      <span>
        <StatusBadge status={saga.status} size="sm" />
      </span>
      <span className={styles.name}>
        {saga.sagaName ?? truncateId(saga.sagaId)}
      </span>
      <span>
        <CopyButton text={saga.sagaId} displayText={truncateId(saga.sagaId)} />
      </span>
      <span>
        {isRoot ? (
          <span className={styles.rootSelf}>—</span>
        ) : (
          <CopyButton
            text={saga.sagaRootId}
            displayText={truncateId(saga.sagaRootId)}
          />
        )}
      </span>
      <span className={styles.step}>{saga.currentStepName}</span>
      <span>
        <HintBadge hint={saga.lastEventHint} />
      </span>
      <span className={styles.topic}>{saga.lastTopic ?? "—"}</span>
      <span>
        <TimestampCell iso={saga.updatedAt} />
      </span>
      <span className={styles.duration}>{formatDuration(elapsed)}</span>
      <span className={styles.events}>{saga.eventCount}</span>
      <span>
        <span
          className={cn(
            styles.topologyBadge,
            isRoot ? styles.rootBadge : styles.childBadge,
          )}
        >
          {isRoot ? "ROOT" : "CHILD"}
        </span>
      </span>
      <span className={styles.indicators}>
        {isStuck && (
          <span className={styles.stuckBadge} title="Possibly stuck">
            stuck
          </span>
        )}
        {saga.status === SagaStatus.COMPENSATING && (
          <span className={styles.compensatingBadge} title="Compensating">
            comp
          </span>
        )}
      </span>
    </Link>
  );
});

export function SagaTable({
  sagas,
  recentlyUpdatedIds,
  incidentMode,
}: SagaTableProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.table}>
        <div className={cn(styles.row, styles.header)}>
          <span>Status</span>
          <span>Saga Name</span>
          <span>Saga ID</span>
          <span>Root ID</span>
          <span>Step</span>
          <span>Hint</span>
          <span>Topic</span>
          <span>Updated</span>
          <span>Duration</span>
          <span>Events</span>
          <span>Topology</span>
          <span>Indicators</span>
        </div>
        {sagas.map((saga) => (
          <SagaRow
            key={saga.sagaId}
            saga={saga}
            isLive={recentlyUpdatedIds?.has(saga.sagaId) ?? false}
            incidentMode={incidentMode ?? false}
          />
        ))}
      </div>
    </div>
  );
}

export function SagaTableLoading() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.table}>
        <div className={cn(styles.row, styles.header)}>
          <span>Status</span>
          <span>Saga Name</span>
          <span>Saga ID</span>
          <span>Root ID</span>
          <span>Step</span>
          <span>Hint</span>
          <span>Topic</span>
          <span>Updated</span>
          <span>Duration</span>
          <span>Events</span>
          <span>Topology</span>
          <span>Indicators</span>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={cn(styles.row, styles.skeletonRow)}>
            {Array.from({ length: 12 }).map((_, j) => (
              <span key={j} className={styles.skeletonCell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SagaTableEmpty() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>∅</span>
      <p>No sagas found matching your filters</p>
    </div>
  );
}
