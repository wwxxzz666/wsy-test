"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMergeProbability } from "@/lib/hooks/use-merge-probability";

const bucketColors: Record<string, string> = {
  "0-20": "bg-red-500/60",
  "20-40": "bg-orange-500/50",
  "40-60": "bg-amber-500/50",
  "60-80": "bg-emerald-500/50",
  "80-100": "bg-emerald-400/70",
};

const accuracyLabels: Record<string, { label: string; color: string }> = {
  good: { label: "calibrated", color: "text-emerald-400" },
  weak: { label: "weakly calibrated", color: "text-amber-400" },
  inverted: { label: "inverted -- needs recalibration", color: "text-red-400" },
  insufficient_data: { label: "awaiting data", color: "text-muted-foreground/50" },
};

function DistributionBar({
  distribution,
  total,
}: {
  distribution: Record<string, number>;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-[11px] text-muted-foreground/50 font-mono">
          No scored PRs yet. Scores will appear as V10 scoring goes live.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="space-y-1.5">
      {Object.entries(distribution).map(([bucket, count]) => (
        <div key={bucket} className="flex items-center gap-2 text-[10px] font-mono">
          <span className="w-12 text-right text-muted-foreground/50 shrink-0 tabular-nums">
            {bucket}
          </span>
          <div className="flex-1 h-[8px] bg-foreground/5 rounded-[2px] overflow-hidden">
            <div
              className={`h-full rounded-[2px] transition-all ${bucketColors[bucket] || "bg-foreground/20"}`}
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right tabular-nums text-foreground/60 shrink-0">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

function AccuracyTable({
  accuracy,
}: {
  accuracy: {
    merged: { avgPMerge: number; count: number } | null;
    closed: { avgPMerge: number; count: number } | null;
    open: { avgPMerge: number; count: number } | null;
  };
}) {
  const rows = [
    { label: "Merged", data: accuracy.merged, color: "text-emerald-400" },
    { label: "Open", data: accuracy.open, color: "text-amber-400" },
    { label: "Closed", data: accuracy.closed, color: "text-red-400" },
  ];

  return (
    <div className="space-y-1">
      <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">
        Score vs Outcome
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between text-[10px] font-mono"
        >
          <span className={row.color}>{row.label}</span>
          <span className="tabular-nums text-foreground/60">
            {row.data ? `avg ${row.data.avgPMerge} (${row.data.count} PRs)` : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}

function SlotUtilizationGauge({
  active,
  max,
  lastHour,
}: {
  active: number;
  max: number;
  lastHour: { total: number; success: number; failure: number; avgDurationMs: number | null };
}) {
  const pct = Math.round((active / max) * 100);
  const color =
    pct >= 80 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-muted-foreground/50";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">
          Slot Utilization
        </span>
        <span className={`text-lg font-bold tabular-nums ${color}`}>
          {active}/{max}
        </span>
      </div>
      <div className="flex gap-[3px]">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`h-[6px] flex-1 rounded-[2px] transition-all ${
              i < active ? "bg-emerald-500/50" : "bg-foreground/5"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/40">
        <span>
          last hr: {lastHour.total} runs
        </span>
        {lastHour.total > 0 && (
          <>
            <span className="text-emerald-400/60">{lastHour.success} ok</span>
            {lastHour.failure > 0 && (
              <span className="text-red-400/60">{lastHour.failure} fail</span>
            )}
            {lastHour.avgDurationMs != null && (
              <span>avg {Math.round(lastHour.avgDurationMs / 1000)}s</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WeightsDisplay({ weights }: { weights: Record<string, number> }) {
  const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a);
  return (
    <div className="space-y-1">
      <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">
        P(merge) Weights
      </div>
      {sorted.map(([factor, weight]) => (
        <div
          key={factor}
          className="flex items-center gap-2 text-[10px] font-mono"
        >
          <span className="w-32 text-muted-foreground/60 truncate">
            {factor.replace(/_/g, " ")}
          </span>
          <div className="flex-1 h-[4px] bg-foreground/5 rounded-[2px] overflow-hidden">
            <div
              className="h-full rounded-[2px] bg-cyan-500/40 transition-all"
              style={{ width: `${weight}%` }}
            />
          </div>
          <span className="w-6 text-right tabular-nums text-foreground/60 shrink-0">
            {weight}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MergeProbabilityPanel() {
  const { data, isLoading } = useMergeProbability();

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!data) return null;

  const accLabel = accuracyLabels[data.modelAccuracy] || accuracyLabels.insufficient_data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Merge Probability</span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[9px] h-4 px-1.5 font-mono ${accLabel.color}`}
            >
              {accLabel.label}
            </Badge>
            {data.avgScore != null && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono tabular-nums"
              >
                avg {data.avgScore}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Coverage stat */}
        <div className="text-[10px] font-mono text-muted-foreground/50">
          {data.scored}/{data.total} PRs scored ({data.coveragePct}% coverage)
        </div>

        {/* Distribution histogram */}
        <DistributionBar distribution={data.distribution} total={data.scored} />

        {/* Accuracy table */}
        <AccuracyTable accuracy={data.accuracy} />

        {/* Slot utilization */}
        {data.slotUtilization && (
          <SlotUtilizationGauge
            active={data.slotUtilization.activeSlots}
            max={data.slotUtilization.maxSlots}
            lastHour={data.slotUtilization.lastHour}
          />
        )}

        {/* Weights */}
        <WeightsDisplay weights={data.weights.current} />

        {data.weights.note && (
          <div className="text-[9px] font-mono text-muted-foreground/30 leading-relaxed">
            {data.weights.note}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
