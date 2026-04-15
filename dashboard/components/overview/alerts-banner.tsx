"use client";

import { useAlerts, type DashboardAlert } from "@/lib/hooks/use-alerts";
import { useState } from "react";

const severityStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    text: "text-red-400",
    icon: "!!",
  },
  warning: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    text: "text-amber-400",
    icon: "!",
  },
  info: {
    bg: "bg-cyan-500/5",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
    icon: "i",
  },
};

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const style = severityStyles[alert.severity] || severityStyles.info;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`px-3 py-2 rounded-md border ${style.bg} ${style.border} cursor-pointer transition-colors hover:opacity-80`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono font-bold ${style.text} shrink-0 w-4 text-center`}>
          {style.icon}
        </span>
        <span className={`text-xs font-mono font-medium ${style.text} flex-1`}>
          {alert.title}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0">
          {alert.metric}: {alert.value}
          {alert.threshold && ` (threshold: ${alert.threshold})`}
        </span>
      </div>
      {expanded && (
        <p className="text-[10px] font-mono text-muted-foreground/50 mt-1 ml-6">
          {alert.detail}
        </p>
      )}
    </div>
  );
}

export function AlertsBanner() {
  const { data, isLoading } = useAlerts();

  if (isLoading || !data || data.alerts.length === 0) {
    return null;
  }

  const { alerts, summary } = data;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider">
        <span>active alerts</span>
        {summary.critical > 0 && (
          <span className="text-red-400/70 normal-case">
            {summary.critical} critical
          </span>
        )}
        {summary.warning > 0 && (
          <span className="text-amber-400/70 normal-case">
            {summary.warning} warning
          </span>
        )}
      </div>
      <div className="space-y-1">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
