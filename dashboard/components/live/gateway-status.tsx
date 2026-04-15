"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import type { ConversationSession } from "@/lib/types";

interface GatewayStatusProps {
  lastHeartbeat: string | null;
  connectionState: string;
  heartbeatsLastHour: number;
  errorsLastHour: number;
  sessions: ConversationSession[];
  model: string;
  tokenBudget?: {
    enabled: boolean;
    totalTokens: number;
    usedTokens: number;
    remainingTokens: number;
    paused: boolean;
  };
}

const SKILLS = [
  "dashboard-reporter",
  "audit-logger",
  "oss-discover",
  "oss-triage",
  "oss-implement",
  "oss-followup",
  "oss-review",
  "repo-analyzer",
  "self-review",
  "heartbeat",
  "session-manager",
  "compaction",
  "context-monitor",
  "loop-detection",
];

export function GatewayStatus({
  lastHeartbeat,
  connectionState,
  heartbeatsLastHour,
  errorsLastHour,
  sessions,
  model,
  tokenBudget,
}: GatewayStatusProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isOnline = connectionState === "connected";
  const isDegraded = connectionState === "degraded";
  const lastHbDate = lastHeartbeat ? new Date(lastHeartbeat) : null;
  // Only compute time-dependent values after mount to avoid hydration mismatch
  const staleness = mounted && lastHbDate
    ? Math.floor((Date.now() - lastHbDate.getTime()) / 1000)
    : null;

  const activeSessions = sessions.filter((s) => s.isActive);
  const subagentSessions = sessions.filter((s) => s.isSubagent);

  // Next heartbeat estimate (every 10 min)
  const nextHbEstimate = lastHbDate
    ? new Date(lastHbDate.getTime() + 10 * 60 * 1000)
    : null;
  const nextHbIn = mounted && nextHbEstimate
    ? Math.max(0, Math.floor((nextHbEstimate.getTime() - Date.now()) / 1000))
    : null;

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Gateway header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <div
          className={`w-2 h-2 rounded-full ${
            isOnline
              ? "bg-emerald-400 animate-pulse"
              : isDegraded
              ? "bg-amber-400 animate-pulse"
              : "bg-red-400"
          }`}
        />
        <span className="font-bold text-sm">
          OpenClaw Gateway
        </span>
        <Badge
          variant="outline"
          className={`text-[9px] h-4 px-1.5 ${
            isOnline
              ? "text-emerald-400 border-emerald-400/30"
              : isDegraded
              ? "text-amber-400 border-amber-400/30"
              : "text-red-400 border-red-400/30"
          }`}
        >
          {isOnline ? "ONLINE" : isDegraded ? "DEGRADED" : "OFFLINE"}
        </Badge>
      </div>

      {/* Gateway info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex justify-between">
          <span className="stat-label">Port</span>
          <span>18789</span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">Mode</span>
          <span>local</span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">Model</span>
          <span className="text-foreground/60">{model}</span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">Auth</span>
          <span className="text-emerald-400">token</span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">HB interval</span>
          <span>10m</span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">HBs/hr</span>
          <span className={heartbeatsLastHour > 0 ? "text-emerald-400" : "text-red-400"}>
            {heartbeatsLastHour}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">Errors/hr</span>
          <span className={errorsLastHour > 0 ? "text-red-400" : "text-emerald-400"}>
            {errorsLastHour}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">MaxConc</span>
          <span>5</span>
        </div>
      </div>

      {tokenBudget?.enabled && (
        <div className="p-2 bg-muted/10 rounded border space-y-1">
          <div className="flex justify-between">
            <span className="stat-label">Token Budget</span>
            <span
              className={
                tokenBudget.paused ? "text-red-400" : "text-foreground/60"
              }
            >
              {tokenBudget.usedTokens.toLocaleString()} /{" "}
              {tokenBudget.totalTokens.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="stat-label">Remaining</span>
            <span
              className={
                tokenBudget.paused ? "text-red-400" : "text-emerald-400"
              }
            >
              {tokenBudget.remainingTokens.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Heartbeat timing */}
      <div className="p-2 bg-muted/10 rounded border space-y-1">
        <div className="flex justify-between">
          <span className="stat-label">Last heartbeat</span>
          <span
            className={
              staleness != null && staleness > 900
                ? "text-red-400"
                : staleness != null && staleness > 300
                ? "text-amber-400"
                : "text-emerald-400"
            }
          >
            {staleness != null
              ? staleness > 3600
                ? `${Math.floor(staleness / 3600)}h ${Math.floor(
                    (staleness % 3600) / 60
                  )}m ago`
                : staleness > 60
                ? `${Math.floor(staleness / 60)}m ${staleness % 60}s ago`
                : `${staleness}s ago`
              : "never"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="stat-label">Next HB (est)</span>
          <span className="text-muted-foreground/60">
            {nextHbIn != null
              ? nextHbIn > 0
                ? `in ${Math.floor(nextHbIn / 60)}m ${nextHbIn % 60}s`
                : "overdue"
              : "--"}
          </span>
        </div>
      </div>

      {/* Sessions */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="stat-label">Sessions</span>
          <span>
            {activeSessions.length} active / {sessions.length} total
          </span>
        </div>
        {sessions.slice(0, 8).map((s) => {
          const isActive = s.isActive;
          const isSub = s.isSubagent;
          const age = mounted ? Math.floor(
            (Date.now() -
              new Date(
                typeof s.firstMessage === "string"
                  ? s.firstMessage
                  : s.firstMessage
              ).getTime()) /
              60000
          ) : 0;
          return (
            <div
              key={s.sessionId}
              className="flex items-center gap-2 px-1 py-0.5"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isActive
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-muted-foreground/30"
                }`}
              />
              <span
                className={`truncate flex-1 ${
                  isSub ? "text-amber-400" : "text-foreground/70"
                }`}
              >
                {isSub
                  ? "sub:" + s.sessionId.split(":").pop()?.slice(0, 8)
                  : s.sessionId.slice(0, 16)}
              </span>
              {isSub && (
                <Badge
                  variant="outline"
                  className="text-[7px] h-3 px-0.5 text-amber-400 border-amber-400/30"
                >
                  SUB
                </Badge>
              )}
              <span className="text-muted-foreground/50 text-[9px] shrink-0">
                {s.messageCount}msg
              </span>
              <span className="text-muted-foreground/50 text-[9px] w-10 text-right shrink-0">
                {age}m
              </span>
            </div>
          );
        })}
      </div>

      {/* Skill Inventory */}
      <div className="space-y-1">
        <div className="stat-label">
          Skills ({SKILLS.length} loaded)
        </div>
        <div className="flex flex-wrap gap-1">
          {SKILLS.map((skill) => (
            <Badge
              key={skill}
              variant="outline"
              className="text-[8px] h-3.5 px-1 text-muted-foreground border-muted-foreground/20 hover:text-foreground transition-colors"
            >
              {skill}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
