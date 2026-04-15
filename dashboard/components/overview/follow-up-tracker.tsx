"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FollowUpTrackerProps {
  total: number;
  active: number;
  ledToMerge: number;
}

export function FollowUpTracker({ total, active, ledToMerge }: FollowUpTrackerProps) {
  const conversionRate = total > 0 ? Math.round((ledToMerge / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Follow-ups</span>
          {active > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-mono text-amber-400 border-amber-400/25"
            >
              {active} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No follow-ups yet</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
              PR review follow-up sub-agents will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="stat-label">Total</div>
                <div className="text-lg font-bold tabular-nums mt-0.5">{total}</div>
              </div>
              <div>
                <div className="stat-label">Active</div>
                <div className="text-lg font-bold tabular-nums mt-0.5 text-amber-400">
                  {active}
                </div>
              </div>
              <div>
                <div className="stat-label">Led to Merge</div>
                <div className="text-lg font-bold tabular-nums mt-0.5 text-emerald-400">
                  {ledToMerge}
                </div>
              </div>
            </div>
            {/* Conversion bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="stat-label">Follow-up Conversion</span>
                <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums">
                  {conversionRate}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-foreground/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500/50 transition-all duration-500"
                  style={{ width: `${Math.max(conversionRate, 1)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
