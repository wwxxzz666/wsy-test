import useSWR from "swr";
import type { DashboardOverview } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAgentStatus() {
  const { data, error, isLoading, mutate } = useSWR<DashboardOverview>(
    "/api/metrics/overview",
    fetcher,
    { refreshInterval: 10000 }
  );

  return { data, error, isLoading, mutate };
}
