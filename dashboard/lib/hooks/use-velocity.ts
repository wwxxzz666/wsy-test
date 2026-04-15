import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface VelocityDay {
  date: string;
  submitted: number;
  merged: number;
  closed: number;
  totalLines: number;
}

export interface RollingAvg {
  date: string;
  avgSubmitted: number;
  avgMerged: number;
}

export interface VelocityData {
  days: VelocityDay[];
  rolling7d: RollingAvg[];
  summary: {
    totalSubmitted: number;
    totalMerged: number;
    totalClosed: number;
    activeDays: number;
    avgPerDay: number;
    peakDay: string | null;
    peakCount: number;
    mergeRatio: number;
  };
}

export function useVelocity() {
  return useSWR<VelocityData>("/api/metrics/velocity", fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
  });
}
