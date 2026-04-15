import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface DirectiveEntry {
  id: string;
  timestamp: string;
  message: string;
  directives: string[];
  stats: { total: number; merged: number; open: number; closed: number } | null;
}

export interface DirectivesData {
  entries: DirectiveEntry[];
}

export function useDirectives(limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR<DirectivesData>(
    `/api/metrics/directives?limit=${limit}`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  return { data, error, isLoading, mutate };
}
