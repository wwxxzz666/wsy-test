"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_COST_MODEL } from "@/lib/cost-models";
import type { ConversationMessage } from "@/lib/types";

interface CostBreakdownProps {
  messages: ConversationMessage[];
}

interface SessionCost {
  sessionId: string;
  displayName: string;
  isSubagent: boolean;
  repo: string | null;
  issue: string | null;
  messageCount: number;
  toolCalls: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  totalDurationMs: number;
}

export function CostBreakdown({ messages }: CostBreakdownProps) {
  const sessionCosts = useMemo(() => {
    const sessions = new Map<
      string,
      {
        msgs: number;
        tools: number;
        inputChars: number;
        outputChars: number;
        durationMs: number;
        repo: string | null;
        issue: string | null;
        isSubagent: boolean;
      }
    >();

    for (const msg of messages) {
      const sid = msg.sessionId;
      const existing = sessions.get(sid) || {
        msgs: 0,
        tools: 0,
        inputChars: 0,
        outputChars: 0,
        durationMs: 0,
        repo: null,
        issue: null,
        isSubagent: false,
      };

      existing.msgs++;

      if (msg.role === "tool_call") {
        existing.tools++;
        existing.inputChars += (msg.content?.length || 0);
      }
      if (msg.role === "assistant" || msg.role === "thinking") {
        existing.outputChars += (msg.content?.length || 0);
      }
      if (msg.role === "user" || msg.role === "system") {
        existing.inputChars += (msg.content?.length || 0);
      }
      if (msg.role === "tool_result") {
        existing.inputChars += (msg.content?.length || 0);
      }
      if (msg.durationMs) {
        existing.durationMs += msg.durationMs;
      }

      const meta = msg.metadata as Record<string, unknown>;
      if (meta?.repo && !existing.repo) existing.repo = String(meta.repo);
      if (meta?.issue && !existing.issue) existing.issue = String(meta.issue);
      if (meta?.isSubagent) existing.isSubagent = true;

      sessions.set(sid, existing);
    }

    const results: SessionCost[] = [];
    const { inputCostPerToken, outputCostPerToken } = DEFAULT_COST_MODEL;

    sessions.forEach((val, sid) => {
      // Rough estimate: ~4 chars per token
      const inputTokens = Math.ceil(val.inputChars / 4);
      const outputTokens = Math.ceil(val.outputChars / 4);
      const cost =
        inputTokens * inputCostPerToken + outputTokens * outputCostPerToken;

      const isSubagent = val.isSubagent;
      results.push({
        sessionId: sid,
        displayName: sid.length > 16 ? sid.slice(0, 12) + "..." : sid,
        isSubagent,
        repo: val.repo,
        issue: val.issue,
        messageCount: val.msgs,
        toolCalls: val.tools,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        estimatedCost: cost,
        totalDurationMs: val.durationMs,
      });
    });

    return results.sort((a, b) => b.estimatedCost - a.estimatedCost);
  }, [messages]);

  const totalCost = sessionCosts.reduce((s, c) => s + c.estimatedCost, 0);
  const totalInput = sessionCosts.reduce(
    (s, c) => s + c.estimatedInputTokens,
    0
  );
  const totalOutput = sessionCosts.reduce(
    (s, c) => s + c.estimatedOutputTokens,
    0
  );

  // Compute cost per hour from message timestamps
  const costPerHour = useMemo(() => {
    if (messages.length < 2) return 0;
    const timestamps = messages.map((m) =>
      typeof m.timestamp === "string"
        ? new Date(m.timestamp).getTime()
        : m.timestamp.getTime()
    );
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const hours = (maxTs - minTs) / 3600000;
    return hours > 0 ? totalCost / hours : totalCost;
  }, [messages, totalCost]);

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2 p-2 bg-muted/20 rounded border">
        <div>
          <div className="text-muted-foreground text-[9px]">Total Cost</div>
          <div className="text-emerald-400 font-bold">
            ${totalCost.toFixed(4)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-[9px]">$/hour</div>
          <div className="text-emerald-400">
            ${costPerHour.toFixed(4)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-[9px]">Input Tok</div>
          <div className="text-foreground/70">{totalInput.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-[9px]">Output Tok</div>
          <div className="text-foreground/50">{totalOutput.toLocaleString()}</div>
        </div>
      </div>

      {/* Per-session breakdown */}
      <div className="space-y-1">
        <div className="text-[9px] text-muted-foreground px-1">
          Per-Session Breakdown ({DEFAULT_COST_MODEL.name}: $
          {(DEFAULT_COST_MODEL.inputCostPerToken * 1_000_000).toFixed(2)}/M in,
          ${(DEFAULT_COST_MODEL.outputCostPerToken * 1_000_000).toFixed(2)}/M
          out)
        </div>
        {sessionCosts.map((sc) => {
          const pct = totalCost > 0 ? (sc.estimatedCost / totalCost) * 100 : 0;
          return (
            <div
              key={sc.sessionId}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/10"
            >
              <div className="w-24 shrink-0 truncate">
                <span
                  className={
                    sc.isSubagent ? "text-amber-400" : "text-foreground/70"
                  }
                >
                  {sc.displayName}
                </span>
              </div>
              {sc.repo && (
                <span className="text-foreground/40 text-[9px] w-28 truncate shrink-0">
                  {sc.repo}
                  {sc.issue || ""}
                </span>
              )}
              <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500/50 rounded-full"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="text-muted-foreground/60 w-10 text-right shrink-0">
                {sc.toolCalls}tc
              </span>
              <span className="text-emerald-400/80 w-16 text-right shrink-0">
                ${sc.estimatedCost.toFixed(4)}
              </span>
            </div>
          );
        })}
        {sessionCosts.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No cost data yet
          </div>
        )}
      </div>
    </div>
  );
}
