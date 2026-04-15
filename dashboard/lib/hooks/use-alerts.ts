import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface DashboardAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  metric: string;
  value: number | string;
  threshold: number | string | null;
  timestamp: string;
}

export interface AlertsData {
  alerts: DashboardAlert[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export function useAlerts() {
  return useSWR<AlertsData>("/api/metrics/alerts", fetcher, {
    refreshInterval: 60_000, // 1 min — alerts should be responsive
    revalidateOnFocus: true,
  });
}
