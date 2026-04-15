"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { RawJsonToggle } from "./raw-json-toggle";
import type { ConversationMessage } from "@/lib/types";

interface ConversationFeedProps {
  messages: ConversationMessage[];
  autoScroll?: boolean;
  showRawJson?: boolean;
}

const roleConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string; accent: string }
> = {
  assistant: {
    label: "Agent",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    icon: ">>",
    accent: "msg-accent-green",
  },
  user: {
    label: "Prompt",
    color: "text-foreground/70",
    bgColor: "bg-foreground/5 border-foreground/10",
    icon: "$",
    accent: "msg-accent",
  },
  tool_call: {
    label: "Tool",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    icon: "->",
    accent: "msg-accent-yellow",
  },
  tool_result: {
    label: "Result",
    color: "text-foreground/50",
    bgColor: "bg-foreground/5 border-foreground/10",
    icon: "<-",
    accent: "msg-accent",
  },
  system: {
    label: "System",
    color: "text-foreground/40",
    bgColor: "bg-foreground/3 border-foreground/8",
    icon: "#",
    accent: "msg-accent",
  },
  thinking: {
    label: "Think",
    color: "text-amber-400/70",
    bgColor: "bg-amber-500/8 border-amber-500/15",
    icon: "~",
    accent: "msg-accent-yellow",
  },
};

const MAX_COLLAPSED_LINES = 12;

function MessageContent({
  content,
  forceExpanded,
}: {
  content: string;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split("\n");
  const isTruncatable = lines.length > MAX_COLLAPSED_LINES;

  const isExpanded = forceExpanded || expanded;

  const displayContent = isExpanded
    ? content
    : isTruncatable
    ? lines.slice(0, MAX_COLLAPSED_LINES).join("\n")
    : content;

  return (
    <div>
      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
        {displayContent}
      </pre>
      {isTruncatable && !forceExpanded && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-emerald-400/70 hover:text-emerald-400 mt-1 font-mono"
        >
          {expanded
            ? "[ collapse ]"
            : `[ +${lines.length - MAX_COLLAPSED_LINES} more lines ]`}
        </button>
      )}
    </div>
  );
}

export function ConversationFeed({
  messages,
  autoScroll = true,
  showRawJson = false,
}: ConversationFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMsgCountRef = useRef(messages.length);

  // Track new messages when paused
  useEffect(() => {
    if (isPaused && messages.length > prevMsgCountRef.current) {
      setNewMsgCount((c) => c + (messages.length - prevMsgCountRef.current));
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isPaused]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && !isPaused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, autoScroll, isPaused]);

  // Track scroll position to show/hide jump-to-bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => {
    setIsPaused(false);
    setNewMsgCount(0);
  }, []);

  const jumpToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMsgCount(0);
    setIsPaused(false);
  }, []);

  // Count truncatable messages for expand/collapse toggle
  const truncatableCount = useMemo(
    () =>
      messages.filter((m) => m.content?.split("\n").length > MAX_COLLAPSED_LINES)
        .length,
    [messages]
  );

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
        <div className="text-center space-y-2">
          <p>Waiting for agent conversation data...</p>
          <p className="text-xs">
            Messages will appear here as the agent works
          </p>
          <div className="animate-pulse mt-4">
            <span className="text-emerald-400">$</span>{" "}
            <span className="text-muted-foreground">_</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-1 font-mono text-sm overflow-y-auto h-full smooth-scroll relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onScroll={handleScroll}
    >
      {/* Top bar: pause indicator + expand/collapse toggle */}
      <div className="sticky top-0 z-10 flex items-center gap-2">
        {isPaused && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 text-[10px] text-amber-400 text-center flex-1">
            Auto-scroll paused (hover)
            {newMsgCount > 0 && (
              <span className="ml-2 new-msg-badge inline-block bg-emerald-500/20 border border-emerald-500/40 rounded px-1.5 text-emerald-400">
                +{newMsgCount} new
              </span>
            )}
          </div>
        )}
        {truncatableCount > 0 && (
          <button
            onClick={() => setExpandAll(!expandAll)}
            className="bg-muted/50 border border-border rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-auto"
          >
            {expandAll
              ? `[ collapse all (${truncatableCount}) ]`
              : `[ expand all (${truncatableCount}) ]`}
          </button>
        )}
      </div>

      {messages.map((msg) => {
        const config = roleConfig[msg.role] || roleConfig.system;
        const ts =
          typeof msg.timestamp === "string"
            ? new Date(msg.timestamp)
            : msg.timestamp;
        const timeStr =
          ts instanceof Date && !isNaN(ts.getTime())
            ? ts.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })
            : "";
        const absTimeStr =
          ts instanceof Date && !isNaN(ts.getTime())
            ? ts.toISOString().replace("T", " ").slice(0, 19)
            : "";

        const isError =
          msg.role === "tool_result" &&
          (msg.content?.startsWith("ERROR:") ||
            !!(msg.metadata as Record<string, unknown>)?.error);

        const isSlow = (msg.durationMs || 0) > 5000;

        // Detect PII-sanitized content
        const hasSanitized =
          msg.content?.includes("\uFF20") ||
          msg.content?.includes("[REDACTED_EMAIL]") ||
          msg.content?.includes("[REDACTED_PHONE]") ||
          msg.content?.includes("[REDACTED_IP]");

        return (
          <div
            key={msg.id}
            className={`border rounded-md px-3 py-2 ${config.accent} transition-colors ${
              isError
                ? "bg-red-500/10 border-red-500/30 msg-accent-red"
                : isSlow && msg.role === "tool_call"
                ? "bg-amber-500/5 border-amber-500/20"
                : config.bgColor
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`font-bold ${
                  isError
                    ? "text-red-400"
                    : isSlow && msg.role === "tool_call"
                    ? "text-amber-400"
                    : config.color
                }`}
              >
                {isError ? "!!" : config.icon}
              </span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {config.label}
              </Badge>
              {msg.toolName && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-400/70 border-amber-500/20">
                  {msg.toolName}
                </Badge>
              )}
              {msg.durationMs != null && msg.durationMs > 0 && (
                <span
                  className={`text-[10px] ${
                    msg.durationMs > 10000
                      ? "text-red-400"
                      : msg.durationMs > 5000
                      ? "text-amber-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {msg.durationMs > 1000
                    ? `${(msg.durationMs / 1000).toFixed(1)}s`
                    : `${msg.durationMs}ms`}
                </span>
              )}
              {msg.tokenCount != null && msg.tokenCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {msg.tokenCount.toLocaleString()} tok
                </span>
              )}
              {!!(msg.metadata as Record<string, unknown>)?.isSubagent && (
                <Badge
                  variant="outline"
                  className="text-[8px] h-3 px-1 text-amber-400 border-amber-400/30"
                >
                  SUB
                </Badge>
              )}
              {!!(msg.metadata as Record<string, unknown>)?.label && (
                <span className="text-[9px] text-amber-400/80 font-mono">
                  {String((msg.metadata as Record<string, unknown>).label)}
                </span>
              )}
              {!!(msg.metadata as Record<string, unknown>)?.repo && (
                <CopyButton
                  value={`${String(
                    (msg.metadata as Record<string, unknown>).repo
                  )}${
                    (msg.metadata as Record<string, unknown>).issue
                      ? String(
                          (msg.metadata as Record<string, unknown>).issue
                        )
                      : ""
                  }`}
                >
                  <span className="text-[9px] text-foreground/60 font-mono">
                    {String((msg.metadata as Record<string, unknown>).repo)}
                    {(msg.metadata as Record<string, unknown>).issue
                      ? String(
                          (msg.metadata as Record<string, unknown>).issue
                        )
                      : ""}
                  </span>
                </CopyButton>
              )}
              {msg.sessionId && (
                <CopyButton
                  value={msg.sessionId}
                  title={`Session: ${msg.sessionId}`}
                >
                  <span className="text-[10px] text-muted-foreground/50 font-mono">
                    {msg.sessionId.length > 12
                      ? msg.sessionId.slice(0, 8) + ".."
                      : msg.sessionId}
                  </span>
                </CopyButton>
              )}
              {hasSanitized && (
                <Badge
                  variant="outline"
                  className="text-[7px] h-3 px-1 text-emerald-400/60 border-emerald-400/20"
                  title="Content was sanitized by PII filter to prevent 403 errors"
                >
                  PII
                </Badge>
              )}
              <span
                className="text-[10px] text-muted-foreground ml-auto ts-tooltip"
                data-abs-time={absTimeStr}
              >
                {timeStr}
              </span>
            </div>
            <MessageContent
              content={msg.content}
              forceExpanded={expandAll}
            />
            {showRawJson && <RawJsonToggle message={msg} />}
          </div>
        );
      })}

      {/* Jump to bottom FAB */}
      {(isPaused || !isAtBottom) && messages.length > 5 && (
        <div className="sticky bottom-3 z-10 flex justify-center pointer-events-none">
          <Button
            variant="secondary"
            size="sm"
            className="text-[10px] h-6 px-3 pointer-events-auto shadow-lg backdrop-blur-sm bg-background/80 border"
            onClick={jumpToBottom}
          >
            {newMsgCount > 0 ? `Jump to bottom (+${newMsgCount})` : "Jump to bottom"}
          </Button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
