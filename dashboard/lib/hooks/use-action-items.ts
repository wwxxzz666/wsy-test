import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface ActionItem {
  id: string;
  priority: "P0" | "P1" | "P2";
  category: "targeting" | "quality" | "volume" | "tooling" | "followup";
  title: string;
  problem: string;
  suggestedFix: string;
  impactEstimate: string;
  dataPoint: string;
}

export interface ActionItemsData {
  items: ActionItem[];
  summary: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
  };
  context: {
    totalPRs: number;
    mergeRate: number;
    reviewRate: number;
    oversizedRate: number;
  };
}

export function useActionItems() {
  return useSWR<ActionItemsData>("/api/metrics/action-items", fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
  });
}
