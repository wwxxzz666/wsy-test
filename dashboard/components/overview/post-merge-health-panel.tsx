"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePostMerge, type MergedPRHealth } from "@/lib/hooks/use-post-merge";

const healthConfig: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  healthy: { color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "healthy" },
  regressed: { color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500", label: "regressed" },
  unknown: { color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500", label: "monitoring" },
};

function MergedPRRow({ pr }: { pr: MergedPRHealth }) {
  const config = healthConfig[pr.health] || healthConfig.unknown;
  const shortRepo = pr.repo.includes("/") ? pr.repo.split("/")[1] : pr.repo;
  const owner = pr.repo.includes("/") ? pr.repo.split("/")[0] : "";

  return (
    <div className="py-2 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${config.dot}`} />
        <a
          href={pr.htmlUrl || `https://github.com/${pr.repo}/pull/${pr.number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium truncate hover:underline flex-1 min-w-0"
          title={pr.title}
        >
          {owner && <span className="text-muted-foreground/50">{owner}/</span>}
          {shortRepo}#{pr.number}
        </a>
        {pr.prType && (
          <span className="text-[8px] font-mono px-1 py-0.5 rounded-sm bg-muted/30 text-muted-foreground/50 shrink-0">
            {pr.prType}
          </span>
        )}
        <Badge
          variant="outline"
          className={`text-[9px] h-4 px-1 font-mono shrink-0 ${config.color} border-current/25`}
        >
          {config.label}
        </Badge>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/50 shrink-0">
          {pr.daysSinceMerge}d
        </span>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/30 shrink-0">
          {pr.diffSize}L
        </span>
      </div>
      {pr.signals.length > 0 && (
        <div className="ml-4 mt-1 space-y-0.5">
          {pr.signals.map((signal, i) => (
            <p key={i} className="text-[10px] font-mono text-muted-foreground/40">
              {signal}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryDots({ summary }: { summary: { healthy: number; regressed: number; unknown: number } }) {
  const total = summary.healthy + summary.regressed + summary.unknown;
  if (total === 0) return null;

  const segments: { count: number; color: string; label: string }[] = [
    { count: summary.healthy, color: "bg-emerald-500", label: "healthy" },
    { count: summary.unknown, color: "bg-amber-500", label: "monitoring" },
    { count: summary.regressed, color: "bg-red-500", label: "regressed" },
  ];

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-[6px] bg-foreground/5 rounded-[2px] overflow-hidden flex">
        {segments
          .filter((s) => s.count > 0)
          .map((seg) => (
            <div
              key={seg.label}
              className={`h-full ${seg.color}/50 transition-all`}
              style={{ width: `${(seg.count / total) * 100}%` }}
              title={`${seg.count} ${seg.label}`}
            />
          ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums shrink-0">
        {summary.healthy > 0 && (
          <span className="text-emerald-400/70">{summary.healthy} ok</span>
        )}
        {summary.unknown > 0 && (
          <span className="text-amber-400/70">{summary.unknown} watch</span>
        )}
        {summary.regressed > 0 && (
          <span className="text-red-400/70">{summary.regressed} bad</span>
        )}
      </div>
    </div>
  );
}

export function PostMergeHealthPanel() {
  const { data, isLoading } = usePostMerge();

  if (isLoading) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Post-Merge Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-6 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.mergedPRs.length === 0) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Post-Merge Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No merged PRs yet</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
              Regression tracking begins after PRs are merged
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, mergedPRs } = data;
  const hasRegression = summary.regressed > 0;

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Post-Merge Health</span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-mono text-muted-foreground/60 border-muted-foreground/20"
            >
              {summary.total} merged
            </Badge>
            {hasRegression && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-red-400 border-red-500/25"
              >
                {summary.regressed} regression{summary.regressed !== 1 ? "s" : ""}
              </Badge>
            )}
            {summary.healthRate != null && summary.healthRate > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-emerald-400 border-emerald-500/25"
              >
                {summary.healthRate}% clean
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryDots summary={summary} />

        <div className="space-y-0.5">
          {/* Header row */}
          <div className="flex items-center gap-2 px-2 -mx-2 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider pb-1">
            <span className="w-2" />
            <span className="flex-1">pr</span>
            <span>status / age / size</span>
          </div>
          {mergedPRs.map((pr) => (
            <MergedPRRow key={`${pr.repo}#${pr.number}`} pr={pr} />
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-foreground/[0.04]">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
            <span>
              monitoring window: <span className="text-foreground/50">3 days min</span>
            </span>
            <span>
              checks: <span className="text-foreground/50">issues, reverts, commits</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
