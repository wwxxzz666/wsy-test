"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ConversationMessage } from "@/lib/types";

interface ToolAnalyticsProps {
  messages: ConversationMessage[];
}

interface ToolStats {
  name: string;
  calls: number;
  totalDuration: number;
  avgDuration: number;
  errors: number;
  lastUsed: Date | null;
}

export function ToolAnalytics({ messages }: ToolAnalyticsProps) {
  const toolStats = useMemo(() => {
    const stats = new Map<string, { calls: number; totalDuration: number; errors: number; lastUsed: Date | null }>();

    for (const msg of messages) {
      if (msg.role !== "tool_call" || !msg.toolName) continue;
      const name = msg.toolName;
      const existing = stats.get(name) || { calls: 0, totalDuration: 0, errors: 0, lastUsed: null };
      existing.calls++;
      if (msg.durationMs) existing.totalDuration += msg.durationMs;
      const ts = typeof msg.timestamp === "string" ? new Date(msg.timestamp) : msg.timestamp;
      if (!existing.lastUsed || ts > existing.lastUsed) existing.lastUsed = ts;
      stats.set(name, existing);
    }

    // Count errors from tool_result messages
    for (const msg of messages) {
      if (msg.role !== "tool_result") continue;
      const isError = msg.content?.startsWith("ERROR:") || (msg.metadata as Record<string, unknown>)?.error;
      if (isError && msg.toolName) {
        const existing = stats.get(msg.toolName);
        if (existing) existing.errors++;
      }
    }

    const result: ToolStats[] = [];
    stats.forEach((val, name) => {
      result.push({
        name,
        calls: val.calls,
        totalDuration: val.totalDuration,
        avgDuration: val.calls > 0 ? Math.round(val.totalDuration / val.calls) : 0,
        errors: val.errors,
        lastUsed: val.lastUsed,
      });
    });

    return result.sort((a, b) => b.calls - a.calls);
  }, [messages]);

  const totalCalls = toolStats.reduce((s, t) => s + t.calls, 0);
  const totalErrors = toolStats.reduce((s, t) => s + t.errors, 0);

  if (toolStats.length === 0) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Tool Usage</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-xs text-muted-foreground text-center py-4">
            No tool calls yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Tool Usage</span>
          <Badge variant="outline" className="text-[10px] h-4">
            {totalCalls} calls
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {toolStats.slice(0, 12).map((tool) => {
          const pct = totalCalls > 0 ? (tool.calls / totalCalls) * 100 : 0;
          return (
            <div key={tool.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-amber-400 truncate max-w-[120px]">
                  {tool.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{tool.calls}x</span>
                  {tool.avgDuration > 0 && (
                    <span className="text-muted-foreground">
                      ~{tool.avgDuration}ms
                    </span>
                  )}
                  {tool.errors > 0 && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-red-400 border-red-500/25">
                      {tool.errors} err
                    </Badge>
                  )}
                </div>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500/60 rounded-full transition-all"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}

        {totalErrors > 0 && (
          <div className="pt-2 border-t mt-2">
            <span className="text-xs text-red-400">
              {totalErrors} error{totalErrors !== 1 ? "s" : ""} total
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
