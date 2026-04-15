import useSWR from "swr";

export interface MergeProbabilityData {
  scored: number;
  total: number;
  coveragePct: number;
  avgScore: number | null;
  distribution: Record<string, number>;
  accuracy: {
    merged: { avgPMerge: number; count: number } | null;
    closed: { avgPMerge: number; count: number } | null;
    open: { avgPMerge: number; count: number } | null;
  };
  modelAccuracy: "good" | "weak" | "inverted" | "insufficient_data";
  typeBreakdown: Record<
    string,
    { count: number; avgScore: number; mergeCount: number }
  >;
  sizeBreakdown: {
    label: string;
    count: number;
    avgScore: number | null;
    mergeCount: number;
  }[];
  slotUtilization: {
    activeSlots: number;
    maxSlots: number;
    utilizationPct: number;
    lastHour: {
      total: number;
      success: number;
      failure: number;
      avgDurationMs: number | null;
    };
  } | null;
  weights: {
    current: Record<string, number>;
    note: string;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMergeProbability() {
  const { data, error, isLoading } = useSWR<MergeProbabilityData>(
    "/api/metrics/merge-probability",
    fetcher,
    { refreshInterval: 120000 }
  );
  return { data, error, isLoading };
}
