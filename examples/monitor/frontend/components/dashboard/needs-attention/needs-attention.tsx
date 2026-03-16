"use client";

import { useState } from "react";
import Link from "next/link";
import { useAttentionItems } from "@/lib/hooks/use-attention-items";
import { AttentionItemDto, AttentionReason } from "@/lib/types/saga";
import { StatusBadge } from "@/components/shared/status-badge/status-badge";
import { truncateId, formatRelativeTime, cn } from "@/lib/utils/format";
import { Skeleton } from "@/components/shared/skeleton/skeleton";
import styles from "./needs-attention.module.scss";

const COLLAPSED_LIMIT = 5;

const REASON_LABELS: Record<AttentionReason, string> = {
  stuck: "Stuck",
  compensating: "Compensating",
  many_children: "Many Children",
};

export function NeedsAttention() {
  const { data, isLoading } = useAttentionItems();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <NeedsAttentionLoading />;
  if (!data?.items.length) return null;

  const visible = expanded ? data.items : data.items.slice(0, COLLAPSED_LIMIT);
  const hasMore = data.items.length > COLLAPSED_LIMIT;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Needs Attention</h2>
      <ul className={styles.list}>
        {visible.map((item) => (
          <AttentionRow key={item.sagaId} item={item} />
        ))}
      </ul>
      {hasMore && (
        <button
          className={styles.showAll}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show all (${data.items.length})`}
        </button>
      )}
    </section>
  );
}

function AttentionRow({ item }: { item: AttentionItemDto }) {
  return (
    <li className={styles.row}>
      <Link href={`/sagas/${item.sagaId}`} className={styles.rowLink}>
        <StatusBadge status={item.status} size="sm" />
        <span className={styles.name}>
          {item.sagaName ?? truncateId(item.sagaId)}
        </span>
        <span className={styles.step}>{item.currentStepName}</span>
        <span className={cn(styles.reason, styles[item.reason])}>
          {REASON_LABELS[item.reason]}
        </span>
        <span className={styles.detail}>{item.detail}</span>
        <span className={styles.time}>
          {formatRelativeTime(item.updatedAt)}
        </span>
      </Link>
    </li>
  );
}

function NeedsAttentionLoading() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Needs Attention</h2>
      <div className={styles.list}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton variant="badge" width="60px" />
            <Skeleton variant="line" width="120px" height="14px" />
            <Skeleton variant="line" width="80px" height="14px" />
            <Skeleton variant="badge" width="70px" />
          </div>
        ))}
      </div>
    </section>
  );
}
