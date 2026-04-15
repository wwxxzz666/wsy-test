"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { HealthStatusCards } from "@/components/health/health-status-cards";
import { TokenUsageChart } from "@/components/health/token-usage-chart";
import { CostTrackingChart } from "@/components/health/cost-tracking-chart";
import { SessionStatesTable } from "@/components/health/session-states-table";
import {
  useHealthMetrics,
  useTokenMetrics,
  useCostMetrics,
} from "@/lib/hooks/use-metrics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export default function HealthPage() {
  const [tokenRange, setTokenRange] = useState("week");
  const [costRange, setCostRange] = useState("week");

  const { data: health, isLoading: healthLoading } = useHealthMetrics();
  const { data: tokenData } = useTokenMetrics(tokenRange);
  const { data: costData } = useCostMetrics(costRange);

  if (healthLoading) {
    return (
      <div className="flex flex-col">
        <Header title="Agent Health" />
        <div className="flex-1 space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Agent Health" />
      <div className="flex-1 space-y-8 p-6 lg:p-8">
        {health && (
          <HealthStatusCards
            heartbeat={health.heartbeat}
            uptime={health.uptime}
            errorRate={health.errorRate}
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-end">
              <Select value={tokenRange} onValueChange={(v) => v && setTokenRange(v)}>
                <SelectTrigger className="w-[120px] mono-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TokenUsageChart data={tokenData || []} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-end">
              <Select value={costRange} onValueChange={(v) => v && setCostRange(v)}>
                <SelectTrigger className="w-[120px] mono-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="3months">3 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CostTrackingChart data={costData || []} />
          </div>
        </div>

        <SessionStatesTable sessions={health?.sessions || []} />
      </div>
    </div>
  );
}
