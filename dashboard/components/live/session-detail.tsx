"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import type { ConversationMessage, ConversationSession } from "@/lib/types";

interface SessionDetailProps {
  session: ConversationSession | undefined;
  messages: ConversationMessage[];
}

export function SessionDetail({ session, messages }: SessionDetailProps) {
  const stats = useMemo(() => {
    if (messages.length === 0) return null;

    const roles = { assistant: 0, user: 0, tool_call: 0, tool_result: 0, system: 0, thinking: 0 };
    let totalTokens = 0;
    let totalDuration = 0;
    const tools = new Set<string>();
    let errors = 0;

    for (const msg of messages) {
      if (msg.role in roles) roles[msg.role as keyof typeof roles]++;
      if (msg.tokenCount) totalTokens += msg.tokenCount;
      if (msg.durationMs) totalDuration += msg.durationMs;
      if (msg.toolName) tools.add(msg.toolName);
      if (msg.role === "tool_result" && msg.content?.startsWith("ERROR:")) errors++;
    }

    const first = typeof messages[0].timestamp === "string" ? new Date(messages[0].timestamp) : messages[0].timestamp;
    const last = typeof messages[messages.length - 1].timestamp === "string"
      ? new Date(messages[messages.length - 1].timestamp)
      : messages[messages.length - 1].timestamp;
    const durationMs = last.getTime() - first.getTime();

    return {
      roles,
      totalTokens,
      totalDuration,
      uniqueTools: tools.size,
      toolNames: Array.from(tools),
      errors,
      durationMs,
      messagesPerMinute: durationMs > 60000 ? (messages.length / (durationMs / 60000)).toFixed(1) : messages.length.toString(),
      tokensPerMinute: durationMs > 60000 ? Math.round(totalTokens / (durationMs / 60000)) : totalTokens,
    };
  }, [messages]);

  if (!session && !stats) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Session Info</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-xs text-muted-foreground text-center py-4">
            Select a session to see details
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span>Session</span>
          {session?.isActive && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-emerald-400 border-emerald-500/30">
              LIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {session && (
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="stat-label">ID</span>
              <span className="font-mono truncate max-w-[140px]">{session.sessionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="stat-label">Messages</span>
              <span className="font-mono">{session.messageCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="stat-label">Started</span>
              <span className="font-mono">{formatRelativeTime(session.firstMessage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="stat-label">Last</span>
              <span className="font-mono">{formatRelativeTime(session.lastMessage)}</span>
            </div>
          </div>
        )}

        {stats && (
          <>
            <div className="border-t pt-2 space-y-1 text-xs">
              <div className="stat-label mb-1">Breakdown</div>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-emerald-400">Agent: {stats.roles.assistant}</span>
                <span className="text-amber-400">Tools: {stats.roles.tool_call}</span>
                <span className="text-foreground/50">Results: {stats.roles.tool_result}</span>
                <span className="text-foreground/40">System: {stats.roles.system}</span>
                <span className="text-amber-400/70">Think: {stats.roles.thinking}</span>
                <span className="text-foreground/70">Prompt: {stats.roles.user}</span>
              </div>
            </div>

            <div className="border-t pt-2 space-y-1 text-xs">
              <div className="stat-label mb-1">Performance</div>
              <div className="flex justify-between">
                <span className="stat-label">Tokens</span>
                <span className="font-mono">{stats.totalTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="stat-label">Tokens/min</span>
                <span className="font-mono">{stats.tokensPerMinute.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="stat-label">Msgs/min</span>
                <span className="font-mono">{stats.messagesPerMinute}</span>
              </div>
              <div className="flex justify-between">
                <span className="stat-label">Tool time</span>
                <span className="font-mono">{(stats.totalDuration / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="stat-label">Unique tools</span>
                <span className="font-mono">{stats.uniqueTools}</span>
              </div>
              {stats.errors > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Errors</span>
                  <span>{stats.errors}</span>
                </div>
              )}
            </div>

            {stats.toolNames.length > 0 && (
              <div className="border-t pt-2 text-xs">
                <div className="stat-label mb-1">Tools Used</div>
                <div className="flex flex-wrap gap-1">
                  {stats.toolNames.map((name) => (
                    <Badge key={name} variant="outline" className="text-[9px] h-4 px-1 font-mono text-amber-400/70 border-amber-500/20">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
