import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface PromptGap {
  id: string;
  name: string;
  severity: string;
  evidence: string;
  count: number;
}

export interface DuplicateRepo {
  repo: string;
  prCount: number;
  prs: { number: number; title: string; status: string; htmlUrl: string | null }[];
}

export interface OversizedPR {
  repo: string;
  number: number;
  title: string;
  diffSize: number;
  filesChanged: number;
  status: string;
  htmlUrl: string | null;
}

export interface WastedCycle {
  repo: string;
  number: number;
  title: string;
  htmlUrl: string | null;
  diffSize: number;
  reason: string;
}

export interface AutonomySnapshot {
  timestamp: string;
  score: number;
}

export interface AutonomyData {
  autonomyScore: number;
  history: AutonomySnapshot[];
  pipeline: {
    total: number;
    reviewed: number;
    merged: number;
    closed: number;
    open: number;
    reviewRate: number;
    mergeRate: number;
  };
  penalties: {
    duplicates: { count: number; penalty: number };
    oversized: { count: number; penalty: number };
    wasted: { count: number; penalty: number };
  };
  bonuses: {
    mergeRate: number;
    reviewRate: number;
  };
  promptGaps: PromptGap[];
  duplicateRepos: DuplicateRepo[];
  oversizedPRs: OversizedPR[];
  wastedCycles: WastedCycle[];
  quickRejections: { repo: string; number: number; title: string; htmlUrl: string | null; hoursOpen: number }[];
  deadRepoTargets: string[];
  subagentStats: {
    total: number;
    success: number;
    failure: number;
    abandoned: number;
    avgDurationMs: number;
  };
  failureCategories: Record<string, { count: number; prs: string[] }>;
}

export function useAutonomy() {
  return useSWR<AutonomyData>("/api/metrics/autonomy", fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
  });
}
