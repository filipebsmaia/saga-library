"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAttentionItems } from "@/lib/api/sagas";

export function useAttentionItems() {
  return useQuery({
    queryKey: ["attention-items"],
    queryFn: fetchAttentionItems,
    refetchInterval: 30_000,
  });
}
