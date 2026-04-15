"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useCorrelations,
  type CorrelationFactor,
  type CorrelationEntry,
} from "@/lib/hooks/use-correlations";

function FactorTable({ factor, overallRate }: { factor: CorrelationFactor; overallRate: number }) {
  return (
    <div>
      <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-1.5">
        {factor.name}
      </div>
      <div className="space-y-0.5">
        {factor.data
          .filter((d) => d.total > 0)
          .map((entry) => (
            <div
              key={entry.label}
              className="flex items-center gap-2 text-[10px] font-mono py-0.5"
            >
              <span className="w-20 text-right text-muted-foreground/50 shrink-0 truncate" title={entry.label}>
                {entry.label}
              </span>
              <div className="flex-1 h-[5px] bg-foreground/5 rounded-[2px] overflow-hidden">
                <div
                  className={`h-full rounded-[2px] transition-all ${
                    entry.mergeRate > overallRate
                      ? "bg-emerald-500/50"
                      : entry.mergeRate > 0
                        ? "bg-amber-500/30"
                        : "bg-foreground/10"
                  }`}
                  style={{
                    width: `${Math.max(entry.mergeRate, 2)}%`,
                  }}
                />
              </div>
              <span
                className={`w-10 text-right tabular-nums shrink-0 ${
                  entry.mergeRate > overallRate
                    ? "text-emerald-400/70"
                    : entry.mergeRate > 0
                      ? "text-amber-400/70"
                      : "text-muted-foreground/30"
                }`}
              >
                {entry.mergeRate}%
              </span>
              <span
                className={`w-10 text-right tabular-nums shrink-0 text-[9px] ${
                  entry.lift > 0
                    ? "text-emerald-400/40"
                    : entry.lift < 0
                      ? "text-red-400/40"
                      : "text-muted-foreground/20"
                }`}
              >
                {entry.lift > 0 ? "+" : ""}{entry.lift}%
              </span>
              <span className="w-6 text-right tabular-nums text-muted-foreground/20 shrink-0">
                {entry.total}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function CorrelationPanel() {
  const { data, isLoading } = useCorrelations();

  if (isLoading) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Merge Correlations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.factors.length === 0) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Merge Correlations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Not enough data for correlation analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Merge Correlations</span>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 font-mono text-muted-foreground/60 border-muted-foreground/20"
          >
            baseline: {data.overallMergeRate}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="space-y-1 px-2 py-1.5 rounded-md bg-emerald-500/5 border border-emerald-500/10">
            {data.insights.map((insight, i) => (
              <p key={i} className="text-[10px] font-mono text-emerald-400/70 leading-relaxed">
                {insight}
              </p>
            ))}
          </div>
        )}

        {/* Factor tables in 2x2 grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {data.factors.map((factor) => (
            <FactorTable
              key={factor.name}
              factor={factor}
              overallRate={data.overallMergeRate}
            />
          ))}
        </div>

        {/* Footer legend */}
        <div className="pt-2 border-t border-foreground/[0.04]">
          <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground/25">
            <span>bars = merge rate per bucket</span>
            <span>lift = % above/below baseline</span>
            <span className="text-emerald-400/30">green = above avg</span>
            <span className="text-amber-400/30">amber = below avg</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
