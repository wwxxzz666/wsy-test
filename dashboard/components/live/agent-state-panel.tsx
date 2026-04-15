"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { AgentState } from "@/lib/types";

interface AgentStatePanelProps {
  state: AgentState | null;
  isLoading: boolean;
}

const skillColors: Record<string, string> = {
  "oss-discover": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "oss-triage": "bg-foreground/8 text-foreground/60 border-foreground/12",
  "oss-implement": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  "oss-followup": "bg-amber-500/15 text-amber-300 border-amber-500/25",
  "repo-analyzer": "bg-foreground/8 text-foreground/60 border-foreground/12",
  "systematic-debugging": "bg-red-500/15 text-red-300 border-red-500/25",
  "test-driven-development": "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

function getSkillBadgeClass(skill: string): string {
  return (
    skillColors[skill] ||
    "bg-foreground/8 text-foreground/50 border-foreground/12"
  );
}

export function AgentStatePanel({ state, isLoading }: AgentStatePanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Agent State</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Agent State</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="text-center py-6 space-y-2">
            <div className="text-2xl opacity-40">...</div>
            <p className="text-xs text-muted-foreground">
              No state reported yet
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              State will appear when the agent completes a cycle
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const workQueue = (state.workQueue || []) as Array<{
    priority: string;
    repo: string;
    issue: string;
    title: string;
    solvabilityScore?: number;
  }>;

  const pipeline = state.pipelineState as {
    activePRs?: Array<{
      repo: string;
      number: number;
      title: string;
      status: string;
    }>;
    statsToday?: {
      submitted: number;
      merged: number;
      rejected: number;
      abandoned: number;
    };
  } | null;

  const repos = (state.activeRepos || []) as string[];

  // Staleness check — only after mount to avoid hydration mismatch
  const stateAge = mounted && state.timestamp
    ? Date.now() - new Date(state.timestamp).getTime()
    : Infinity;
  const isStale = mounted ? stateAge > 30 * 60 * 1000 : false; // 30 min

  return (
    <div className="space-y-3">
      {/* Current Activity */}
      <Card className={isStale ? "border-amber-500/20" : ""}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              Current Activity
              {!isStale && state.currentSkill && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </span>
            <span
              className={`text-[10px] font-normal ${
                isStale ? "text-amber-400" : "text-muted-foreground"
              }`}
            >
              {isStale && "stale -- "}
              {formatRelativeTime(state.timestamp)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2.5 text-xs">
          {state.currentSkill && (
            <div className="flex justify-between items-center">
              <span className="stat-label">Skill</span>
              <Badge
                variant="outline"
                className={`text-[10px] h-5 px-2 font-mono border ${getSkillBadgeClass(state.currentSkill)}`}
              >
                {state.currentSkill}
              </Badge>
            </div>
          )}
          {state.currentRepo && (
            <div className="flex justify-between items-center">
              <span className="stat-label">Repo</span>
              <span className="font-mono text-foreground/70 truncate max-w-[140px] text-[11px]">
                {state.currentRepo}
              </span>
            </div>
          )}
          {state.currentIssue && (
            <div className="flex justify-between items-center">
              <span className="stat-label">Issue</span>
              <span className="font-mono text-emerald-400/70 text-[11px]">
                {state.currentIssue}
              </span>
            </div>
          )}
          {!state.currentSkill &&
            !state.currentRepo &&
            !state.currentIssue && (
              <p className="text-muted-foreground text-center py-1 italic">
                Idle -- waiting for next heartbeat
              </p>
            )}
        </CardContent>
      </Card>

      {/* Active Repos */}
      {repos.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Active Repos</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                {repos.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {repos.map((repo) => (
                <Badge
                  key={repo}
                  variant="outline"
                  className="text-[10px] h-5 px-2 font-mono"
                >
                  {repo.includes("/") ? repo.split("/")[1] : repo}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Queue */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Work Queue</span>
            <Badge
              variant="outline"
              className={`text-[10px] h-4 px-1.5 ${workQueue.length > 0 ? "text-emerald-400 border-emerald-500/25" : ""}`}
            >
              {workQueue.length} items
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1.5">
          {workQueue.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3 italic">
              Queue empty -- agent will run discovery
            </p>
          ) : (
            workQueue.slice(0, 8).map((item, i) => {
              const priorityColors: Record<string, string> = {
                HIGH: "bg-red-500/15 text-red-300 border-red-500/25",
                "1": "bg-red-500/15 text-red-300 border-red-500/25",
                "2": "bg-amber-500/15 text-amber-300 border-amber-500/25",
                MEDIUM:
                  "bg-amber-500/15 text-amber-300 border-amber-500/25",
                "3": "bg-amber-500/15 text-amber-300 border-amber-500/25",
                LOW: "bg-foreground/6 text-foreground/40 border-foreground/10",
              };
              const pColor =
                priorityColors[item.priority] || priorityColors.MEDIUM;

              return (
                <div
                  key={i}
                  className={`flex items-start gap-1.5 text-[11px] rounded px-2 py-1 ${
                    i === 0 ? "bg-muted/50 border border-border" : ""
                  }`}
                >
                  <Badge
                    variant="outline"
                    className={`text-[8px] h-3.5 px-1 shrink-0 mt-0.5 border ${pColor}`}
                  >
                    P{item.priority}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-foreground/70 font-mono text-[10px]">
                        {item.repo?.includes("/")
                          ? item.repo.split("/")[1]
                          : item.repo}
                      </span>
                      <span className="text-emerald-400/70 font-mono text-[10px]">
                        #{item.issue}
                      </span>
                      {item.solvabilityScore != null && (
                        <span
                          className={`text-[9px] ml-auto ${
                            (item.solvabilityScore ?? 0) >= 7
                              ? "text-emerald-400"
                              : (item.solvabilityScore ?? 0) >= 5
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        >
                          s:{item.solvabilityScore}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate leading-tight text-[10px]">
                      {item.title}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          {workQueue.length > 8 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              +{workQueue.length - 8} more
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pipeline */}
      {pipeline && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2 text-xs">
            {pipeline.activePRs && pipeline.activePRs.length > 0 ? (
              <div className="space-y-1.5">
                <span className="stat-label">Active PRs</span>
                {pipeline.activePRs.map((pr, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-muted/30 rounded px-2 py-1"
                  >
                    <Badge
                      variant="outline"
                      className="text-[9px] h-3.5 px-1"
                    >
                      #{pr.number}
                    </Badge>
                    <span className="truncate text-[10px]">{pr.title}</span>
                    <Badge
                      variant="outline"
                      className="text-[8px] h-3 px-1 ml-auto shrink-0"
                    >
                      {pr.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-1 italic text-[11px]">
                No active PRs
              </p>
            )}
            {pipeline.statsToday && (
              <div className="border-t pt-2 space-y-1">
                <span className="stat-label">Today</span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold font-mono tabular-nums">
                      {pipeline.statsToday.submitted}
                    </div>
                    <div className="stat-label">sent</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
                      {pipeline.statsToday.merged}
                    </div>
                    <div className="stat-label">merged</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-400 font-mono tabular-nums">
                      {pipeline.statsToday.rejected}
                    </div>
                    <div className="stat-label">rejected</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-amber-400 font-mono tabular-nums">
                      {pipeline.statsToday.abandoned}
                    </div>
                    <div className="stat-label">dropped</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
