"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTokens, formatCost } from "@/lib/utils";

interface FunnelData {
  submitted: number;
  reviewed: number;
  merged: number;
  rejected: number;
  open: number;
}

interface MetricCardsProps {
  totalPRs: number;
  mergeRate: number;
  inputTokensToday: number;
  outputTokensToday: number;
  costToday: number;
  activeModel?: string;
  funnel?: FunnelData;
  costPerMerge?: number;
  tokensPerMerge?: number;
  avgHoursToReview?: number | null;
}

function MiniBar({
  value,
  max,
  segments = 12,
  color,
}: {
  value: number;
  max: number;
  segments?: number;
  color?: string;
}) {
  const filled = Math.round((value / Math.max(max, 1)) * segments);
  const barColor = color || "bg-emerald-500/50";
  return (
    <div className="flex gap-[2px] mt-2" aria-hidden="true">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-[1px] transition-all ${
            i < filled ? barColor : "bg-foreground/5"
          }`}
        />
      ))}
    </div>
  );
}

function FunnelStage({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barWidth = total > 0 ? Math.max((count / total) * 100, 4) : 4;
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="w-16 text-right text-muted-foreground/50 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-[6px] bg-foreground/5 rounded-[2px] overflow-hidden">
        <div
          className={`h-full rounded-[2px] transition-all ${color}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="w-8 text-right tabular-nums text-foreground/60 shrink-0">
        {count}
      </span>
      <span className="w-10 text-right tabular-nums text-muted-foreground/30 shrink-0">
        {pct}%
      </span>
    </div>
  );
}

function formatReviewTime(hours: number | null | undefined): string {
  if (hours == null || hours <= 0) return "--";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function reviewTimeLabel(hours: number | null | undefined): string | null {
  if (hours == null || hours <= 0) return null;
  if (hours <= 24) return "fast response";
  if (hours <= 72) return "moderate response";
  return "slow response";
}

export function MetricCards({
  totalPRs,
  mergeRate,
  inputTokensToday,
  outputTokensToday,
  costToday,
  activeModel,
  funnel,
  costPerMerge,
  tokensPerMerge,
  avgHoursToReview,
}: MetricCardsProps) {
  const mergeColor =
    mergeRate >= 50
      ? "text-emerald-400"
      : mergeRate >= 25
        ? "text-amber-400"
        : mergeRate > 0
          ? "text-red-400"
          : "text-muted-foreground/40";

  const cards = [
    {
      label: "Input/24h",
      value: formatTokens(inputTokensToday),
      sub: inputTokensToday > 0 ? "prompt tokens" : null,
      bar: { value: Math.min(inputTokensToday / 1000, 500), max: 500 },
      barColor: "bg-cyan-500/40",
    },
    {
      label: "Output/24h",
      value: formatTokens(outputTokensToday),
      sub: outputTokensToday > 0 ? "completion tokens" : null,
      bar: { value: Math.min(outputTokensToday / 1000, 200), max: 200 },
      barColor: "bg-violet-500/40",
    },
    {
      label: "Cost/24h",
      value: formatCost(costToday),
      sub: costToday > 0 ? activeModel || "active model" : null,
      bar: { value: costToday, max: 5 },
    },
    {
      label: "$/Merge",
      value: costPerMerge && costPerMerge > 0 ? formatCost(costPerMerge) : "--",
      sub: costPerMerge && costPerMerge > 0 ? "avg cost per merged PR" : null,
      bar: { value: costPerMerge || 0, max: 10 },
      barColor: "bg-amber-500/40",
    },
    {
      label: "Tok/Merge",
      value: tokensPerMerge && tokensPerMerge > 0 ? formatTokens(tokensPerMerge) : "--",
      sub: tokensPerMerge && tokensPerMerge > 0 ? "efficiency metric" : null,
      bar: { value: Math.min((tokensPerMerge || 0) / 1000, 500), max: 500 },
      barColor: "bg-violet-500/40",
    },
    {
      label: "Review Time",
      value: formatReviewTime(avgHoursToReview),
      sub: reviewTimeLabel(avgHoursToReview),
      bar: { value: Math.min(avgHoursToReview || 0, 72), max: 72 },
      barColor: avgHoursToReview != null && avgHoursToReview <= 24
        ? "bg-emerald-500/40"
        : avgHoursToReview != null && avgHoursToReview <= 72
          ? "bg-amber-500/40"
          : "bg-red-500/40",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Hero: Merge Rate + Funnel */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Hero merge rate */}
        <Card className="metric-card card-lift card-elevated accent-top corner-brackets">
          <CardContent className="p-6">
            <div className="stat-label">Merge Rate</div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-5xl font-bold tabular-nums tracking-tighter ${mergeColor}`}>
                {mergeRate > 0 ? mergeRate.toFixed(1) : "--"}
              </span>
              {mergeRate > 0 && (
                <span className={`text-xl font-bold ${mergeColor} opacity-60`}>%</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono ${
                mergeRate >= 20
                  ? "bg-emerald-500/10 text-emerald-400"
                  : mergeRate >= 10
                    ? "bg-amber-500/10 text-amber-400"
                    : mergeRate > 0
                      ? "bg-red-500/10 text-red-400"
                      : "bg-foreground/5 text-muted-foreground/40"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  mergeRate >= 20 ? "bg-emerald-500" : mergeRate >= 10 ? "bg-amber-500" : mergeRate > 0 ? "bg-red-500" : "bg-foreground/20"
                }`} />
                {mergeRate >= 30 ? "strong" : mergeRate >= 20 ? "healthy" : mergeRate >= 10 ? "warming up" : mergeRate > 0 ? "needs work" : "no data"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/40 mt-3 flex items-center gap-2 flex-wrap">
              <span>{totalPRs} submitted</span>
              <span className="text-muted-foreground/15">|</span>
              <span className="text-emerald-400/70">{funnel?.merged || 0} merged</span>
              <span className="text-muted-foreground/15">|</span>
              <span className="text-red-400/70">{funnel?.rejected || 0} rejected</span>
              <span className="text-muted-foreground/15">|</span>
              <span>{funnel?.open || 0} open</span>
            </div>
            <MiniBar
              value={mergeRate}
              max={100}
              segments={20}
              color={
                mergeRate >= 20
                  ? "bg-emerald-500/50"
                  : mergeRate >= 10
                    ? "bg-amber-500/50"
                    : "bg-red-500/50"
              }
            />
            {/* Competitor benchmark reference lines (MSR 2026 study data) */}
            <div className="relative h-3 mt-2">
              <div className="absolute inset-x-0 top-1 h-[1px] bg-foreground/[0.04]" />
              {[
                { label: "AI avg", pct: 32.7, color: "text-muted-foreground/25" },
                { label: "Copilot", pct: 35, color: "text-muted-foreground/30" },
                { label: "Devin", pct: 49, color: "text-muted-foreground/40" },
                { label: "Codex", pct: 64, color: "text-emerald-400/40" },
              ].map((b) => (
                <div
                  key={b.label}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: `${b.pct}%`, transform: "translateX(-50%)" }}
                >
                  <div className="h-2.5 w-[1px] bg-foreground/10" />
                  <span className={`text-[7px] font-mono leading-none mt-0.5 ${b.color}`}>
                    {b.label} {b.pct}%
                  </span>
                </div>
              ))}
              {/* Our position marker */}
              {mergeRate > 0 && (
                <div
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: `${Math.min(mergeRate, 100)}%`, transform: "translateX(-50%)" }}
                >
                  <div className={`h-2.5 w-[2px] rounded-full ${
                    mergeRate >= 20 ? "bg-emerald-500" : mergeRate >= 10 ? "bg-amber-500" : "bg-red-500"
                  }`} />
                  <span className={`text-[7px] font-mono font-bold leading-none mt-0.5 ${mergeColor}`}>
                    us {mergeRate.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PR Funnel */}
        {funnel && (
          <Card className="metric-card card-lift">
            <CardContent className="p-6 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <div className="stat-label">PR Funnel</div>
                {funnel.submitted > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground/30 tabular-nums">
                    {funnel.submitted > 0 ? `${Math.round((funnel.reviewed / funnel.submitted) * 100)}% reviewed` : ""}
                    {funnel.reviewed > 0 ? ` / ${Math.round((funnel.merged / funnel.reviewed) * 100)}% of reviews merged` : ""}
                  </span>
                )}
              </div>
              <FunnelStage
                label="submit"
                count={funnel.submitted}
                total={funnel.submitted}
                color="bg-foreground/30"
              />
              <FunnelStage
                label="review"
                count={funnel.reviewed}
                total={funnel.submitted}
                color="bg-cyan-500/50"
              />
              <FunnelStage
                label="merge"
                count={funnel.merged}
                total={funnel.submitted}
                color="bg-emerald-500/50"
              />
              <FunnelStage
                label="reject"
                count={funnel.rejected}
                total={funnel.submitted}
                color="bg-red-500/40"
              />
              <FunnelStage
                label="open"
                count={funnel.open}
                total={funnel.submitted}
                color="bg-amber-500/40"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label} className="metric-card card-lift">
            <CardContent className="p-4 pb-3">
              <div className="stat-label">{card.label}</div>
              <div className="stat-value mt-1.5 tabular-nums">{card.value}</div>
              {card.sub && (
                <div className="text-[10px] font-mono text-muted-foreground/35 mt-1">
                  {card.sub}
                </div>
              )}
              <MiniBar
                value={card.bar.value}
                max={card.bar.max}
                color={card.barColor}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
