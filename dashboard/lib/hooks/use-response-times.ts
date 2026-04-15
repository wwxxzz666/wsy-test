import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface ResponseBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface RepoResponseStat {
  repo: string;
  total: number;
  reviewed: number;
  reviewRate: number;
  medianHours: number | null;
  avgHours: number | null;
}

export interface ResponseTimesData {
  distribution: ResponseBucket[];
  repoRanking: RepoResponseStat[];
  summary: {
    totalPRs: number;
    reviewed: number;
    unreviewed: number;
    reviewRate: number;
    medianHours: number | null;
    avgHours: number | null;
    benchmarkHumanMedian: number | null;
  };
}

export function useResponseTimes() {
  return useSWR<ResponseTimesData>("/api/metrics/response-times", fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
  });
}
