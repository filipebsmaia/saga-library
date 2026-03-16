"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useSseStore } from "@/lib/sse/sse-provider";
import { SagaSseMessage } from "@/lib/types/sse";

const MAX_EVENTS = 100;
const FLUSH_INTERVAL = 2_000;

/**
 * Subscribes directly to the SSE store (bypassing useSseMessages).
 * Accumulates messages imperatively — zero re-renders per message.
 * Flushes to React every FLUSH_INTERVAL ms.
 */
export function useEventBuffer(): SagaSseMessage[] {
  const store = useSseStore();

  const bufferRef = useRef<SagaSseMessage[]>([]);
  const pendingRef = useRef<SagaSseMessage[]>([]);
  const subsRef = useRef(new Set<() => void>());

  // Imperative subscription — accumulate without re-render
  useEffect(() => {
    if (!store) return;

    const unsub = store.subscribeMessage(() => {
      const msg = store.getMessage();
      if (msg) pendingRef.current.push(msg);
    });

    // Periodic flush to React
    const timer = setInterval(() => {
      if (pendingRef.current.length === 0) return;
      const pending = pendingRef.current;
      pendingRef.current = [];
      bufferRef.current = [...pending.reverse(), ...bufferRef.current].slice(
        0,
        MAX_EVENTS,
      );
      subsRef.current.forEach((fn) => fn());
    }, FLUSH_INTERVAL);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [store]);

  const subscribe = useCallback((cb: () => void) => {
    subsRef.current.add(cb);
    return () => {
      subsRef.current.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback(() => bufferRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}
