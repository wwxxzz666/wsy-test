"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActionItems, type ActionItem } from "@/lib/hooks/use-action-items";
import { useState } from "react";

const priorityStyles: Record<string, { color: string; bg: string; border: string }> = {
  P0: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  P1: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  P2: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

const categoryLabels: Record<string, string> = {
  targeting: "TARGETING",
  quality: "QUALITY",
  volume: "VOLUME",
  tooling: "TOOLING",
  followup: "FOLLOW-UP",
};

function ActionItemRow({ item }: { item: ActionItem }) {
  const style = priorityStyles[item.priority] || priorityStyles.P2;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-md border ${style.border} ${style.bg} transition-colors cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Badge
          variant="outline"
          className={`text-[9px] h-4 px-1 font-mono shrink-0 mt-0.5 ${style.color} border-current/25`}
        >
          {item.priority}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-medium ${style.color}`}>
              {item.title}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-foreground/5 text-muted-foreground/40">
              {categoryLabels[item.category] || item.category}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/30 truncate">
              {item.dataPoint}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/20 shrink-0">
          {expanded ? "[-]" : "[+]"}
        </span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-foreground/[0.03] mt-1 pt-2">
          <div>
            <div className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-0.5">
              Problem
            </div>
            <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
              {item.problem}
            </p>
          </div>
          <div>
            <div className="text-[8px] font-mono text-emerald-400/40 uppercase tracking-wider mb-0.5">
              Suggested Fix
            </div>
            <p className="text-[10px] font-mono text-emerald-400/60 leading-relaxed">
              {item.suggestedFix}
            </p>
          </div>
          <div>
            <div className="text-[8px] font-mono text-cyan-400/40 uppercase tracking-wider mb-0.5">
              Expected Impact
            </div>
            <p className="text-[10px] font-mono text-cyan-400/50 leading-relaxed">
              {item.impactEstimate}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ActionItemsPanel() {
  const { data, isLoading } = useActionItems();

  if (isLoading) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-emerald-400/70">No action items</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
              All metrics are within acceptable ranges
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { items, summary, context } = data;

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Action Items for Prompt Architect</span>
          <div className="flex items-center gap-2">
            {summary.p0 > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-red-400 border-red-500/25"
              >
                {summary.p0} P0
              </Badge>
            )}
            {summary.p1 > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-orange-400 border-orange-500/25"
              >
                {summary.p1} P1
              </Badge>
            )}
            {summary.p2 > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-amber-400 border-amber-500/25"
              >
                {summary.p2} P2
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Context bar */}
        <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/30 flex-wrap">
          <span>
            PRs: <span className="text-foreground/40 tabular-nums">{context.totalPRs}</span>
          </span>
          <span>
            merge: <span className={`tabular-nums ${context.mergeRate >= 32.7 ? "text-emerald-400/60" : "text-red-400/60"}`}>
              {context.mergeRate}%
            </span>
          </span>
          <span>
            review: <span className={`tabular-nums ${context.reviewRate >= 50 ? "text-emerald-400/60" : "text-red-400/60"}`}>
              {context.reviewRate}%
            </span>
          </span>
          <span>
            oversized: <span className={`tabular-nums ${context.oversizedRate <= 20 ? "text-emerald-400/60" : "text-red-400/60"}`}>
              {context.oversizedRate}%
            </span>
          </span>
        </div>

        {/* Items */}
        <div className="space-y-2">
          {items.map((item) => (
            <ActionItemRow key={item.id} item={item} />
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-foreground/[0.04]">
          <p className="text-[9px] font-mono text-muted-foreground/25 leading-relaxed">
            Click items to expand. Fix P0 items first — they have the highest impact on merge rate.
            Data refreshes every 2 minutes from live PR metrics.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
