"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, formatDuration, formatPercentage } from "@/lib/utils";

interface HealthStatusCardsProps {
  heartbeat: {
    lastBeat: Date | string | null;
    intervalMinutes: number;
    streak: number;
  };
  uptime: {
    percentage: number;
    since: Date | string;
    totalDowntimeMinutes: number;
  };
  errorRate: {
    perHour: number;
    trend: "increasing" | "stable" | "decreasing";
    lastError: Date | string | null;
  };
}

const trendLabels = {
  increasing: "Increasing",
  stable: "Stable",
  decreasing: "Decreasing",
};

const trendIcons: Record<string, string> = {
  increasing: "^",
  stable: "~",
  decreasing: "v",
};

const trendColors: Record<string, string> = {
  increasing: "text-red-400",
  stable: "text-muted-foreground",
  decreasing: "text-emerald-400",
};

export function HealthStatusCards({
  heartbeat,
  uptime,
  errorRate,
}: HealthStatusCardsProps) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <Card className="card-lift">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Heartbeat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="stat-label">Last</span>
            <span className="font-mono text-[12px]">
              {heartbeat.lastBeat
                ? formatRelativeTime(heartbeat.lastBeat)
                : "Never"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="stat-label">Interval</span>
            <span className="font-mono text-[12px]">{heartbeat.intervalMinutes}min</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="stat-label">Streak</span>
            <span className="font-mono text-[12px] text-emerald-400">{heartbeat.streak.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="card-lift">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-foreground/30" />
            Uptime
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="stat-label">Percentage</span>
            <span className="font-mono text-[12px] font-bold">{formatPercentage(uptime.percentage)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="stat-label">Since</span>
            <span className="font-mono text-[12px]">{formatRelativeTime(uptime.since)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="stat-label">Downtime</span>
            <span className="font-mono text-[12px]">{formatDuration(uptime.totalDowntimeMinutes * 60)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className={`card-lift ${errorRate.perHour > 0 ? "border-red-500/20" : ""}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${errorRate.perHour > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
            Error Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="stat-label">Per Hour</span>
            <span className={`font-mono text-[12px] font-bold ${errorRate.perHour > 0 ? "text-red-400" : ""}`}>
              {errorRate.perHour}/hr
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="stat-label">Trend</span>
            <span className={`font-mono text-[12px] ${trendColors[errorRate.trend] || ""}`}>
              {trendIcons[errorRate.trend]} {trendLabels[errorRate.trend]}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="stat-label">Last Error</span>
            <span className="font-mono text-[12px]">
              {errorRate.lastError
                ? formatRelativeTime(errorRate.lastError)
                : <span className="text-emerald-400">None</span>}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
