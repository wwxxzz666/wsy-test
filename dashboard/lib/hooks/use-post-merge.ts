import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface MergedPRHealth {
  repo: string;
  number: number;
  title: string;
  mergedAt: string | null;
  htmlUrl: string | null;
  prType: string | null;
  diffSize: number;
  health: "healthy" | "regressed" | "unknown";
  daysSinceMerge: number;
  signals: string[];
}

export interface PostMergeData {
  mergedPRs: MergedPRHealth[];
  summary: {
    total: number;
    healthy: number;
    regressed: number;
    unknown: number;
    healthRate?: number;
  };
}

export function usePostMerge() {
  return useSWR<PostMergeData>("/api/metrics/post-merge", fetcher, {
    refreshInterval: 300_000, // 5 min — GitHub API calls are expensive
    revalidateOnFocus: false,
  });
}
