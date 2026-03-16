"use client";

import { useEffect, useRef, useCallback } from "react";
import { SagaSseMessage } from "@/lib/types/sse";

type SseStatus = "connected" | "reconnecting" | "disconnected";

interface UseSseOptions {
  url: string;
  enabled?: boolean;
  onMessage: (data: SagaSseMessage) => void;
  onStatusChange?: (status: SseStatus) => void;
}

const MAX_SEEN = 1000;

export function useSse({
  url,
  enabled = true,
  onMessage,
  onStatusChange,
}: UseSseOptions) {
  const onMessageRef = useRef(onMessage);
  const onStatusRef = useRef(onStatusChange);
  onMessageRef.current = onMessage;
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    if (!enabled) return;

    const seenIds = new Set<string>();
    const seenQueue: string[] = [];
    let es: EventSource | null = null;
    let backoff = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource(url);

      es.onopen = () => {
        backoff = 1000;
        onStatusRef.current?.("connected");
      };

      es.onmessage = (event) => {
        try {
          const data: SagaSseMessage = JSON.parse(event.data);
          // Dedup
          if (seenIds.has(data.eventId)) return;
          seenIds.add(data.eventId);
          seenQueue.push(data.eventId);
          if (seenQueue.length > MAX_SEEN) {
            const old = seenQueue.shift();
            if (old) seenIds.delete(old);
          }
          onMessageRef.current(data);
        } catch {
          /* ignore parse errors */
        }
      };

      es.onerror = () => {
        es?.close();
        onStatusRef.current?.("reconnecting");
        reconnectTimer = setTimeout(() => {
          backoff = Math.min(backoff * 2, 30_000);
          connect();
        }, backoff);
      };
    }

    connect();

    return () => {
      closed = true;
      es?.close();
      clearTimeout(reconnectTimer);
      onStatusRef.current?.("disconnected");
    };
  }, [url, enabled]);
}
