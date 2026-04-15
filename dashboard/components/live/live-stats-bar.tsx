"use client";

import { useMemo, useState, useEffect } from "react";
import { formatTokens } from "@/lib/utils";
import { DEFAULT_COST_MODEL } from "@/lib/cost-models";
import type { ConversationMessage } from "@/lib/types";

const INPUT_COST_PER_TOKEN = DEFAULT_COST_MODEL.inputCostPerToken;
const OUTPUT_COST_PER_TOKEN = DEFAULT_COST_MODEL.outputCostPerToken;

interface LiveStatsBarProps {
  messages: ConversationMessage[];
  isConnected: boolean;
  lastHeartbeat?: string | null;
  errorsLastHour?: number;
}

export function LiveStatsBar({
  messages,
  isConnected,
  lastHeartbeat,
  errorsLastHour = 0,
}: LiveStatsBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const stats = useMemo(() => {
    const totalMessages = messages.length;
    const assistantMsgs = messages.filter((m) => m.role === "assistant").length;
    const toolCalls = messages.filter((m) => m.role === "tool_call").length;
    const thinkingMsgs = messages.filter((m) => m.role === "thinking").length;
    const totalTokens = messages.reduce(
      (sum, m) => sum + (m.tokenCount || 0),
      0
    );
    const totalDuration = messages.reduce(
      (sum, m) => sum + (m.durationMs || 0),
      0
    );
    const sessions = new Set(messages.map((m) => m.sessionId)).size;
    const errors = messages.filter(
      (m) =>
        m.role === "tool_result" &&
        (m.content?.startsWith("ERROR:") ||
          (m.metadata as Record<string, unknown>)?.error)
    ).length;

    const inputTokens = Math.round(totalTokens * 0.6);
    const outputTokens = totalTokens - inputTokens;
    const estimatedCost =
      inputTokens * INPUT_COST_PER_TOKEN +
      outputTokens * OUTPUT_COST_PER_TOKEN;

    let msgsPerMin = 0;
    if (totalMessages >= 2) {
      const timestamps = messages
        .map((m) => {
          const ts =
            typeof m.timestamp === "string"
              ? new Date(m.timestamp)
              : m.timestamp;
          return ts.getTime();
        })
        .filter((t) => !isNaN(t));
      if (timestamps.length >= 2) {
        const span = Math.max(
          timestamps[timestamps.length - 1] - timestamps[0],
          1
        );
        msgsPerMin = totalMessages / (span / 60000);
      }
    }

    let tokenBurnRate = 0;
    if (totalTokens > 0 && messages.length >= 2) {
      const timestamps = messages
        .map((m) => {
          const ts =
            typeof m.timestamp === "string"
              ? new Date(m.timestamp)
              : m.timestamp;
          return ts.getTime();
        })
        .filter((t) => !isNaN(t));
      if (timestamps.length >= 2) {
        const span = Math.max(
          timestamps[timestamps.length - 1] - timestamps[0],
          1
        );
        tokenBurnRate = totalTokens / (span / 60000);
      }
    }

    // Count PII-sanitized messages (fullwidth @ or [REDACTED_*])
    const sanitizedCount = messages.filter(
      (m) =>
        m.content?.includes("\uFF20") ||
        m.content?.includes("[REDACTED_EMAIL]") ||
        m.content?.includes("[REDACTED_PHONE]") ||
        m.content?.includes("[REDACTED_IP]")
    ).length;

    return {
      totalMessages,
      assistantMsgs,
      toolCalls,
      thinkingMsgs,
      totalTokens,
      totalDuration,
      sessions,
      errors,
      estimatedCost,
      msgsPerMin,
      tokenBurnRate,
      sanitizedCount,
    };
  }, [messages]);

  // Compute staleness — only after mount to avoid hydration mismatch from Date.now()
  const stalenessLabel = useMemo(() => {
    if (!mounted) return null;
    if (!lastHeartbeat) return null;
    const hbTime = new Date(lastHeartbeat).getTime();
    if (isNaN(hbTime)) return null;
    const diffMs = Date.now() - hbTime;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ${diffMin % 60}m ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  }, [lastHeartbeat, mounted]);

  const isStale = useMemo(() => {
    if (!mounted) return false;
    if (!lastHeartbeat) return true;
    const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
    return diffMs > 15 * 60 * 1000; // 15 min
  }, [lastHeartbeat, mounted]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b pipeline-bar text-xs font-mono overflow-x-auto">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected
              ? "bg-emerald-500 animate-pulse"
              : isStale
              ? "bg-red-500"
              : "bg-amber-500"
          }`}
        />
        <span
          className={
            isConnected
              ? "text-emerald-400"
              : isStale
              ? "text-red-400"
              : "text-amber-400"
          }
        >
          {isConnected ? "LIVE" : isStale ? "STALE" : "IDLE"}
        </span>
      </div>

      {/* Last heartbeat */}
      {stalenessLabel && (
        <>
          <span className="text-muted-foreground">|</span>
          <span
            className={isStale ? "text-red-400" : "text-muted-foreground"}
          >
            <span className="text-muted-foreground/60">hb:</span>{" "}
            {stalenessLabel}
          </span>
        </>
      )}

      <span className="text-muted-foreground">|</span>

      {/* Message counts */}
      <span>
        <span className="text-muted-foreground">msgs:</span>{" "}
        {stats.totalMessages}
      </span>
      <span>
        <span className="text-muted-foreground">turns:</span>{" "}
        {stats.assistantMsgs}
      </span>
      <span>
        <span className="text-muted-foreground">tools:</span>{" "}
        {stats.toolCalls}
      </span>

      {/* Errors - always show, red when > 0 */}
      {(stats.errors > 0 || errorsLastHour > 0) && (
        <span className="text-red-400 font-bold">
          <span className="text-red-400/60">errs:</span>{" "}
          {stats.errors + errorsLastHour}
        </span>
      )}

      {/* Token metrics */}
      {stats.totalTokens > 0 && (
        <>
          <span className="text-muted-foreground">|</span>
          <span>
            <span className="text-muted-foreground">tokens:</span>{" "}
            {formatTokens(stats.totalTokens)}
          </span>
          <span>
            <span className="text-muted-foreground">burn:</span>{" "}
            {formatTokens(Math.round(stats.tokenBurnRate))}/min
          </span>
          <span className="text-emerald-400">
            <span className="text-emerald-400/60">cost:</span> $
            {stats.estimatedCost.toFixed(4)}
          </span>
        </>
      )}

      {/* Tool time */}
      {stats.totalDuration > 0 && (
        <span>
          <span className="text-muted-foreground">tool-time:</span>{" "}
          {(stats.totalDuration / 1000).toFixed(1)}s
        </span>
      )}

      {/* Rate */}
      {stats.msgsPerMin > 0 && (
        <span>
          <span className="text-muted-foreground">rate:</span>{" "}
          {stats.msgsPerMin.toFixed(1)}/min
        </span>
      )}

      {/* Sessions */}
      <span>
        <span className="text-muted-foreground">sessions:</span>{" "}
        {stats.sessions}
      </span>

      {/* PII sanitization */}
      {stats.sanitizedCount > 0 && (
        <span className="text-emerald-400">
          <span className="text-emerald-400/60">pii:</span>{" "}
          {stats.sanitizedCount} filtered
        </span>
      )}
    </div>
  );
}
