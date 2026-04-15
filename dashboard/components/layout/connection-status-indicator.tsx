"use client";

import { useConnectionStatus } from "@/lib/hooks/use-connection-status";
import { formatRelativeTime } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const stateConfig = {
  connected: {
    color: "bg-emerald-500",
    ping: true,
    label: "Connected",
    textColor: "text-emerald-500",
  },
  degraded: {
    color: "bg-amber-500",
    ping: true,
    label: "Degraded",
    textColor: "text-amber-500",
  },
  disconnected: {
    color: "bg-red-500",
    ping: false,
    label: "Disconnected",
    textColor: "text-red-500",
  },
  unknown: {
    color: "bg-foreground/30",
    ping: false,
    label: "Unknown",
    textColor: "text-foreground/50",
  },
};

export function ConnectionStatusIndicator() {
  const { data, isLoading } = useConnectionStatus();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex h-2.5 w-2.5">
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-foreground/30 animate-pulse" />
        </span>
        <span>Checking...</span>
      </div>
    );
  }

  const state = data.connection.state;
  const config = stateConfig[state];
  const pipeline = data.pipeline;

  return (
    <Tooltip>
      <TooltipTrigger className="flex items-center gap-2 text-sm cursor-default">
        <span className="relative flex h-2.5 w-2.5">
          {config.ping && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.color} opacity-75`}
            />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.color}`}
          />
        </span>
        <span className={`font-medium text-xs ${config.textColor}`}>
          {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="space-y-1.5 text-xs">
          <p className="font-medium">{data.connection.message}</p>
          {data.connection.lastHeartbeat && (
            <p>
              Last heartbeat:{" "}
              {formatRelativeTime(data.connection.lastHeartbeat)}
            </p>
          )}
          <div className="border-t border-background/20 pt-1.5 mt-1.5 space-y-0.5">
            <p>
              Pipeline:{" "}
              {pipeline.heartbeats ? "Heartbeats OK" : "No heartbeats"}{" "}
              {pipeline.metrics ? "/ Metrics OK" : "/ No metrics"}
            </p>
            <p>
              Last hour: {pipeline.heartbeatsLastHour} heartbeats,{" "}
              {pipeline.errorsLastHour} errors
            </p>
          </div>
          {!data.hasAnyData && (
            <p className="text-amber-400 font-medium pt-1">
              No telemetry data yet. Waiting for agent to send data.
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
