"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConversationMessage } from "@/lib/types";

interface ErrorLogProps {
  messages: ConversationMessage[];
}

interface ErrorEntry {
  id: string;
  timestamp: Date;
  toolName: string | null;
  sessionId: string;
  content: string;
  errorType: string;
  isSubagent: boolean;
}

function classifyError(content: string): string {
  if (content.includes("403")) return "403-filter";
  if (content.includes("timeout") || content.includes("ETIMEDOUT"))
    return "timeout";
  if (content.includes("ENOENT")) return "ENOENT";
  if (content.includes("rate limit") || content.includes("429"))
    return "rate-limit";
  if (content.includes("500") || content.includes("Internal Server"))
    return "server-500";
  if (content.includes("ECONNREFUSED")) return "conn-refused";
  if (content.includes("parse") || content.includes("JSON"))
    return "parse-error";
  if (content.includes("permission") || content.includes("EACCES"))
    return "permission";
  return "other";
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  "403-filter": "text-amber-400 border-amber-400/30",
  timeout: "text-amber-400 border-amber-400/30",
  ENOENT: "text-foreground/50 border-foreground/20",
  "rate-limit": "text-amber-400/70 border-amber-400/20",
  "server-500": "text-red-400 border-red-400/30",
  "conn-refused": "text-red-400 border-red-400/30",
  "parse-error": "text-foreground/50 border-foreground/20",
  permission: "text-red-400/70 border-red-400/20",
  other: "text-foreground/40 border-foreground/15",
};

export function ErrorLog({ messages }: ErrorLogProps) {
  const [filterType, setFilterType] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const errors = useMemo(() => {
    const entries: ErrorEntry[] = [];

    for (const msg of messages) {
      const isError =
        (msg.role === "tool_result" &&
          (msg.content?.startsWith("ERROR:") ||
            !!(msg.metadata as Record<string, unknown>)?.error)) ||
        (msg.role === "system" && msg.content?.includes("error"));

      if (!isError) continue;

      const ts =
        typeof msg.timestamp === "string"
          ? new Date(msg.timestamp)
          : msg.timestamp;

      entries.push({
        id: msg.id,
        timestamp: ts,
        toolName: msg.toolName,
        sessionId: msg.sessionId,
        content: msg.content,
        errorType: classifyError(msg.content),
        isSubagent: !!(msg.metadata as Record<string, unknown>)?.isSubagent,
      });
    }

    return entries.reverse(); // newest first
  }, [messages]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const err of errors) {
      counts[err.errorType] = (counts[err.errorType] || 0) + 1;
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [errors]);

  const filtered = filterType
    ? errors.filter((e) => e.errorType === filterType)
    : errors;

  return (
    <div className="space-y-3">
      {/* Error type filter chips */}
      <div className="flex flex-wrap gap-1">
        <Button
          variant={filterType === null ? "default" : "ghost"}
          size="sm"
          className="text-[10px] h-5 px-2"
          onClick={() => setFilterType(null)}
        >
          All ({errors.length})
        </Button>
        {typeCounts.map(([type, count]) => (
          <Button
            key={type}
            variant={filterType === type ? "default" : "ghost"}
            size="sm"
            className={`text-[10px] h-5 px-2 ${
              filterType !== type
                ? ERROR_TYPE_COLORS[type]?.split(" ")[0] || ""
                : ""
            }`}
            onClick={() => setFilterType(filterType === type ? null : type)}
          >
            {type} ({count})
          </Button>
        ))}
      </div>

      {/* Error entries */}
      <div className="max-h-[60vh] overflow-y-auto space-y-1 font-mono">
        {filtered.slice(0, 100).map((err) => {
          const timeStr =
            err.timestamp instanceof Date && !isNaN(err.timestamp.getTime())
              ? err.timestamp.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })
              : "";
          const isExpanded = expandedId === err.id;
          const colorClass = ERROR_TYPE_COLORS[err.errorType] || "";

          return (
            <div key={err.id}>
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : err.id)
                }
                className="w-full text-left flex items-center gap-2 px-2 py-1 rounded text-[11px] bg-red-500/5 hover:bg-red-500/10 transition-colors border-l-2 border-red-500/50"
              >
                <span className="text-muted-foreground/60 w-16 shrink-0">
                  {timeStr}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[8px] h-3.5 px-1 shrink-0 ${colorClass}`}
                >
                  {err.errorType}
                </Badge>
                {err.toolName && (
                  <span className="text-amber-400/70 w-28 shrink-0 truncate">
                    {err.toolName}
                  </span>
                )}
                <span className="text-red-300/70 truncate flex-1">
                  {err.content.slice(0, 100)}
                </span>
                {err.isSubagent && (
                  <span className="text-amber-400/60 text-[9px] shrink-0">
                    SUB
                  </span>
                )}
              </button>
              {isExpanded && (
                <div className="ml-4 px-2 py-1.5 border-l border-red-500/20">
                  <pre className="text-[10px] text-red-300/60 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {err.content}
                  </pre>
                  <div className="mt-1 text-[9px] text-muted-foreground/40">
                    session: {err.sessionId}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {errors.length === 0
              ? "No errors recorded -- clean run"
              : "No errors matching filter"}
          </div>
        )}
      </div>
    </div>
  );
}
