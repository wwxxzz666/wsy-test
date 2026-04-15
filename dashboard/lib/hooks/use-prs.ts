import useSWR from "swr";
import type { PullRequest, PRFilterState } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePRs(filters: PRFilterState, page: number = 1) {
  const params = new URLSearchParams({
    status: filters.status,
    repo: filters.repo,
    page: String(page),
    limit: "20",
    minQuality: String(filters.minQuality),
    search: filters.search,
  });

  const { data, error, isLoading, mutate } = useSWR<{
    data: PullRequest[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/github/prs?${params}`, fetcher, { refreshInterval: 60000 });

  return { data, error, isLoading, mutate };
}

export function usePRDetail(id: string | null) {
  const { data, error, isLoading } = useSWR<PullRequest>(
    id ? `/api/github/prs/${encodeURIComponent(id)}` : null,
    fetcher
  );
  return { data, error, isLoading };
}
