"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "@/components/ui/timestamp";
import type { ActivityItem } from "@/lib/types";

interface ActivityTimelineProps {
  items: ActivityItem[];
  maxItems?: number;
}

const typeColors: Record<string, string> = {
  pr_created: "bg-foreground/40",
  pr_merged: "bg-emerald-500",
  pr_closed: "bg-red-500",
  review_received: "bg-foreground/30",
  heartbeat: "bg-foreground/20",
  error: "bg-red-500",
  task_started: "bg-amber-500",
};

const typeLabels: Record<string, string> = {
  pr_created: "PR Created",
  pr_merged: "PR Merged",
  pr_closed: "PR Closed",
  review_received: "Review",
  heartbeat: "Heartbeat",
  error: "Error",
  task_started: "Task",
};

export function ActivityTimeline({
  items,
  maxItems = 10,
}: ActivityTimelineProps) {
  const displayed = items.slice(0, maxItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Recent Activity</span>
          {displayed.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
              {items.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Waiting for events...</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayed.map((item, i) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors group"
              >
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center mt-0.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${typeColors[item.type] || "bg-foreground/30"}`}
                  />
                  {i < displayed.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {typeLabels[item.type] || item.type}
                    </Badge>
                    <Timestamp
                      date={item.timestamp}
                      className="text-[10px] text-muted-foreground/60 font-mono ml-auto"
                    />
                  </div>
                  <p className="text-sm truncate mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
