"use client";

import { Card, CardContent } from "@/components/ui/card";
import { SlotGrid } from "@/components/overview/slot-grid";
import { useSubagentHealth } from "@/lib/hooks/use-subagent-health";

function StatusSummary({
  totalActive,
  totalSlots,
  lastUpdated,
}: {
  totalActive: number;
  totalSlots: number;
  lastUpdated: string | null;
}) {
  const pct = totalSlots > 0 ? Math.round((totalActive / totalSlots) * 100) : 0;
  const color =
    pct >= 70
      ? "text-emerald-400"
      : pct >= 40
        ? "text-amber-400"
        : pct > 0
          ? "text-red-400"
          : "text-muted-foreground/40";

  const agoText = lastUpdated ? formatTimeAgo(lastUpdated) : "no data";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 font-mono text-xs">
        <span className="stat-label">Agent Slots</span>
        <span className="text-[10px] text-muted-foreground/40">(3+7)</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-[10px]">
        <span className={`tabular-nums font-medium ${color}`}>
          {totalActive}/{totalSlots}
        </span>
        <span className="text-muted-foreground/25">{agoText}</span>
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 bg-foreground/5 rounded" />
        <div className="h-3 w-16 bg-foreground/5 rounded" />
      </div>
      <div>
        <div className="h-2 w-14 bg-foreground/5 rounded mb-1.5" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-foreground/5 rounded-md" />
          ))}
        </div>
      </div>
      <div className="h-[1px] bg-foreground/5" />
      <div>
        <div className="h-2 w-20 bg-foreground/5 rounded mb-1.5" />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 bg-foreground/5 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SubagentHealthPanel() {
  const { data, error, isLoading } = useSubagentHealth();

  return (
    <Card className="accent-top corner-brackets card-elevated">
      <CardContent className="p-5">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error || !data ? (
          <div className="font-mono text-xs text-red-400/60">
            Failed to load subagent health
          </div>
        ) : (
          <div className="space-y-4">
            <StatusSummary
              totalActive={data.totalActive}
              totalSlots={data.totalSlots}
              lastUpdated={data.lastUpdated}
            />
            <SlotGrid
              alwaysOn={data.alwaysOn}
              implSlots={data.implSlots}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
