"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAutonomy, type PromptGap, type AutonomySnapshot } from "@/lib/hooks/use-autonomy";

const severityConfig: Record<string, { color: string; bg: string; dot: string }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
  high: { color: "text-orange-400", bg: "bg-orange-500/10", dot: "bg-orange-500" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  low: { color: "text-muted-foreground", bg: "bg-muted/30", dot: "bg-muted-foreground" },
};

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 70
      ? "text-emerald-400 border-emerald-500/40"
      : score >= 40
        ? "text-amber-400 border-amber-500/40"
        : "text-red-400 border-red-500/40";

  const label =
    score >= 70
      ? "healthy"
      : score >= 40
        ? "needs work"
        : "broken";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 font-bold text-xl font-mono tabular-nums ${color}`}
      >
        {score}
      </div>
      <span className={`text-[9px] font-mono ${color} opacity-70`}>{label}</span>
    </div>
  );
}

function Sparkline({ data }: { data: AutonomySnapshot[] }) {
  if (data.length < 2) return null;
  const scores = data.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores, 1);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const latest = scores[scores.length - 1];
  const first = scores[0];
  const trend = latest > first ? "text-emerald-400" : latest < first ? "text-red-400" : "text-muted-foreground";
  const strokeColor = latest > first ? "#34d399" : latest < first ? "#f87171" : "#888";

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="opacity-60">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-[9px] font-mono tabular-nums ${trend}`}>
        {latest > first ? "+" : ""}{latest - first}
      </span>
    </div>
  );
}

function PenaltyBar({
  label,
  count,
  penalty,
  maxPenalty,
}: {
  label: string;
  count: number;
  penalty: number;
  maxPenalty: number;
}) {
  if (count === 0) return null;
  const width = Math.max((penalty / maxPenalty) * 100, 8);
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="w-24 text-right text-muted-foreground/50 shrink-0">{label}</span>
      <div className="flex-1 h-[6px] bg-foreground/5 rounded-[2px] overflow-hidden">
        <div
          className="h-full rounded-[2px] bg-red-500/40 transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-6 text-right tabular-nums text-red-400/70 shrink-0">
        -{penalty}
      </span>
      <span className="w-10 text-right tabular-nums text-muted-foreground/30 shrink-0">
        ({count})
      </span>
    </div>
  );
}

function PromptGapRow({ gap }: { gap: PromptGap }) {
  const config = severityConfig[gap.severity] || severityConfig.low;
  return (
    <div className="py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dot}`} />
        <span className={`text-xs font-medium flex-1 ${config.color}`}>
          {gap.name}
        </span>
        <Badge
          variant="outline"
          className={`text-[9px] h-4 px-1 font-mono shrink-0 ${config.color} border-current/25`}
        >
          {gap.severity}
        </Badge>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/50 shrink-0">
          x{gap.count}
        </span>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground/40 ml-3.5 mt-0.5">
        {gap.evidence}
      </p>
    </div>
  );
}

export function AutonomyHealthPanel() {
  const { data, isLoading } = useAutonomy();

  if (isLoading) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Autonomy Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const gapCount = data.promptGaps.length;
  const hasIssues = gapCount > 0;

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Autonomy Health</span>
          <div className="flex items-center gap-2">
            {gapCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-red-400 border-red-500/25"
              >
                {gapCount} prompt {gapCount === 1 ? "gap" : "gaps"}
              </Badge>
            )}
            {data.deadRepoTargets.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-amber-400 border-amber-500/25"
              >
                {data.deadRepoTargets.length} dead targets
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score + trend + penalties side by side */}
        <div className="flex items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <ScoreRing score={data.autonomyScore} />
            {data.history && data.history.length >= 2 && (
              <Sparkline data={data.history} />
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-2">
              Score Breakdown
            </div>

            {/* Bonuses */}
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="w-24 text-right text-muted-foreground/50 shrink-0">base</span>
              <span className="text-foreground/50 tabular-nums">40</span>
            </div>
            {data.bonuses.mergeRate > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="w-24 text-right text-muted-foreground/50 shrink-0">merge rate</span>
                <span className="text-emerald-400/70 tabular-nums">+{data.bonuses.mergeRate}</span>
              </div>
            )}
            {data.bonuses.reviewRate > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="w-24 text-right text-muted-foreground/50 shrink-0">review rate</span>
                <span className="text-emerald-400/70 tabular-nums">+{data.bonuses.reviewRate}</span>
              </div>
            )}

            {/* Penalties */}
            <PenaltyBar
              label="duplicates"
              count={data.penalties.duplicates.count}
              penalty={data.penalties.duplicates.penalty}
              maxPenalty={25}
            />
            <PenaltyBar
              label="oversized"
              count={data.penalties.oversized.count}
              penalty={data.penalties.oversized.penalty}
              maxPenalty={15}
            />
            <PenaltyBar
              label="wasted"
              count={data.penalties.wasted.count}
              penalty={data.penalties.wasted.penalty}
              maxPenalty={20}
            />
          </div>
        </div>

        {/* Prompt gaps */}
        {hasIssues && (
          <div>
            <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-2">
              Detected Prompt Gaps
            </div>
            <div className="space-y-0.5">
              {data.promptGaps.map((gap) => (
                <PromptGapRow key={gap.id} gap={gap} />
              ))}
            </div>
          </div>
        )}

        {/* Duplicate repos detail */}
        {data.duplicateRepos.length > 0 && (
          <div>
            <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-2">
              Repos with Duplicate PRs
            </div>
            <div className="space-y-1">
              {data.duplicateRepos.slice(0, 5).map((dup) => (
                <div
                  key={dup.repo}
                  className="flex items-center gap-2 text-[10px] font-mono py-1 px-2 -mx-2 rounded-md hover:bg-muted/40"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  <a
                    href={`https://github.com/${dup.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/70 hover:underline truncate"
                  >
                    {dup.repo}
                  </a>
                  <span className="text-red-400/70 tabular-nums shrink-0">
                    {dup.prCount} PRs
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Oversized PRs detail */}
        {data.oversizedPRs.length > 0 && (
          <div>
            <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-2">
              Oversized PRs (&gt;200 lines)
            </div>
            <div className="space-y-1">
              {data.oversizedPRs.slice(0, 5).map((pr) => (
                <div
                  key={`${pr.repo}#${pr.number}`}
                  className="flex items-center gap-2 text-[10px] font-mono py-1 px-2 -mx-2 rounded-md hover:bg-muted/40"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                  <a
                    href={pr.htmlUrl || `https://github.com/${pr.repo}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/70 hover:underline truncate flex-1"
                    title={pr.title}
                  >
                    {pr.repo}#{pr.number}
                  </a>
                  <span className="text-orange-400/70 tabular-nums shrink-0">
                    {pr.diffSize}L
                  </span>
                  <span className="text-muted-foreground/30 tabular-nums shrink-0">
                    {pr.filesChanged}f
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failure categories */}
        {data.failureCategories && (() => {
          const cats = data.failureCategories;
          const totalFailures = Object.values(cats).reduce((s, c) => s + c.count, 0);
          if (totalFailures === 0) return null;
          const categoryLabels: Record<string, { label: string; color: string }> = {
            no_review: { label: "No Review (bad targeting)", color: "text-red-400/70" },
            quick_reject: { label: "Auto-Rejected (CI/policy)", color: "text-orange-400/70" },
            changes_requested: { label: "Fix Rejected", color: "text-amber-400/70" },
            scope_reject: { label: "Scope Too Large", color: "text-violet-400/70" },
            duplicate: { label: "Duplicate Closed", color: "text-red-400/70" },
          };
          return (
            <div>
              <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-2">
                Failure Categories ({totalFailures} closed)
              </div>
              <div className="space-y-1">
                {Object.entries(cats)
                  .filter(([, v]) => v.count > 0)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([key, val]) => {
                    const cfg = categoryLabels[key] || { label: key, color: "text-muted-foreground" };
                    const pct = totalFailures > 0 ? Math.round((val.count / totalFailures) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="w-36 text-right text-muted-foreground/50 shrink-0 truncate" title={cfg.label}>
                          {cfg.label}
                        </span>
                        <div className="flex-1 h-[6px] bg-foreground/5 rounded-[2px] overflow-hidden">
                          <div
                            className="h-full rounded-[2px] bg-red-500/30 transition-all"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                        <span className={`w-6 text-right tabular-nums shrink-0 ${cfg.color}`}>
                          {val.count}
                        </span>
                        <span className="w-10 text-right tabular-nums text-muted-foreground/30 shrink-0">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

        {/* Summary footer */}
        <div className="pt-2 border-t border-foreground/[0.04]">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40 flex-wrap gap-1">
            <span>
              pipeline: {data.pipeline.total} submitted{" "}
              <span className="text-muted-foreground/20">|</span>{" "}
              <span className="text-cyan-400/60">{data.pipeline.reviewRate}% reviewed</span>{" "}
              <span className="text-muted-foreground/20">|</span>{" "}
              <span className="text-emerald-400/60">{data.pipeline.mergeRate}% merged</span>
            </span>
            {data.subagentStats.total > 0 && (
              <span>
                subagents: {data.subagentStats.success}/{data.subagentStats.total} success
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
