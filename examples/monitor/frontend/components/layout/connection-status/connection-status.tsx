"use client";

import { useSseStatus, useSseReconnect } from "@/lib/sse/sse-provider";
import { formatRelativeTime } from "@/lib/utils/format";
import styles from "./connection-status.module.scss";
import { cn } from "@/lib/utils/format";

export function ConnectionStatus() {
  const { status, lastEventAt, lastPublishedAt } = useSseStatus();
  const reconnect = useSseReconnect();

  const labels = {
    connected: "Connected",
    reconnecting: "Reconnecting...",
    disconnected: "Disconnected",
  };

  const lag =
    lastPublishedAt && status === "connected"
      ? Math.max(0, Date.now() - new Date(lastPublishedAt).getTime())
      : null;

  return (
    <div
      className={cn(styles.container, styles[status])}
      title={`SSE: ${status}`}
    >
      <span className={styles.dot} />
      <span className={styles.label}>{labels[status]}</span>
      {lastEventAt && status === "connected" && (
        <span className={styles.lastEvent}>
          Last event {formatRelativeTime(lastEventAt.toISOString())}
        </span>
      )}
      {lag !== null && (
        <span className={styles.lag}>
          Lag: {lag < 1000 ? `${lag}ms` : `${(lag / 1000).toFixed(1)}s`}
        </span>
      )}
      {status === "disconnected" && (
        <button className={styles.reconnectBtn} onClick={reconnect}>
          Reconnect
        </button>
      )}
    </div>
  );
}
