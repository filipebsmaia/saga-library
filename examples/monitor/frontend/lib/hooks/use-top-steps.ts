"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTopSteps } from "@/lib/api/sagas";
import type { TopStepDto } from "@/lib/types/trends";

export function useTopSteps() {
  return useQuery<TopStepDto[]>({
    queryKey: ["top-steps"],
    queryFn: fetchTopSteps,
    refetchInterval: 60_000,
  });
}
