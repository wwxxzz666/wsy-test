"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgentState } from "@/lib/hooks/use-agent-state";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface FunnelStage {
  label: string;
  count: number;
  color: string;
  textColor: string;
}

export function DiscoveryPipeline() {
  const { data: stateData } = useAgentState();
  const { data: overviewData } = useSWR<{
    stats: {
      totalPRs: number;
      mergedPRs: number;
      openPRs: number;
      closedPRs: number;
      reviewedPRs: number;
    };
  }>("/api/metrics/overview", fetcher, { refreshInterval: 30_000 });

  // Work queue = discovered/triaged issues
  const workQueue = stateData?.state?.workQueue;
  const queueLength = Array.isArray(workQueue) ? workQueue.length : 0;

  // Pipeline state — issues triaged is queue + PRs submitted (everything that passed triage)
  const pipelineState = stateData?.state?.pipelineState;
  const statsToday = pipelineState?.statsToday;

  const totalPRs = overviewData?.stats?.totalPRs || 0;
  const mergedPRs = overviewData?.stats?.mergedPRs || 0;

  // Heuristic: discovered = queue + all PRs ever submitted (issues that entered the pipeline)
  // Triaged = same as discovered for now (everything in queue passed triage)
  // Submitted = totalPRs
  // Merged = mergedPRs
  const discovered = queueLength + totalPRs;
  const triaged = queueLength + totalPRs; // Everything in queue has been triaged
  const submitted = totalPRs;
  const merged = mergedPRs;

  const maxCount = Math.max(discovered, 1);

  const stages: FunnelStage[] = [
    { label: "Discovered", count: discovered, color: "bg-foreground/20", textColor: "text-foreground/60" },
    { label: "Triaged", count: triaged, color: "bg-cyan-500/40", textColor: "text-cyan-400" },
    { label: "PRs Submitted", count: submitted, color: "bg-violet-500/40", textColor: "text-violet-400" },
    { label: "PRs Merged", count: merged, color: "bg-emerald-500/50", textColor: "text-emerald-400" },
  ];

  // Conversion rates between stages
  const conversions = [
    triaged > 0 ? Math.round((submitted / triaged) * 100) : 0,
    submitted > 0 ? Math.round((merged / submitted) * 100) : 0,
  ];

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Discovery Pipeline</span>
          {queueLength > 0 && (
            <span className="text-[10px] font-mono text-cyan-400/60 font-normal">
              {queueLength} in queue
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Funnel bars */}
        <div className="space-y-2">
          {stages.map((stage, i) => {
            const barWidth = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 4) : 4;
            return (
              <div key={stage.label}>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="w-24 text-right text-muted-foreground/50 shrink-0">
                    {stage.label}
                  </span>
                  <div className="flex-1 h-[8px] bg-foreground/5 rounded-[2px] overflow-hidden">
                    <div
                      className={`h-full rounded-[2px] transition-all duration-500 ${stage.color}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className={`w-10 text-right tabular-nums shrink-0 font-medium ${stage.textColor}`}>
                    {stage.count}
                  </span>
                </div>
                {/* Conversion arrow between stages (after Triaged and Submitted) */}
                {i === 1 && conversions[0] > 0 && (
                  <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground/25 ml-[104px] my-0.5">
                    <span className="text-muted-foreground/15">|</span>
                    <span>{conversions[0]}% submit rate</span>
                  </div>
                )}
                {i === 2 && conversions[1] > 0 && (
                  <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground/25 ml-[104px] my-0.5">
                    <span className="text-muted-foreground/15">|</span>
                    <span>{conversions[1]}% merge rate</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Today's activity */}
        {statsToday && (
          <div className="pt-2 border-t border-foreground/[0.04]">
            <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/30 flex-wrap">
              <span className="uppercase tracking-wider">today</span>
              <span>
                submitted: <span className="text-foreground/40 tabular-nums">{statsToday.submitted}</span>
              </span>
              <span>
                merged: <span className="text-emerald-400/60 tabular-nums">{statsToday.merged}</span>
              </span>
              <span>
                rejected: <span className="text-red-400/60 tabular-nums">{statsToday.rejected}</span>
              </span>
              {statsToday.abandoned > 0 && (
                <span>
                  abandoned: <span className="text-amber-400/60 tabular-nums">{statsToday.abandoned}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {discovered === 0 && (
          <div className="text-center py-2">
            <p className="text-[11px] text-muted-foreground/50 font-mono">
              No pipeline data yet. The agent reports state during heartbeat cycles.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
