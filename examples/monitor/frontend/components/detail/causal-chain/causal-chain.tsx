"use client";

import { useMemo } from "react";
import { SagaEventDto } from "@/lib/types/saga";
import { HintBadge } from "@/components/shared/hint-badge/hint-badge";
import { truncateId, cn } from "@/lib/utils/format";
import styles from "./causal-chain.module.scss";

interface CausalChainProps {
  events: SagaEventDto[];
  selectedEventId: string;
}

export function CausalChain({ events, selectedEventId }: CausalChainProps) {
  const chain = useMemo(() => {
    const byId = new Map(events.map((e) => [e.sagaEventId, e]));
    const result: SagaEventDto[] = [];

    // Walk backwards from selected event via causation chain
    let current = byId.get(selectedEventId);
    while (current) {
      result.unshift(current);
      if (current.sagaCausationId === current.sagaEventId) break;
      current = byId.get(current.sagaCausationId);
    }

    // Walk forward: find events caused by selected
    const forward: SagaEventDto[] = [];
    for (const e of events) {
      if (
        e.sagaCausationId === selectedEventId &&
        e.sagaEventId !== selectedEventId
      ) {
        forward.push(e);
      }
    }
    result.push(...forward);

    return result;
  }, [events, selectedEventId]);

  if (chain.length <= 1) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No causal chain found for this event.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.chain}>
        {chain.map((event, i) => {
          const isSelected = event.sagaEventId === selectedEventId;
          return (
            <div key={event.sagaEventId} className={styles.chainItem}>
              {i > 0 && <span className={styles.arrow}>→</span>}
              <div
                className={cn(
                  styles.chainNode,
                  isSelected && styles.chainNodeSelected,
                )}
              >
                <HintBadge hint={event.sagaEventHint} />
                <span className={styles.chainStep}>{event.sagaStepName}</span>
                <span className={styles.chainId}>
                  {truncateId(event.sagaEventId, 6)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
