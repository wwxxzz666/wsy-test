import useSWR from "swr";
import type { TokenUsageData, CostData, HealthData, QualityData } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTokenMetrics(range: string = "week") {
  const { data, error, isLoading } = useSWR<{ data: TokenUsageData[] }>(
    `/api/metrics/tokens?range=${range}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  return { data: data?.data, error, isLoading };
}

export function useCostMetrics(range: string = "week") {
  const { data, error, isLoading } = useSWR<{ data: CostData[] }>(
    `/api/metrics/cost?range=${range}`,
    fetcher,
    { refreshInterval: 60000 }
  );
  return { data: data?.data, error, isLoading };
}

export function useHealthMetrics() {
  const { data, error, isLoading } = useSWR<HealthData>(
    "/api/metrics/health",
    fetcher,
    { refreshInterval: 30000 }
  );
  return { data, error, isLoading };
}

export function useQualityMetrics(range: string = "30d") {
  const { data, error, isLoading } = useSWR<QualityData>(
    `/api/metrics/quality?range=${range}`,
    fetcher,
    { refreshInterval: 120000 }
  );
  return { data, error, isLoading };
}
