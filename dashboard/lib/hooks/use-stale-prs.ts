import useSWR from "swr";

export interface StalePR {
  id: string;
  repo: string;
  number: number;
  title: string;
  daysOpen: number;
  createdAt: string;
  diffSize: number;
  filesChanged: number;
  reviewCount: number;
  hasHumanReview: boolean;
  latestReviewState: string | null;
  qualityScore: number | null;
  htmlUrl: string | null;
  recommendation: "rework" | "wait" | "followup";
}

export interface StalePRSummary {
  total: number;
  rework: number;
  followup: number;
  wait: number;
  avgDaysOpen: number;
  worstRepos: { repo: string; count: number }[];
}

interface StalePRsResponse {
  stalePRs: StalePR[];
  summary: StalePRSummary;
  staleDays: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useStalePRs(days: number = 7) {
  const { data, error, isLoading } = useSWR<StalePRsResponse>(
    `/api/metrics/stale-prs?days=${days}`,
    fetcher,
    { refreshInterval: 120000 }
  );
  return {
    stalePRs: data?.stalePRs,
    summary: data?.summary,
    staleDays: data?.staleDays,
    error,
    isLoading,
  };
}
