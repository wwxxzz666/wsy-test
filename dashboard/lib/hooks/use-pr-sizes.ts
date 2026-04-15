import useSWR from "swr";

export interface PRSizeBucket {
  label: string;
  min: number;
  max: number | null;
  total: number;
  merged: number;
  closed: number;
  open: number;
  mergeRate: number;
  inSweetSpot: boolean;
}

export interface PRSizeSummary {
  totalPRs: number;
  avgSize: number;
  medianSize: number;
  idealSize: number;
  sweetSpotRange: { min: number; max: number };
  sweetSpotCount: number;
  sweetSpotRatio: number;
  sweetSpotMergeRate: number;
  outsideMergeRate: number;
}

interface PRSizesResponse {
  buckets: PRSizeBucket[];
  summary: PRSizeSummary;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePRSizes() {
  const { data, error, isLoading } = useSWR<PRSizesResponse>(
    "/api/metrics/pr-sizes",
    fetcher,
    { refreshInterval: 120000 }
  );
  return {
    buckets: data?.buckets,
    summary: data?.summary,
    error,
    isLoading,
  };
}
