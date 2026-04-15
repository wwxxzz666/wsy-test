import useSWR from "swr";

export interface ThroughputData {
  slotsUsed: number;
  totalSlots: number;
  prsToday: number;
  mergedToday: number;
  avgSpawnToSubmit: number;
  idleCycles: number;
  hourlyPRs: number[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useThroughput() {
  const { data, error, isLoading } = useSWR<ThroughputData>(
    "/api/metrics/throughput",
    fetcher,
    { refreshInterval: 15000 }
  );

  return {
    data,
    error,
    isLoading,
  };
}
