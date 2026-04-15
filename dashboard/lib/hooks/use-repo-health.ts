import useSWR from "swr";

export interface RepoHealth {
  repo: string;
  healthScore: number;
  engagement: "responsive" | "slow" | "dead";
  nicheFit: boolean;
  recommendedAction: "target_actively" | "one_more_try" | "build_trust_first" | "avoid";
  mergePrediction: number;
  avgDiffSize: number;
  prs: {
    total: number;
    merged: number;
    closed: number;
    open: number;
    reviewed: number;
    mergeRate: number;
    reviewRate: number;
    avgQuality: number;
  };
  velocity: {
    avgDays: number;
    minDays: number;
    maxDays: number;
  } | null;
  timeToFirstReview: number | null;
  followUps: {
    total: number;
    successes: number;
    active: number;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useRepoHealth(range: string = "90d") {
  const { data, error, isLoading } = useSWR<{ repos: RepoHealth[]; range: string }>(
    `/api/metrics/repo-health?range=${range}`,
    fetcher,
    { refreshInterval: 120000 }
  );
  return { data: data?.repos, range: data?.range, error, isLoading };
}
