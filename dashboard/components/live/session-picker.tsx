"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { formatRelativeTime } from "@/lib/utils";
import type { ConversationSession } from "@/lib/types";

interface SessionPickerProps {
  sessions: ConversationSession[];
  activeSessionId: string | undefined;
  onSelectSession: (sessionId: string | undefined) => void;
}

function getSessionLabel(session: ConversationSession): {
  name: string;
  detail: string | null;
  isSubagent: boolean;
} {
  if (session.isSubagent) {
    const label = session.label
      || (session.repo && session.issue ? `${session.repo}${session.issue}` : null)
      || session.repo
      || session.sessionId.slice(0, 8);
    return {
      name: `Sub: ${label}`,
      detail: session.sessionId.slice(0, 12),
      isSubagent: true,
    };
  }

  return {
    name: "Main: Orchestrator",
    detail: session.sessionId.slice(0, 12),
    isSubagent: false,
  };
}

export function SessionPicker({
  sessions,
  activeSessionId,
  onSelectSession,
}: SessionPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const label = getSessionLabel(s);
      return (
        label.name.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q) ||
        s.repo?.toLowerCase().includes(q) ||
        s.issue?.toLowerCase().includes(q) ||
        s.label?.toLowerCase().includes(q)
      );
    });
  }, [sessions, searchQuery]);

  const mainSessions = filtered.filter((s) => !s.isSubagent);
  const subSessions = filtered.filter((s) => s.isSubagent);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Sessions</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
            {sessions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1">
        {/* Search */}
        {sessions.length > 2 && (
          <Input
            placeholder="Filter sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 text-[10px] mb-2 font-mono"
          />
        )}

        {/* Unified timeline button */}
        <Button
          variant="ghost"
          size="sm"
          className={`w-full justify-start text-xs h-7 ${activeSessionId === undefined ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          onClick={() => onSelectSession(undefined)}
        >
          Unified Timeline (all sessions)
        </Button>

        {/* Main orchestrator sessions */}
        {mainSessions.length > 0 && (
          <div className="pt-1">
            <div className="text-[9px] text-muted-foreground/60 px-1 pb-1 font-mono uppercase tracking-wider">
              Orchestrator
            </div>
            {mainSessions.map((session) => (
              <SessionButton
                key={session.sessionId}
                session={session}
                isActive={activeSessionId === session.sessionId}
                onClick={() => onSelectSession(session.sessionId)}
              />
            ))}
          </div>
        )}

        {/* Sub-agent sessions */}
        {subSessions.length > 0 && (
          <div className="pt-1">
            <div className="text-[9px] text-muted-foreground/60 px-1 pb-1 font-mono uppercase tracking-wider">
              Sub-Agents ({subSessions.length})
            </div>
            {subSessions.map((session) => (
              <SessionButton
                key={session.sessionId}
                session={session}
                isActive={activeSessionId === session.sessionId}
                onClick={() => onSelectSession(session.sessionId)}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 && sessions.length > 0 && (
          <p className="text-xs text-muted-foreground text-center py-2 font-mono">
            No matching sessions
          </p>
        )}

        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No sessions yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SessionButton({
  session,
  isActive,
  onClick,
}: {
  session: ConversationSession;
  isActive: boolean;
  onClick: () => void;
}) {
  const last =
    typeof session.lastMessage === "string"
      ? new Date(session.lastMessage)
      : session.lastMessage;
  const label = getSessionLabel(session);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`w-full justify-start text-xs h-auto py-1.5 flex-col items-start ${isActive ? "bg-muted text-foreground" : "text-muted-foreground"}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 w-full">
        {label.isSubagent ? (
          <span className="text-[9px] text-amber-400">{"~>"}</span>
        ) : (
          <span className="text-[9px] text-foreground/70">{"#"}</span>
        )}
        <span
          className={`font-mono truncate flex-1 text-left ${
            label.isSubagent ? "text-amber-400" : "text-foreground/70"
          }`}
        >
          {label.name}
        </span>
        {session.isActive && (
          <Badge
            variant="outline"
            className="text-[9px] h-3.5 px-1 text-emerald-400 border-emerald-500/30"
          >
            LIVE
          </Badge>
        )}
      </div>
      {label.detail && (
        <div className="w-full">
          <CopyButton value={session.sessionId} className="block w-full text-left">
            <span className="text-[9px] text-muted-foreground/50 font-mono truncate block">
              {label.detail}
            </span>
          </CopyButton>
        </div>
      )}
      <div className="flex items-center gap-2 w-full text-muted-foreground">
        <span>{session.messageCount} msgs</span>
        <span>{formatRelativeTime(last)}</span>
      </div>
    </Button>
  );
}
