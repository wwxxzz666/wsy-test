"use client";

import { formatRelativeTime } from "@/lib/utils";

interface AgentStatusIndicatorProps {
  status: "online" | "degraded" | "offline";
  lastHeartbeat: Date | string | null;
}

export function AgentStatusIndicator({
  status,
  lastHeartbeat,
}: AgentStatusIndicatorProps) {
  const colorMap = {
    online: "bg-emerald-500",
    degraded: "bg-amber-500",
    offline: "bg-red-500",
  };

  const labelMap = {
    online: "Online",
    degraded: "Degraded",
    offline: "Offline",
  };

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {status === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colorMap[status]}`}
        />
      </span>
      <span className="text-sm font-medium">{labelMap[status]}</span>
      {lastHeartbeat && (
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(lastHeartbeat)}
        </span>
      )}
    </div>
  );
}
