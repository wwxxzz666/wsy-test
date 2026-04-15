import useSWR from "swr";

interface ConnectionStatus {
  connection: {
    state: "connected" | "degraded" | "disconnected" | "unknown";
    message: string;
    lastHeartbeat: string | null;
    heartbeatStatus: string | null;
    model: string;
    tokenBudget: {
      enabled: boolean;
      totalTokens: number;
      usedTokens: number;
      remainingTokens: number;
      paused: boolean;
    };
  };
  pipeline: {
    heartbeats: boolean;
    metrics: boolean;
    heartbeatsLastHour: number;
    errorsLastHour: number;
    lastMetricAt: string | null;
  };
  hasAnyData: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useConnectionStatus() {
  const { data, error, isLoading } = useSWR<ConnectionStatus>(
    "/api/connection-status",
    fetcher,
    { refreshInterval: 5000 }
  );

  return { data, error, isLoading };
}
