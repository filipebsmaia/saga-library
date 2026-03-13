'use client';

import Link from 'next/link';
import { useEventBuffer } from '@/lib/hooks/use-event-buffer';
import { useSsePause } from '@/lib/sse/sse-provider';
import { StatusBadge } from '@/components/shared/status-badge/status-badge';
import { HintBadge } from '@/components/shared/hint-badge/hint-badge';
import { formatTimestamp, truncateId, cn } from '@/lib/utils/format';
import styles from './live-event-stream.module.scss';

export function LiveEventStream() {
  const events = useEventBuffer();
  const { paused, setPaused } = useSsePause();

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Live Events</h2>
        <span className={styles.count}>{events.length} events</span>
        <button
          className={cn(styles.pauseBtn, paused && styles.paused)}
          onClick={() => setPaused(!paused)}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div className={styles.feed}>
        {events.length === 0 ? (
          <p className={styles.empty}>Waiting for events...</p>
        ) : (
          events.map((evt, i) => (
            <Link
              key={evt.eventId}
              href={`/sagas/${evt.sagaId}`}
              className={cn(styles.row, i === 0 && styles.latest)}
            >
              <span className={styles.time}>{formatTimestamp(evt.publishedAt)}</span>
              <span className={styles.step}>{evt.stepName}</span>
              <span className={styles.id}>{truncateId(evt.sagaId)}</span>
              <StatusBadge status={evt.status} size="sm" />
              {evt.eventHint && <HintBadge hint={evt.eventHint} />}
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
