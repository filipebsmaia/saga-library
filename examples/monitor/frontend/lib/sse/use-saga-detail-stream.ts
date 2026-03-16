"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSse } from "./use-sse";
import { SagaSseMessage } from "@/lib/types/sse";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3100";

interface UseSagaDetailStreamOptions {
  sagaId: string;
  enabled?: boolean;
}

export function useSagaDetailStream({
  sagaId,
  enabled = true,
}: UseSagaDetailStreamOptions) {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [recentEventIds, setRecentEventIds] = useState<Set<string>>(new Set());

  const handleMessage = useCallback(
    (message: SagaSseMessage) => {
      setRecentEventIds((current) => {
        const updated = new Set(current);
        updated.add(message.eventId);
        return updated;
      });

      // Clear highlight after 3s
      setTimeout(() => {
        setRecentEventIds((current) => {
          const updated = new Set(current);
          updated.delete(message.eventId);
          return updated;
        });
      }, 3000);

      // Debounced invalidation
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["saga", sagaId] });
        queryClient.invalidateQueries({ queryKey: ["saga-events", sagaId] });
        queryClient.invalidateQueries({
          queryKey: ["saga-events-all", sagaId],
        });
        queryClient.invalidateQueries({ queryKey: ["saga-metrics", sagaId] });
        queryClient.invalidateQueries({
          queryKey: ["saga-predictions", sagaId],
        });
        queryClient.invalidateQueries({ queryKey: ["saga-tree"] });
      }, 300);
    },
    [queryClient, sagaId],
  );

  useSse({
    url: `${BACKEND_URL}/v1/stream/sagas/${sagaId}`,
    enabled: enabled && !!sagaId,
    onMessage: handleMessage,
  });

  return { recentEventIds };
}
