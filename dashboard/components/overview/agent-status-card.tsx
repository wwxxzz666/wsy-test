"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

interface AgentStatusCardProps {
  status: AgentStatus;
}

export function AgentStatusCard({ status }: AgentStatusCardProps) {
  return (
    <Card className="accent-top corner-brackets card-elevated">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5 font-mono text-xs">
            <span className="relative flex h-2.5 w-2.5">
              {status.isOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              )}
              <span className={`relative h-2.5 w-2.5 rounded-full ${status.isOnline ? "bg-emerald-500" : "bg-red-500"}`} />
            </span>
            <span className="stat-label">Agent</span>
            <span className={`font-medium ${status.isOnline ? "text-emerald-400/80" : "text-red-400/80"}`}>
              {status.isOnline ? "online" : "offline"}
            </span>
          </div>
          {status.isOnline && (
            <span className="text-[9px] font-mono text-emerald-500/40 uppercase tracking-widest">active</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-6 font-mono">
          <div>
            <div className="stat-label">Uptime</div>
            <div className="text-xl font-bold mt-1 tracking-tight tabular-nums">{formatDuration(status.uptimeSeconds)}</div>
          </div>
          <div>
            <div className="stat-label">HB Streak</div>
            <div className="text-xl font-bold mt-1 tracking-tight tabular-nums">{status.heartbeatStreak.toLocaleString()}</div>
          </div>
          <div>
            <div className="stat-label">Current Task</div>
            <div className="text-xs mt-1.5 truncate">
              {status.currentTask || <span className="text-muted-foreground/40 italic">idle</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
