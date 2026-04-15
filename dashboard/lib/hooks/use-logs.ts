import useSWR from "swr";
import type { LogEntry, LogFilterState } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLogs(filters: LogFilterState, page: number = 1) {
  const params = new URLSearchParams({
    level: filters.level,
    source: filters.source,
    page: String(page),
    limit: "50",
    search: filters.search,
  });

  const { data, error, isLoading, mutate } = useSWR<{
    entries: LogEntry[];
    total: number;
    page: number;
  }>(`/api/logs?${params}`, fetcher, { refreshInterval: 5000 });

  return { data, error, isLoading, mutate };
}
