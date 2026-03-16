"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSagaTree } from "@/lib/api/sagas";

export function useSagaTree(rootId: string) {
  return useQuery({
    queryKey: ["saga-tree", rootId],
    queryFn: () => fetchSagaTree(rootId),
    enabled: !!rootId,
  });
}
