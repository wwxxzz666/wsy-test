import useSWR from "swr";

export interface PortfolioHealth {
  open: number;
  merged: number;
  closed: number;
  stale: number;
  changesRequested: number;
  ciFailingOurs: number;
  portfolioScore: number;
  trend: number[];
  status: "healthy" | "warning" | "critical";
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePortfolioHealth() {
  const { data, error, isLoading } = useSWR<PortfolioHealth>(
    "/api/metrics/portfolio-health",
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    data,
    error,
    isLoading,
  };
}
