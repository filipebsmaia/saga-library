'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useSyncExternalStore,
  useCallback,
  ReactNode,
} from 'react';
import { SagaSseMessage } from '@/lib/types/sse';

type SseStatus = 'connected' | 'reconnecting' | 'disconnected';

const MAX_SEEN = 1000;

type SseStore = ReturnType<typeof createSseStore>;

interface StatusSnapshot {
  status: SseStatus;
  lastEventAt: Date | null;
  lastPublishedAt: string | null;
}

function createSseStore(url: string) {
  const statusSnap: StatusSnapshot = { status: 'disconnected', lastEventAt: null, lastPublishedAt: null };
  let messageSnap: SagaSseMessage | null = null;
  let paused = false;

  const statusSubs = new Set<() => void>();
  const messageSubs = new Set<() => void>();
  const pauseSubs = new Set<() => void>();

  let eventSource: EventSource | null = null;
  let backoff = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout>;
  let destroyed = false;

  const seenIds = new Set<string>();
  const seenQueue: string[] = [];

  function notifyStatus() {
    statusSubs.forEach((fn) => fn());
  }

  function notifyMessage() {
    messageSubs.forEach((fn) => fn());
  }

  function notifyPause() {
    pauseSubs.forEach((fn) => fn());
  }

  function setStatus(status: SseStatus) {
    if (statusSnap.status === status) {
      return;
    }
    statusSnap.status = status;
    notifyStatus();
  }

  function connect() {
    if (destroyed || eventSource) return;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      backoff = 1000;
      setStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SagaSseMessage = JSON.parse(event.data);
        // Heartbeat — keep connection status fresh but don't treat as a real message
        if (!data.eventId) {
          statusSnap.lastEventAt = new Date();
          notifyStatus();
          return;
        }
        
        if (seenIds.has(data.eventId)) {
          return;
        }

        seenIds.add(data.eventId);
        seenQueue.push(data.eventId);

        if (seenQueue.length > MAX_SEEN) {
          const old = seenQueue.shift();
          if (old) {
            seenIds.delete(old);
          }
        }
        statusSnap.lastEventAt = new Date();
        statusSnap.lastPublishedAt = data.publishedAt ?? null;

        notifyStatus();
        
        if (paused) {
          return;
        }
        messageSnap = data;
        notifyMessage();
      } catch {
        /* ignore heartbeats */
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      eventSource = null;
      setStatus('reconnecting');
      reconnectTimer = setTimeout(() => {
        backoff = Math.min(backoff * 2, 30_000);
        connect();
      }, backoff);
    };
  }

  function start() {
    destroyed = false;
    connect();
  }

  function destroy() {
    destroyed = true;
    eventSource?.close();
    eventSource = null;
    clearTimeout(reconnectTimer);
  }

  function reconnect() {
    destroy();
    backoff = 1000;
    start();
  }

  function setPaused(v: boolean) {
    if (paused === v) return;
    paused = v;
    notifyPause();
  }

  function getPaused() {
    return paused;
  }

  // Stable subscribe functions for useSyncExternalStore
  function subscribeStatus(cb: () => void) {
    statusSubs.add(cb);
    return () => { statusSubs.delete(cb); };
  }

  function subscribeMessage(cb: () => void) {
    messageSubs.add(cb);
    return () => { messageSubs.delete(cb); };
  }

  function subscribePause(cb: () => void) {
    pauseSubs.add(cb);
    return () => { pauseSubs.delete(cb); };
  }

  return {
    getStatus: () => statusSnap,
    getMessage: () => messageSnap,
    getPaused,
    subscribeStatus,
    subscribeMessage,
    subscribePause,
    setPaused,
    start,
    destroy,
    reconnect,
  };
}


// ---------------------------------------------------------------------------
// Context & hooks
// ---------------------------------------------------------------------------
const SseStoreContext = createContext<SseStore | null>(null);

/** Direct access to the store — for imperative subscriptions outside React render cycle */
export function useSseStore(): SseStore | null {
  return useContext(SseStoreContext);
}

const DEFAULT_STATUS: StatusSnapshot = { status: 'disconnected', lastEventAt: null, lastPublishedAt: null };
const noopUnsub = () => () => {};

/** Connection status — re-renders only on connect/disconnect */
export function useSseStatus(): StatusSnapshot {
  const store = useContext(SseStoreContext);
  return useSyncExternalStore(
    store ? store.subscribeStatus : noopUnsub,
    store ? store.getStatus : () => DEFAULT_STATUS,
    () => DEFAULT_STATUS,
  );
}

/** Latest SSE message — re-renders on each new message */
export function useSseMessages(): { lastMessage: SagaSseMessage | null } {
  const store = useContext(SseStoreContext);
  const msg = useSyncExternalStore(
    store ? store.subscribeMessage : noopUnsub,
    store ? store.getMessage : () => null,
    () => null,
  );
  return { lastMessage: msg };
}

/** Pause/resume SSE message processing */
export function useSsePause(): { paused: boolean; setPaused: (v: boolean) => void } {
  const store = useContext(SseStoreContext);
  const paused = useSyncExternalStore(
    store ? store.subscribePause : noopUnsub,
    store ? store.getPaused : () => false,
    () => false,
  );
  const setPaused = useCallback(
    (v: boolean) => store?.setPaused(v),
    [store],
  );
  return { paused, setPaused };
}

/** Force reconnect */
export function useSseReconnect(): () => void {
  const store = useContext(SseStoreContext);
  return useCallback(() => store?.reconnect(), [store]);
}

// ---------------------------------------------------------------------------
// Provider — always connects on mount
// ---------------------------------------------------------------------------
// SSE connects directly to the backend — Next.js rewrite proxy buffers responses, breaking SSE streaming.
// All other API calls still go through the /api/v1/* rewrite.
const SSE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/stream/sagas`;

export function SseProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSseStore(SSE_URL));

  useEffect(() => {
    store.start();
    return () => store.destroy();
  }, [store]);

  return (
    <SseStoreContext.Provider value={store}>
      {children}
    </SseStoreContext.Provider>
  );
}
