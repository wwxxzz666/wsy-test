"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConversationMessage } from "@/lib/types";

interface RawJsonToggleProps {
  message: ConversationMessage;
}

export function RawJsonToggle({ message }: RawJsonToggleProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!showRaw) {
    return (
      <button
        onClick={() => setShowRaw(true)}
        className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground font-mono mt-0.5"
      >
        {"{ }"}
      </button>
    );
  }

  return (
    <div className="mt-1 border border-muted/30 rounded bg-black/30 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-muted-foreground font-mono">
          Raw JSONL Entry
        </span>
        <button
          onClick={() => setShowRaw(false)}
          className="text-[9px] text-muted-foreground/60 hover:text-muted-foreground"
        >
          [close]
        </button>
      </div>
      <pre className="text-[10px] text-emerald-400/80 whitespace-pre-wrap break-all leading-relaxed overflow-x-auto max-h-48 overflow-y-auto">
        {JSON.stringify(
          {
            id: message.id,
            sessionId: message.sessionId,
            timestamp: message.timestamp,
            role: message.role,
            content: message.content,
            toolName: message.toolName,
            toolCallId: message.toolCallId,
            durationMs: message.durationMs,
            tokenCount: message.tokenCount,
            metadata: message.metadata,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
