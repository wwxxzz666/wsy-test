"use client";

import { Header } from "@/components/layout/header";
import { AgentStatusCard } from "@/components/overview/agent-status-card";
import { MetricCards } from "@/components/overview/metric-cards";
import { ActivityTimeline } from "@/components/overview/activity-timeline";
import { CurrentTaskCard } from "@/components/overview/current-task-card";
import { RecentPRsList } from "@/components/overview/recent-prs-list";
import { FollowUpTracker } from "@/components/overview/follow-up-tracker";
import { RepoHealthPanel } from "@/components/overview/repo-health-panel";
// StalePRPanel removed from overview — not a priority
import { PRTypeBreakdown } from "@/components/overview/pr-type-breakdown";
import { PRSizeHistogram } from "@/components/overview/pr-size-histogram";
import { AutonomyHealthPanel } from "@/components/overview/autonomy-health-panel";
import { PostMergeHealthPanel } from "@/components/overview/post-merge-health-panel";
import { MergeProbabilityPanel } from "@/components/overview/merge-probability-panel";
import { VelocityTimeline } from "@/components/overview/velocity-timeline";
import { ResponseTimePanel } from "@/components/overview/response-time-panel";
import { AlertsBanner } from "@/components/overview/alerts-banner";
import { ActionItemsPanel } from "@/components/overview/action-items-panel";
import { CorrelationPanel } from "@/components/overview/correlation-panel";
import { SubagentHealthPanel } from "@/components/overview/subagent-health-panel";
import { PRPortfolioHealth } from "@/components/overview/pr-portfolio-health";
import { ThroughputPanel } from "@/components/overview/throughput-panel";
import { DirectivesPanel } from "@/components/overview/directives-panel";
import { DiscoveryPipeline } from "@/components/overview/discovery-pipeline";
import { AgentStatePanel } from "@/components/live/agent-state-panel";
import { useAgentStatus } from "@/lib/hooks/use-agent-status";
import { useConnectionStatus } from "@/lib/hooks/use-connection-status";
import { useAgentState } from "@/lib/hooks/use-agent-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TerminalLoop } from "@/components/ascii/terminal-loop";
import { ScrambleText } from "@/components/ascii/scramble-text";
import { BreathingText } from "@/components/ascii/breathing-text";
import { LifeField } from "@/components/ascii/life-field";
import { DnaHelix } from "@/components/ascii/dna-helix";
import { MatrixRain } from "@/components/ascii/matrix-rain";
import { useEffect, useState } from "react";
import { getCostModel } from "@/lib/cost-models";

function InlineClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-muted-foreground/30 tabular-nums text-[10px]" suppressHydrationWarning>
      [{time}]
    </span>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-center text-sm font-mono">
          Waiting for Agent Data
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-10 w-10 rounded-full border border-muted-foreground/20 flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
          </div>
        </div>
        <p className="text-muted-foreground text-xs font-mono">
          Waiting for telemetry from the ClawOSS agent.
        </p>
        <div className="text-muted-foreground max-w-sm mx-auto font-mono">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground/50">To connect:</p>
          <ol className="text-left list-decimal list-inside space-y-1 text-[11px]">
            <li>Set <code className="text-[10px] bg-muted px-1 py-0.5">CLAW_API_KEY</code> in agent env</li>
            <li>The dashboard-reporter hook will auto-send telemetry</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { data, isLoading } = useAgentStatus();
  const { data: connectionData } = useConnectionStatus();
  const { data: stateData, isLoading: stateLoading } = useAgentState();
  const activeModel =
    connectionData?.connection?.model ||
    data?.runtime?.model ||
    data?.stats?.activeModel ||
    "unknown";
  const activeCostModel = getCostModel(activeModel);
  const tokenBudget =
    data?.runtime?.tokenBudget || connectionData?.connection?.tokenBudget;
  const budgetPct =
    tokenBudget && tokenBudget.totalTokens > 0
      ? Math.min(
          100,
          Math.round((tokenBudget.usedTokens / tokenBudget.totalTokens) * 100)
        )
      : 0;

  const hasData = connectionData?.hasAnyData ||
    (data?.stats && (data.stats.totalPRs > 0 || data.stats.inputTokensToday > 0 || data.stats.outputTokensToday > 0)) ||
    (data?.recentActivity && data.recentActivity.length > 0);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header title="Overview" />
        <div className="flex-1 space-y-6 p-6 lg:p-8">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative">
      <Header title="Overview" />
      <div className="flex-1 space-y-8 p-6 lg:p-8 relative z-10">
        {/* System identity bar */}
        <div className="system-header corner-brackets font-mono text-[11px] px-3 py-2 flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-3">
            <span className="text-foreground/80 font-bold tracking-tight">
              <ScrambleText text="CLAWOSS" speed={40} scrambleFrames={14} stagger={30} />
            </span>
            <span className="text-muted-foreground/20">|</span>
            <span className="text-muted-foreground/50">
              <ScrambleText text="autonomous oss contributor" speed={25} scrambleFrames={8} stagger={12} />
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground/40">
            <span>{activeModel}</span>
            <span className="text-muted-foreground/15">|</span>
            <span>parallel-agents</span>
            <span className="text-muted-foreground/15">|</span>
            <span>reproduce-first</span>
            {connectionData && (
              <>
                <span className="text-muted-foreground/15">|</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    connectionData.connection.state === "connected" ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                  <span className={
                    connectionData.connection.state === "connected" ? "text-emerald-400/60" : "text-red-400/60"
                  }>
                    {connectionData.connection.state}
                  </span>
                </span>
              </>
            )}
            <span className="text-muted-foreground/15">|</span>
            <InlineClock />
          </div>
        </div>

        {!hasData && <EmptyState />}

        {data?.agentStatus && <AgentStatusCard status={data.agentStatus} />}

        <AlertsBanner />

        {/* === LIVE PIPELINE (top of page — what the agent is doing RIGHT NOW) === */}

        {/* Full-width: Agent slot grid — 13 slots showing all active work */}
        <SubagentHealthPanel />

        {/* Throughput + Discovery — live work metrics */}
        <div className="grid gap-5 lg:grid-cols-2">
          <ThroughputPanel />
          <DiscoveryPipeline />
        </div>

        {/* Stats overview */}
        <MetricCards
          totalPRs={data?.stats?.totalPRs || 0}
          mergeRate={data?.stats?.mergeRate || 0}
          inputTokensToday={data?.stats?.inputTokensToday || 0}
          outputTokensToday={data?.stats?.outputTokensToday || 0}
          costToday={data?.stats?.costToday || 0}
          activeModel={data?.stats?.activeModel || activeModel}
          funnel={data?.funnel}
          costPerMerge={data?.stats?.costPerMerge || 0}
          tokensPerMerge={data?.stats?.tokensPerMerge || 0}
          avgHoursToReview={data?.stats?.avgHoursToReview}
        />

        {/* PR portfolio scoreboard + repo health */}
        <div className="grid gap-5 lg:grid-cols-2">
          <PRPortfolioHealth />
          <RepoHealthPanel />
        </div>

        {/* Merge intelligence */}
        <div className="grid gap-5 lg:grid-cols-2">
          <MergeProbabilityPanel />
          <VelocityTimeline />
        </div>

        {/* === ANALYTICS (below fold — reference data) === */}

        <div className="grid gap-5 lg:grid-cols-2">
          <AutonomyHealthPanel />
          <PRTypeBreakdown />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <PRSizeHistogram />
          <ResponseTimePanel />
        </div>

        <DirectivesPanel />
        <ActionItemsPanel />
        <PostMergeHealthPanel />
        <CorrelationPanel />

        {/* Pipeline telemetry bar */}
        {connectionData && (
          <div className="pipeline-bar corner-brackets px-3 py-1.5">
            <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap text-muted-foreground/40">
              <span className="uppercase tracking-wider text-muted-foreground/25">pipeline</span>
              <span className="text-muted-foreground/10">|</span>
              <span>hb/hr <span className="text-foreground/45 tabular-nums">{connectionData.pipeline.heartbeatsLastHour}</span></span>
              <span>err/hr <span className={connectionData.pipeline.errorsLastHour > 0 ? "text-red-400/60" : "text-foreground/45"}>
                {connectionData.pipeline.errorsLastHour}
              </span></span>
              <span className="text-muted-foreground/10">|</span>
              <span>model <span className="text-foreground/45">{activeModel}</span></span>
              <span>
                cost <span className="text-foreground/45">
                  ${(activeCostModel.inputCostPerToken * 1_000_000).toFixed(2)}/$
                  {(activeCostModel.outputCostPerToken * 1_000_000).toFixed(2)}/M
                </span>
              </span>
              {tokenBudget?.enabled && (
                <>
                  <span className="text-muted-foreground/10">|</span>
                  <span>
                    budget{" "}
                    <span className={tokenBudget.paused ? "text-red-400/70" : "text-foreground/45"}>
                      {tokenBudget.paused
                        ? `paused ${tokenBudget.usedTokens.toLocaleString()}/${tokenBudget.totalTokens.toLocaleString()}`
                        : `${budgetPct}% (${tokenBudget.remainingTokens.toLocaleString()} left)`}
                    </span>
                  </span>
                </>
              )}
              <span className="text-muted-foreground/10">|</span>
              <span>pii <span className="text-foreground/45">off</span></span>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Main content: 2 cols */}
          <div className="lg:col-span-2 space-y-5">
            <ActivityTimeline items={data?.recentActivity || []} />

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-5">
                <CurrentTaskCard task={data?.currentTask || null} />
                <FollowUpTracker
                  total={data?.followUps?.total || 0}
                  active={data?.followUps?.active || 0}
                  ledToMerge={data?.followUps?.ledToMerge || 0}
                />
              </div>
              <RecentPRsList prs={data?.recentPRs || []} />
            </div>
          </div>

          {/* Sidebar: curated art gallery */}
          <div className="space-y-5">
            <AgentStatePanel state={stateData?.state || null} isLoading={stateLoading} />

            <TerminalLoop />

            {/* Game of Life -- living art piece */}
            <div className="art-frame relative rounded-md overflow-hidden">
              <LifeField cols={50} rows={12} speed={200} density={0.18} palette="gradient" />
              <div className="absolute inset-0 flex items-end justify-end pointer-events-none z-10 p-2">
                <span className="font-mono text-[8px] text-foreground/15 uppercase tracking-[0.2em]">
                  cellular automata
                </span>
              </div>
            </div>

            {/* DNA + Matrix rain side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="art-frame relative rounded-md overflow-hidden flex justify-center py-1">
                <DnaHelix height={8} speed={140} />
              </div>
              <div className="art-frame relative rounded-md overflow-hidden">
                <MatrixRain cols={20} rows={8} speed={80} density={0.05} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer breathing wave -- subtle, ambient */}
        <div className="pt-2">
          <BreathingText width={120} rows={2} speed={100} className="mx-auto max-w-full opacity-60" />
        </div>
      </div>
    </div>
  );
}
