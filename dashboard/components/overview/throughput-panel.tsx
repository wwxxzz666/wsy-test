"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useThroughput } from "@/lib/hooks/use-throughput";

function SlotBar({ used, total }: { used: number; total: number }) {
  return (
    <div className="flex gap-[3px]" aria-label={`${used} of ${total} slots used`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-[8px] flex-1 rounded-[2px] transition-all ${
            i < used
              ? "bg-cyan-500/60"
              : "bg-foreground/5"
          }`}
        />
      ))}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const height = 28;
  const width = 100;
  const stepX = width / (data.length - 1 || 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  });
  const polyline = points.join(" ");

  // Fill area
  const fillPoints = [
    `0,${height}`,
    ...points,
    `${width},${height}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-7"
      preserveAspectRatio="none"
    >
      <polygon points={fillPoints} className="fill-cyan-500/10" />
      <polyline
        points={polyline}
        fill="none"
        className="stroke-cyan-500/40"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThroughputPanel() {
  const { data, isLoading } = useThroughput();

  const isIdle = data && data.slotsUsed === 0;
  const slotUtilPct = data ? Math.round((data.slotsUsed / data.totalSlots) * 100) : 0;

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Throughput</span>
          <div className="flex items-center gap-2">
            {data && data.prsToday > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-emerald-400 border-emerald-500/25"
              >
                {data.prsToday} PR{data.prsToday !== 1 ? "s" : ""} today
              </Badge>
            )}
            {isIdle && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-amber-400 border-amber-500/25 bg-amber-500/8"
              >
                IDLE
              </Badge>
            )}
          </div>
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
            {/* Idle warning banner */}
            {isIdle && data.idleCycles >= 2 && (
              <div className="px-3 py-2 rounded-md bg-amber-500/8 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-mono text-amber-400 font-medium">
                    IDLE — 0 slots used for {data.idleCycles} cycles
                  </span>
                </div>
              </div>
            )}

            {/* Slot utilization */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  slots
                </span>
                <span className="text-sm font-bold tabular-nums">
                  <span className={data.slotsUsed > 0 ? "text-cyan-400" : "text-muted-foreground/40"}>
                    {data.slotsUsed}
                  </span>
                  <span className="text-muted-foreground/30">/{data.totalSlots}</span>
                  <span className="text-[10px] font-normal text-muted-foreground/30 ml-1">
                    ({slotUtilPct}%)
                  </span>
                </span>
              </div>
              <SlotBar used={data.slotsUsed} total={data.totalSlots} />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  PRs today
                </div>
                <div className={`text-lg font-bold tabular-nums ${data.prsToday > 0 ? "text-foreground/80" : "text-muted-foreground/40"}`}>
                  {data.prsToday}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  merged today
                </div>
                <div className={`text-lg font-bold tabular-nums ${data.mergedToday > 0 ? "text-emerald-400" : "text-muted-foreground/40"}`}>
                  {data.mergedToday}
                </div>
              </div>
            </div>

            {/* Avg spawn to submit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  avg spawn-to-submit
                </div>
                <div className="text-lg font-bold tabular-nums text-foreground/60">
                  {data.avgSpawnToSubmit > 0 ? `${data.avgSpawnToSubmit}m` : "--"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  idle cycles (3h)
                </div>
                <div className={`text-lg font-bold tabular-nums ${data.idleCycles > 5 ? "text-amber-400" : "text-foreground/60"}`}>
                  {data.idleCycles}
                </div>
              </div>
            </div>

            {/* Hourly sparkline */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  hourly PRs (12h)
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/30 tabular-nums">
                  total: {data.hourlyPRs.reduce((a, b) => a + b, 0)}
                </span>
              </div>
              <Sparkline data={data.hourlyPRs} />
              <div className="flex justify-between text-[8px] font-mono text-muted-foreground/20 mt-0.5">
                <span>-12h</span>
                <span>now</span>
              </div>
            </div>

            {/* Summary footer */}
            <div className="pt-2 border-t border-foreground/[0.04]">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
                <span>
                  {data.slotsUsed > 0 ? (
                    <span className="text-cyan-400/70">{data.slotsUsed} active</span>
                  ) : (
                    <span className="text-muted-foreground/30">no active slots</span>
                  )}
                </span>
                <span className="tabular-nums">
                  {data.prsToday} created / {data.mergedToday} merged today
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
