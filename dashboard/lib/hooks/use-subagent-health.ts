import useSWR from "swr";

export interface SubagentSlot {
  label: string;
  status: "ACTIVE" | "IDLE" | "STALE" | "DEAD";
  contextPct: number;
  ageMinutes: number;
  sessionKey?: string;
  repo?: string;
  issue?: string;
}

export interface SubagentHealthData {
  alwaysOn: SubagentSlot[];
  implSlots: (SubagentSlot | null)[];
  totalActive: number;
  totalSlots: number;
  lastUpdated: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSubagentHealth() {
  const { data, error, isLoading, mutate } = useSWR<SubagentHealthData>(
    "/api/metrics/subagent-health",
    fetcher,
    { refreshInterval: 10000 }
  );

  return { data, error, isLoading, mutate };
}
