"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDirectives, type DirectiveEntry } from "@/lib/hooks/use-directives";

const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
  critical: {
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    text: "text-red-400",
  },
  warning: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
  info: {
    bg: "bg-cyan-500/5",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
  },
};

function classifyDirective(text: string): "critical" | "warning" | "info" {
  const upper = text.toUpperCase();
  if (upper.startsWith("MERGE NOW") || upper.startsWith("BLOCKLISTED")) return "critical";
  if (upper.includes("CRITICAL") || upper.includes("BAN")) return "critical";
  if (upper.includes("TOO MANY") || upper.includes("REWORK") || upper.includes("SLOW")) return "warning";
  return "info";
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  } catch {
    return "--";
  }
}

function DirectiveRow({ entry }: { entry: DirectiveEntry }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/30">
        <span>{formatTimestamp(entry.timestamp)}</span>
        {entry.stats && (
          <>
            <span className="text-muted-foreground/15">|</span>
            <span>
              {entry.stats.total} total, {entry.stats.merged} merged, {entry.stats.open} open
            </span>
          </>
        )}
      </div>
      {entry.directives.map((directive, i) => {
        const severity = classifyDirective(directive);
        const style = severityStyles[severity];
        return (
          <div
            key={`${entry.id}-${i}`}
            className={`px-2 py-1.5 rounded-md border ${style.bg} ${style.border}`}
          >
            <p className={`text-[10px] font-mono ${style.text} truncate leading-relaxed`} title={directive}>
              {directive}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function DirectivesPanel() {
  const { data, isLoading } = useDirectives(10);

  if (isLoading) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Agent Directives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Agent Directives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-emerald-400/70">No directives</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
              Agent is operating without corrections
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDirectives = data.entries.reduce((acc, e) => acc + e.directives.length, 0);

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Agent Directives</span>
          <span className="text-[10px] font-mono text-muted-foreground/40 font-normal">
            {totalDirectives} in last {data.entries.length} checks
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3 max-h-[320px] overflow-y-auto">
          {data.entries.map((entry) => (
            <DirectiveRow key={entry.id} entry={entry} />
          ))}
        </div>
        <div className="pt-2 border-t border-foreground/[0.04]">
          <p className="text-[9px] font-mono text-muted-foreground/25 leading-relaxed">
            Directives are sent to the agent via the health-check endpoint each heartbeat cycle.
            They auto-correct targeting, pacing, and follow-up behavior.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
