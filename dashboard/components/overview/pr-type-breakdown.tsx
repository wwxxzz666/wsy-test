"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePRTypes, type PRTypeStats } from "@/lib/hooks/use-pr-types";
import { PR_TYPE_CONFIG, type PRType } from "@/lib/pr-type";

function TypeRow({ stat }: { stat: PRTypeStats }) {
  const config = PR_TYPE_CONFIG[stat.type as PRType] || PR_TYPE_CONFIG.other;
  const barWidth = Math.max(stat.mergeRate, 1);

  return (
    <div className="py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3">
        {/* Type badge */}
        <span
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm shrink-0 w-16 text-center ${config.bg} ${config.color}`}
        >
          {config.label}
        </span>

        {/* Merge rate bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-foreground/[0.04] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stat.mergeRate > 0
                    ? "bg-emerald-500/60"
                    : "bg-foreground/10"
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span
              className={`text-[11px] font-mono font-bold tabular-nums w-12 text-right ${
                stat.mergeRate >= 10
                  ? "text-emerald-400"
                  : stat.mergeRate > 0
                    ? "text-amber-400"
                    : "text-muted-foreground/30"
              }`}
            >
              {stat.mergeRate}%
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground/40">
          <span>
            <span className="text-emerald-400/70">{stat.merged}</span>
            /{stat.total}
          </span>
          <span className="text-muted-foreground/20">
            ~{stat.avgDiffSize}L
          </span>
        </div>
      </div>
    </div>
  );
}

export function PRTypeBreakdown() {
  const { types, summary, isLoading } = usePRTypes();

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>PR Type Breakdown</span>
          <div className="flex items-center gap-2">
            {summary && summary.bestType && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-emerald-400 border-emerald-500/25"
              >
                best: {summary.bestType} ({summary.bestTypeMergeRate}%)
              </Badge>
            )}
            {summary && (
              <Badge
                variant="outline"
                className={`text-[10px] h-4 px-1.5 font-mono ${
                  summary.tier1Ratio >= 50
                    ? "text-emerald-400 border-emerald-500/25"
                    : summary.tier1Ratio >= 20
                      ? "text-amber-400 border-amber-500/25"
                      : "text-red-400 border-red-500/25"
                }`}
              >
                {summary.tier1Ratio}% T1 docs/typo
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : !types || types.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No PR data yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Header row */}
            <div className="flex items-center gap-3 px-2 -mx-2 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider pb-1">
              <span className="w-16 text-center">type</span>
              <span className="flex-1">merge rate</span>
              <span>merged / total / avg diff</span>
            </div>
            {types.map((stat) => (
              <TypeRow key={stat.type} stat={stat} />
            ))}
            {/* Tier breakdown bar */}
            {summary && (
              <div className="mt-3 pt-2 border-t border-foreground/[0.04] space-y-1.5">
                {/* Tier 1: docs + typo — THE target */}
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
                  <span>
                    T1 docs/typo:{" "}
                    <span
                      className={`tabular-nums ${
                        summary.tier1Ratio >= 80
                          ? "text-emerald-400"
                          : summary.tier1Ratio >= 40
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {summary.tier1Ratio}%
                    </span>
                    <span className="text-muted-foreground/20"> (target: 80%)</span>
                  </span>
                  <span>
                    merge rate:{" "}
                    <span
                      className={`tabular-nums ${
                        summary.tier1MergeRate >= 15
                          ? "text-emerald-400"
                          : summary.tier1MergeRate > 0
                            ? "text-amber-400"
                            : "text-muted-foreground/30"
                      }`}
                    >
                      {summary.tier1MergeRate}%
                    </span>
                    <span className="text-muted-foreground/20">
                      {" "}({summary.tier1Merged}/{summary.tier1Total})
                    </span>
                  </span>
                </div>
                {/* Tier 2 + 3 compact */}
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/30">
                  <span>
                    T2 test/deps:{" "}
                    <span className="text-muted-foreground/50 tabular-nums">
                      {summary.tier2Merged}/{summary.tier2Total}
                    </span>
                    {summary.tier2MergeRate > 0 && (
                      <span className="text-amber-400/50"> {summary.tier2MergeRate}%</span>
                    )}
                  </span>
                  <span>
                    T3 cleanup:{" "}
                    <span className="text-muted-foreground/50 tabular-nums">
                      {summary.tier3Merged}/{summary.tier3Total}
                    </span>
                    {summary.tier3MergeRate > 0 && (
                      <span className="text-red-400/50"> {summary.tier3MergeRate}%</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
