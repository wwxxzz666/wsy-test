"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePRSizes, type PRSizeBucket } from "@/lib/hooks/use-pr-sizes";

function HistogramBar({ bucket, maxCount }: { bucket: PRSizeBucket; maxCount: number }) {
  const barHeight = maxCount > 0 ? Math.max((bucket.total / maxCount) * 100, 4) : 4;

  // Color: sweet spot = emerald, outside = muted, with merge overlay
  const barColor = bucket.inSweetSpot
    ? "bg-emerald-500/50"
    : "bg-foreground/15";
  const mergedColor = bucket.inSweetSpot
    ? "bg-emerald-400"
    : "bg-emerald-500/40";
  const mergedHeight =
    bucket.total > 0 ? (bucket.merged / bucket.total) * barHeight : 0;

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      {/* Bar */}
      <div className="w-full h-20 flex flex-col justify-end relative">
        {/* Total bar */}
        <div
          className={`w-full rounded-t-[2px] transition-all duration-500 relative ${barColor}`}
          style={{ height: `${barHeight}%` }}
        >
          {/* Merged overlay at bottom */}
          {mergedHeight > 0 && (
            <div
              className={`absolute bottom-0 left-0 right-0 rounded-t-[1px] ${mergedColor}`}
              style={{ height: `${(mergedHeight / barHeight) * 100}%` }}
            />
          )}
        </div>
      </div>
      {/* Count */}
      <span className="text-[9px] font-mono tabular-nums text-foreground/50">
        {bucket.total}
      </span>
      {/* Label */}
      <span
        className={`text-[8px] font-mono leading-none ${
          bucket.inSweetSpot
            ? "text-emerald-400/70"
            : "text-muted-foreground/30"
        }`}
      >
        {bucket.label}
      </span>
      {/* Merge rate */}
      {bucket.total > 0 && (
        <span
          className={`text-[7px] font-mono tabular-nums ${
            bucket.mergeRate > 0
              ? "text-emerald-400/50"
              : "text-muted-foreground/20"
          }`}
        >
          {bucket.mergeRate}%
        </span>
      )}
    </div>
  );
}

export function PRSizeHistogram() {
  const { buckets, summary, isLoading } = usePRSizes();

  const maxCount = buckets
    ? Math.max(...buckets.map((b) => b.total), 1)
    : 1;

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>PR Size Distribution</span>
          <div className="flex items-center gap-2">
            {summary && (
              <Badge
                variant="outline"
                className={`text-[10px] h-4 px-1.5 font-mono ${
                  summary.sweetSpotRatio >= 60
                    ? "text-emerald-400 border-emerald-500/25"
                    : summary.sweetSpotRatio >= 30
                      ? "text-amber-400 border-amber-500/25"
                      : "text-red-400 border-red-500/25"
                }`}
              >
                {summary.sweetSpotRatio}% in sweet spot
              </Badge>
            )}
            {summary && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-muted-foreground/50 border-muted-foreground/15"
              >
                median: {summary.medianSize}L
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-28 rounded bg-muted/30 animate-pulse" />
        ) : !buckets || buckets.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No PR data yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Sweet spot indicator */}
            <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/50" />
              <span>sweet spot: 25-100 lines (ideal: ~50)</span>
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/15 ml-2" />
              <span>outside range</span>
              <span className="ml-auto text-muted-foreground/20">solid = merged</span>
            </div>

            {/* Histogram bars */}
            <div className="flex items-end gap-1 px-1">
              {buckets.map((bucket) => (
                <HistogramBar
                  key={bucket.label}
                  bucket={bucket}
                  maxCount={maxCount}
                />
              ))}
            </div>

            {/* X-axis label */}
            <div className="text-center text-[8px] font-mono text-muted-foreground/20 uppercase tracking-wider">
              lines changed (additions + deletions)
            </div>

            {/* Summary stats */}
            {summary && (
              <div className="pt-2 border-t border-foreground/[0.04]">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
                  <span>
                    avg: <span className="text-foreground/60 tabular-nums">{summary.avgSize}L</span>
                    <span className="text-muted-foreground/20"> | </span>
                    median: <span className="text-foreground/60 tabular-nums">{summary.medianSize}L</span>
                    {summary.medianSize > 100 && (
                      <span className="text-red-400/50 ml-1">above sweet spot</span>
                    )}
                  </span>
                  <span>
                    sweet spot merge:{" "}
                    <span
                      className={`tabular-nums ${
                        summary.sweetSpotMergeRate > summary.outsideMergeRate
                          ? "text-emerald-400"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      {summary.sweetSpotMergeRate}%
                    </span>
                    <span className="text-muted-foreground/20"> vs </span>
                    <span className="text-muted-foreground/50 tabular-nums">
                      {summary.outsideMergeRate}%
                    </span>
                    <span className="text-muted-foreground/20"> outside</span>
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
