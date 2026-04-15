"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConversationMessage } from "@/lib/types";

interface ToolCallLogProps {
  messages: ConversationMessage[];
}

interface ToolCallEntry {
  id: string;
  timestamp: Date;
  toolName: string;
  sessionId: string;
  durationMs: number | null;
  success: boolean;
  errorMsg: string | null;
  params: string;
  result: string;
  isSubagent: boolean;
}

export function ToolCallLog({ messages }: ToolCallLogProps) {
  const [search, setSearch] = useState("");
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entries = useMemo(() => {
    const calls: ToolCallEntry[] = [];
    const resultMap = new Map<string, ConversationMessage>();

    // Index results by toolCallId
    for (const msg of messages) {
      if (msg.role === "tool_result" && msg.toolCallId) {
        resultMap.set(msg.toolCallId, msg);
      }
    }

    for (const msg of messages) {
      if (msg.role !== "tool_call" || !msg.toolName) continue;

      const resultMsg = msg.toolCallId ? resultMap.get(msg.toolCallId) : null;
      const isError =
        !!resultMsg?.content?.startsWith("ERROR:") ||
        !!(resultMsg?.metadata as Record<string, unknown>)?.error;

      const ts =
        typeof msg.timestamp === "string"
          ? new Date(msg.timestamp)
          : msg.timestamp;

      calls.push({
        id: msg.id,
        timestamp: ts,
        toolName: msg.toolName,
        sessionId: msg.sessionId,
        durationMs: msg.durationMs,
        success: !isError,
        errorMsg: isError ? resultMsg?.content?.slice(0, 200) || "Error" : null,
        params: msg.content?.slice(0, 500) || "",
        result: resultMsg?.content?.slice(0, 500) || "",
        isSubagent: !!(msg.metadata as Record<string, unknown>)?.isSubagent,
      });
    }

    return calls.reverse(); // newest first
  }, [messages]);

  const filtered = useMemo(() => {
    let items = entries;
    if (showOnlyErrors) {
      items = items.filter((e) => !e.success);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.toolName.toLowerCase().includes(q) ||
          e.sessionId.toLowerCase().includes(q) ||
          e.params.toLowerCase().includes(q)
      );
    }
    return items;
  }, [entries, showOnlyErrors, search]);

  const errorCount = entries.filter((e) => !e.success).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-6 text-xs flex-1"
        />
        <Button
          variant={showOnlyErrors ? "destructive" : "ghost"}
          size="sm"
          className="text-[10px] h-6 px-2"
          onClick={() => setShowOnlyErrors(!showOnlyErrors)}
        >
          {errorCount} errors
        </Button>
        <Badge variant="outline" className="text-[9px] h-5 px-1.5">
          {filtered.length} / {entries.length}
        </Badge>
      </div>

      <div className="max-h-[60vh] overflow-y-auto space-y-0.5 font-mono">
        {filtered.slice(0, 200).map((entry) => {
          const timeStr =
            entry.timestamp instanceof Date && !isNaN(entry.timestamp.getTime())
              ? entry.timestamp.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })
              : "";
          const isSlow = (entry.durationMs || 0) > 5000;
          const isExpanded = expandedId === entry.id;

          return (
            <div key={entry.id}>
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : entry.id)
                }
                className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-muted/20 transition-colors ${
                  !entry.success
                    ? "bg-red-500/5 border-l-2 border-red-500"
                    : isSlow
                    ? "bg-amber-500/5 border-l-2 border-amber-500"
                    : "border-l-2 border-emerald-500/40"
                }`}
              >
                <span className="text-muted-foreground/60 w-16 shrink-0">
                  {timeStr}
                </span>
                <span
                  className={`w-3 shrink-0 ${
                    !entry.success
                      ? "text-red-400"
                      : isSlow
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {!entry.success ? "X" : isSlow ? "!" : "."}
                </span>
                <span className="text-amber-400 w-36 shrink-0 truncate">
                  {entry.toolName}
                </span>
                <span className="text-muted-foreground/50 w-12 shrink-0 text-right">
                  {entry.durationMs != null
                    ? entry.durationMs > 1000
                      ? `${(entry.durationMs / 1000).toFixed(1)}s`
                      : `${entry.durationMs}ms`
                    : "--"}
                </span>
                {entry.isSubagent && (
                  <span className="text-amber-400/60 text-[9px]">SUB</span>
                )}
                <span className="text-muted-foreground/30 truncate flex-1 text-right">
                  {entry.sessionId.length > 12
                    ? entry.sessionId.slice(0, 8) + ".."
                    : entry.sessionId}
                </span>
              </button>
              {isExpanded && (
                <div className="ml-4 px-2 py-1.5 border-l border-muted/30 space-y-1">
                  {entry.params && (
                    <div>
                      <span className="text-[9px] text-muted-foreground">
                        params:
                      </span>
                      <pre className="text-[10px] text-foreground/50 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                        {entry.params}
                      </pre>
                    </div>
                  )}
                  {entry.result && (
                    <div>
                      <span className="text-[9px] text-muted-foreground">
                        result:
                      </span>
                      <pre
                        className={`text-[10px] whitespace-pre-wrap break-all max-h-32 overflow-y-auto ${
                          entry.success
                            ? "text-foreground/40"
                            : "text-red-400/70"
                        }`}
                      >
                        {entry.result}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {entries.length === 0
              ? "No tool calls recorded yet"
              : "No matching tool calls"}
          </div>
        )}
      </div>
    </div>
  );
}
