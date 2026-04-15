import useSWR from "swr";
import type { AgentState } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAgentState() {
  const { data, error, isLoading, mutate } = useSWR<{
    state: AgentState | null;
  }>("/api/state", fetcher, { refreshInterval: 5000 });

  return { data, error, isLoading, mutate };
}
