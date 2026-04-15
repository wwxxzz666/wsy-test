"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { ConversationFeed } from "@/components/live/conversation-feed";
import { SessionPicker } from "@/components/live/session-picker";
import { LiveStatsBar } from "@/components/live/live-stats-bar";
import { ToolAnalytics } from "@/components/live/tool-analytics";
import { ToolCallLog } from "@/components/live/tool-call-log";
import { ErrorLog } from "@/components/live/error-log";
import { CostBreakdown } from "@/components/live/cost-breakdown";
import { GatewayStatus } from "@/components/live/gateway-status";
import { SessionDetail } from "@/components/live/session-detail";
import { AgentStatePanel } from "@/components/live/agent-state-panel";
import { ErrorAlertBanner } from "@/components/live/error-alert-banner";
import {
  MessageFilters,
  type RoleFilter,
} from "@/components/live/message-filters";
import {
  useConversation,
  useConversationSessions,
} from "@/lib/hooks/use-conversation";
import { useConnectionStatus } from "@/lib/hooks/use-connection-status";
import { useAgentState } from "@/lib/hooks/use-agent-state";
import { SessionTabs } from "@/components/live/session-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
// Tabs removed — right sidebar uses ghost+tab-active pattern

type ViewMode = "combined" | "orchestrator" | "subagents";
type MainTab = "feed" | "tools" | "errors" | "costs";
type RightTab = "state" | "gateway" | "analytics";

export default function LivePage() {
  const [selectedSession, setSelectedSession] = useState<string | undefined>(
    undefined
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [mainTab, setMainTab] = useState<MainTab>("feed");
  const [rightTab, setRightTab] = useState<RightTab>("state");

  const { data: conversationData, isLoading } =
    useConversation(selectedSession);
  const { data: sessionsData } = useConversationSessions();
  const { data: connectionData } = useConnectionStatus();
  const { data: stateData, isLoading: stateLoading } = useAgentState();

  const allMessages = conversationData?.messages || [];
  const sessions = sessionsData?.sessions || [];
  const isConnected = connectionData?.connection?.state === "connected";
  const agentState = stateData?.state || null;

  const lastHeartbeat = connectionData?.connection?.lastHeartbeat || null;
  const errorsLastHour = connectionData?.pipeline?.errorsLastHour || 0;
  const heartbeatsLastHour = connectionData?.pipeline?.heartbeatsLastHour || 0;
  const connectionState = connectionData?.connection?.state || "unknown";

  const activeSession = selectedSession
    ? sessions.find((s) => s.sessionId === selectedSession)
    : undefined;

  // Filter messages by view mode, role, and search
  const filteredMessages = useMemo(() => {
    let msgs = allMessages;

    if (viewMode === "orchestrator") {
      // Show messages from non-subagent sessions
      const subagentSessionIds = new Set(
        sessions.filter((s) => s.isSubagent).map((s) => s.sessionId)
      );
      msgs = msgs.filter((m) => !subagentSessionIds.has(m.sessionId));
    } else if (viewMode === "subagents") {
      // Show messages from subagent sessions only
      const subagentSessionIds = new Set(
        sessions.filter((s) => s.isSubagent).map((s) => s.sessionId)
      );
      msgs = msgs.filter((m) => subagentSessionIds.has(m.sessionId));
    }

    if (roleFilter !== "all") {
      msgs = msgs.filter((m) => m.role === roleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      msgs = msgs.filter(
        (m) =>
          m.content?.toLowerCase().includes(q) ||
          m.toolName?.toLowerCase().includes(q) ||
          m.sessionId?.toLowerCase().includes(q)
      );
    }
    return msgs;
  }, [allMessages, viewMode, roleFilter, searchQuery]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+J or Cmd+J: toggle auto-scroll
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        setAutoScroll((prev) => !prev);
      }
      // Ctrl+Shift+R or Cmd+Shift+R: toggle raw JSON
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "R") {
        e.preventDefault();
        setShowRawJson((prev) => !prev);
      }
      // 1-4: switch main tabs when not focused on input
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        const tabMap: Record<string, MainTab> = {
          "1": "feed",
          "2": "tools",
          "3": "errors",
          "4": "costs",
        };
        if (tabMap[e.key]) {
          e.preventDefault();
          setMainTab(tabMap[e.key]);
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const subagentCount = sessions.filter((s) => s.isSubagent).length;

  const errorCount = allMessages.filter(
    (m) =>
      m.role === "tool_result" &&
      (m.content?.startsWith("ERROR:") ||
        !!(m.metadata as Record<string, unknown>)?.error)
  ).length;

  return (
    <div className="flex flex-col h-screen">
      <Header title="Live Feed" />
      <ErrorAlertBanner
        errorsLastHour={errorsLastHour}
        lastHeartbeat={lastHeartbeat}
        connectionState={connectionState}
      />
      <LiveStatsBar
        messages={allMessages}
        isConnected={isConnected}
        lastHeartbeat={lastHeartbeat}
        errorsLastHour={errorsLastHour}
      />

      {/* Session tabs - prominent horizontal tab bar */}
      <SessionTabs
        sessions={sessions}
        activeSessionId={selectedSession}
        onSelectSession={(sid) => {
          setSelectedSession(sid);
          // Auto-set view mode based on selection
          if (!sid) setViewMode("combined");
        }}
      />

      {/* Controls bar */}
      <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border/40 overflow-x-auto">
        {/* View mode */}
        {(
          [
            { value: "combined", label: "Unified Timeline" },
            { value: "orchestrator", label: "Orchestrator Only" },
            { value: "subagents", label: `Sub-Agents (${subagentCount})` },
          ] as const
        ).map((mode) => (
          <Button
            key={mode.value}
            variant="ghost"
            size="sm"
            className={`text-[10px] h-5 px-2 ${viewMode === mode.value ? "tab-active" : "text-muted-foreground"}`}
            onClick={() => setViewMode(mode.value)}
          >
            {mode.label}
          </Button>
        ))}

        <div className="w-px h-3 bg-border/30 mx-1" />

        {/* Main tabs */}
        {(
          [
            { value: "feed", label: "Feed" },
            { value: "tools", label: "Tools" },
            { value: "errors", label: `Errors${errorCount > 0 ? ` (${errorCount})` : ""}` },
            { value: "costs", label: "Costs" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.value}
            variant="ghost"
            size="sm"
            className={`text-[10px] h-5 px-2 ${mainTab === tab.value ? "tab-active" : "text-muted-foreground"} ${
              tab.value === "errors" && errorCount > 0 ? "!text-red-400" : ""
            }`}
            onClick={() => setMainTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}

        <div className="w-px h-3 bg-border/30 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          className={`text-[10px] h-5 px-2 font-mono ${showRawJson ? "tab-active" : "text-muted-foreground"}`}
          onClick={() => setShowRawJson(!showRawJson)}
          title="Toggle raw JSON view"
        >
          {"{ }"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-[10px] h-5 px-2 ${autoScroll ? "tab-active" : "text-muted-foreground"}`}
          onClick={() => setAutoScroll(!autoScroll)}
          title="Toggle auto-scroll (Ctrl+J)"
        >
          {autoScroll ? "scroll:on" : "scroll:off"}
        </Button>

        <div className="ml-auto text-[9px] text-muted-foreground/20 font-mono hidden md:block">
          1-4:tabs | Ctrl+J:scroll | Ctrl+Shift+R:json
        </div>
      </div>

      {mainTab === "feed" && (
        <MessageFilters
          activeFilter={roleFilter}
          onFilterChange={setRoleFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-56 border-r overflow-y-auto shrink-0 hidden md:block">
          <div className="p-3 space-y-3">
            <SessionPicker
              sessions={sessions}
              activeSessionId={selectedSession}
              onSelectSession={setSelectedSession}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : mainTab === "feed" ? (
            <ConversationFeed
              messages={filteredMessages}
              autoScroll={autoScroll}
              showRawJson={showRawJson}
            />
          ) : mainTab === "tools" ? (
            <ToolCallLog messages={filteredMessages} />
          ) : mainTab === "errors" ? (
            <ErrorLog messages={allMessages} />
          ) : mainTab === "costs" ? (
            <CostBreakdown messages={allMessages} />
          ) : null}
        </div>

        {/* Right Sidebar */}
        <div className="w-72 border-l overflow-y-auto shrink-0 hidden lg:block">
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border/40">
            {(
              [
                { value: "state", label: "State" },
                { value: "gateway", label: "Gateway" },
                { value: "analytics", label: "Stats" },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.value}
                variant="ghost"
                size="sm"
                className={`text-[10px] h-6 px-2.5 flex-1 ${
                  rightTab === tab.value ? "tab-active" : "text-muted-foreground"
                }`}
                onClick={() => setRightTab(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="p-3 space-y-3">
            {rightTab === "state" ? (
              <AgentStatePanel state={agentState} isLoading={stateLoading} />
            ) : rightTab === "gateway" ? (
              <GatewayStatus
                lastHeartbeat={lastHeartbeat}
                connectionState={connectionState}
                heartbeatsLastHour={heartbeatsLastHour}
                errorsLastHour={errorsLastHour}
                sessions={sessions}
                model={connectionData?.connection?.model || "unknown"}
                tokenBudget={connectionData?.connection?.tokenBudget}
              />
            ) : (
              <>
                <SessionDetail
                  session={activeSession}
                  messages={selectedSession ? allMessages : allMessages}
                />
                <ToolAnalytics messages={allMessages} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
