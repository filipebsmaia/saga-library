"use client";

import { SagaStatus } from "@/lib/types/saga";
import styles from "./status-badge.module.scss";
import { cn } from "@/lib/utils/format";

interface StatusBadgeProps {
  status: SagaStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        styles.badge,
        styles[status.toLowerCase()],
        size === "sm" && styles.sm,
      )}
      aria-label={`Status: ${status}`}
    >
      <span className={styles.dot} />
      {status}
    </span>
  );
}
