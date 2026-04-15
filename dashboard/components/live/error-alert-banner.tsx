"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ErrorAlertBannerProps {
  errorsLastHour: number;
  lastHeartbeat: string | null;
  connectionState: "connected" | "degraded" | "disconnected" | "unknown";
}

export function ErrorAlertBanner({
  errorsLastHour,
  lastHeartbeat,
  connectionState,
}: ErrorAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Don't render during SSR to avoid hydration mismatch from Date.now() differences
  if (!mounted) return null;
  if (dismissed) return null;

  const alerts: { message: string; severity: "error" | "warning" }[] = [];

  // Check for stale agent
  if (lastHeartbeat) {
    const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin > 60) {
      const diffHrs = Math.floor(diffMin / 60);
      alerts.push({
        message: `Agent has not sent a heartbeat in ${diffHrs}h ${diffMin % 60}m. It may be stalled or offline.`,
        severity: "error",
      });
    } else if (diffMin > 15) {
      alerts.push({
        message: `Last heartbeat was ${diffMin}m ago. Agent may be delayed.`,
        severity: "warning",
      });
    }
  } else {
    alerts.push({
      message: "No heartbeat data received yet. Waiting for agent to connect.",
      severity: "warning",
    });
  }

  // Check for errors
  if (errorsLastHour > 0) {
    alerts.push({
      message: `${errorsLastHour} error${errorsLastHour > 1 ? "s" : ""} in the last hour.`,
      severity: errorsLastHour >= 3 ? "error" : "warning",
    });
  }

  // Check connection state
  if (connectionState === "disconnected") {
    alerts.push({
      message: "Pipeline disconnected. Agent is not reporting.",
      severity: "error",
    });
  }

  if (alerts.length === 0) return null;

  const hasError = alerts.some((a) => a.severity === "error");

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 text-xs font-mono border-b ${
        hasError
          ? "bg-red-500/10 border-red-500/20 text-red-300"
          : "bg-amber-500/10 border-amber-500/20 text-amber-300"
      }`}
    >
      <span className="font-bold shrink-0">
        {hasError ? "!! ALERT" : "-- WARN"}
      </span>
      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {alerts.map((alert, i) => (
          <span
            key={i}
            className={
              alert.severity === "error"
                ? "text-red-300"
                : "text-amber-300"
            }
          >
            {alert.message}
          </span>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-2 text-[10px] shrink-0 hover:bg-background/20"
        onClick={() => setDismissed(true)}
      >
        dismiss
      </Button>
    </div>
  );
}
