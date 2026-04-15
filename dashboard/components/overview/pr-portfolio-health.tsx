"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortfolioHealth } from "@/lib/hooks/use-portfolio-health";

function MiniTrend({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const barHeight = 20;
  return (
    <div className="flex items-end gap-[2px] h-5" aria-label="7-day open PR trend">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px] bg-foreground/15 transition-all"
          style={{ height: `${Math.max((v / max) * barHeight, 1)}px` }}
        />
      ))}
    </div>
  );
}

function HealthGauge({ score }: { score: number }) {
  const segments = 20;
  const filled = Math.round((score / 100) * segments);
  const color =
    score >= 50
      ? "bg-emerald-500/50"
      : score >= 25
        ? "bg-amber-500/50"
        : "bg-red-500/50";
  return (
    <div className="flex gap-[2px]" aria-hidden="true">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-[1px] transition-all ${
            i < filled ? color : "bg-foreground/5"
          }`}
        />
      ))}
    </div>
  );
}

export function PRPortfolioHealth() {
  const { data, isLoading } = usePortfolioHealth();

  const statusConfig = {
    healthy: {
      label: "HEALTHY",
      color: "text-emerald-400 border-emerald-500/25 bg-emerald-500/8",
      dot: "bg-emerald-500",
    },
    warning: {
      label: "WARNING",
      color: "text-amber-400 border-amber-500/25 bg-amber-500/8",
      dot: "bg-amber-500",
    },
    critical: {
      label: "CRITICAL",
      color: "text-red-400 border-red-500/25 bg-red-500/8",
      dot: "bg-red-500",
    },
  };

  const openColor = !data
    ? "text-muted-foreground/40"
    : "text-foreground/80";

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>PR Portfolio Health</span>
          {data && (
            <Badge
              variant="outline"
              className={`text-[9px] h-4 px-1.5 font-mono ${statusConfig[data.status].color}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full mr-1 ${statusConfig[data.status].dot}`}
              />
              {statusConfig[data.status].label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : !data ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stale follow-up banner */}
            {data.stale > 10 && (
              <div className="px-3 py-2 rounded-md bg-amber-500/8 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-mono text-amber-400 font-medium">
                    BUMP STALE PRs — {data.stale} open PRs with no update in 7+ days need follow-up
                  </span>
                </div>
              </div>
            )}

            {/* Open PR hero number */}
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold tabular-nums tracking-tighter ${openColor}`}>
                {data.open}
              </span>
              <span className="text-sm text-muted-foreground/50 font-mono">open PRs</span>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  stale
                </div>
                <div className={`text-lg font-bold tabular-nums ${data.stale > 5 ? "text-amber-400" : "text-foreground/60"}`}>
                  {data.stale}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  changes req
                </div>
                <div className={`text-lg font-bold tabular-nums ${data.changesRequested > 0 ? "text-orange-400" : "text-foreground/60"}`}>
                  {data.changesRequested}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  ci failing
                </div>
                <div className={`text-lg font-bold tabular-nums ${data.ciFailingOurs > 0 ? "text-red-400" : "text-foreground/60"}`}>
                  {data.ciFailingOurs}
                </div>
              </div>
            </div>

            {/* Portfolio health score */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  portfolio score
                </span>
                <span className={`text-sm font-bold tabular-nums ${
                  data.portfolioScore >= 50
                    ? "text-emerald-400"
                    : data.portfolioScore >= 25
                      ? "text-amber-400"
                      : "text-red-400"
                }`}>
                  {data.portfolioScore.toFixed(1)}%
                </span>
              </div>
              <HealthGauge score={data.portfolioScore} />
              <div className="text-[9px] font-mono text-muted-foreground/30 mt-1">
                merged / (merged + closed)
              </div>
            </div>

            {/* 7-day trend */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  7d open trend
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/30 tabular-nums">
                  {data.trend[0]} &rarr; {data.trend[data.trend.length - 1]}
                </span>
              </div>
              <MiniTrend data={data.trend} />
            </div>

            {/* Summary footer */}
            <div className="pt-2 border-t border-foreground/[0.04]">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
                <span>
                  <span className="text-emerald-400/70">{data.merged}</span> merged
                  <span className="text-muted-foreground/20"> | </span>
                  <span className="text-red-400/70">{data.closed}</span> closed
                </span>
                <span className="tabular-nums">
                  {data.open + data.merged + data.closed} total
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
