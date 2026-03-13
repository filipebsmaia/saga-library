'use client';

import { useState, useEffect } from 'react';
import { formatRelativeTime, formatTimestamp } from '@/lib/utils/format';
import styles from './timestamp-cell.module.scss';

interface TimestampCellProps {
  iso: string;
  refreshInterval?: number;
}

export function TimestampCell({ iso, refreshInterval = 5000 }: TimestampCellProps) {
  const [relative, setRelative] = useState(() => formatRelativeTime(iso));

  useEffect(() => {
    setRelative(formatRelativeTime(iso));
    const interval = setInterval(() => setRelative(formatRelativeTime(iso)), refreshInterval);
    return () => clearInterval(interval);
  }, [iso, refreshInterval]);

  return (
    <span className={styles.cell} title={formatTimestamp(iso)}>
      {relative}
    </span>
  );
}
