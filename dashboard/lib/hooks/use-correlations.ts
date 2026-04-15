import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface CorrelationEntry {
  label: string;
  total: number;
  merged: number;
  mergeRate: number;
  lift: number;
}

export interface CorrelationFactor {
  name: string;
  data: CorrelationEntry[];
}

export interface CorrelationsData {
  overallMergeRate: number;
  factors: CorrelationFactor[];
  insights: string[];
}

export function useCorrelations() {
  return useSWR<CorrelationsData>("/api/metrics/correlations", fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
  });
}
