import useSWR from "swr";
import type { PRType } from "@/lib/pr-type";

export interface PRTypeStats {
  type: PRType;
  total: number;
  merged: number;
  closed: number;
  open: number;
  mergeRate: number;
  avgDiffSize: number;
}

export interface PRTypeSummary {
  totalPRs: number;
  totalMerged: number;
  overallMergeRate: number;
  bestType: PRType | null;
  bestTypeMergeRate: number;
  // Tier 1: docs + typo (safest, count toward 80% target)
  tier1Ratio: number;
  tier1MergeRate: number;
  tier1Total: number;
  tier1Merged: number;
  // Tier 2: test + dep_update (tracked, not in target)
  tier2MergeRate: number;
  tier2Total: number;
  tier2Merged: number;
  // Tier 3: dead_code (tracked, discouraged)
  tier3MergeRate: number;
  tier3Total: number;
  tier3Merged: number;
  // Combined easy-win (all tiers)
  easyWinRatio: number;
  easyWinMergeRate: number;
  easyWinTotal: number;
  easyWinMerged: number;
}

interface PRTypesResponse {
  types: PRTypeStats[];
  summary: PRTypeSummary;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePRTypes() {
  const { data, error, isLoading } = useSWR<PRTypesResponse>(
    "/api/metrics/pr-types",
    fetcher,
    { refreshInterval: 120000 }
  );
  return {
    types: data?.types,
    summary: data?.summary,
    error,
    isLoading,
  };
}
