const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://clawoss-dashboard.vercel.app";
const AGENT_ID = "clawoss";

async function postLog(
  entries: Record<string, unknown>[],
  apiKey: string
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    await fetch(`${DASHBOARD_URL}/api/ingest/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ entries }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    // Fire-and-forget — never block agent
    console.error("[audit-logger] Failed to post:", err);
  }
}

const handler = async (event: {
  type: string;
  action: string;
  sessionKey?: string;
  timestamp: Date;
  messages: string[];
  toolName?: string;
  params?: Record<string, unknown>;
  durationMs?: number;
  runId?: string;
  toolCallId?: string;
  error?: string;
}) => {
  const apiKey = process.env.CLAW_API_KEY;
  if (!apiKey) return;

  try {
    const ts = event.timestamp?.toISOString() || new Date().toISOString();
    const base = {
      source: "hook:audit-logger",
      timestamp: ts,
      metadata: {
        agent_id: AGENT_ID,
        session_key: event.sessionKey || "unknown",
        run_id: event.runId || null,
      },
    };

    // New command/session
    if (event.type === "command" && event.action === "new") {
      await postLog(
        [
          {
            ...base,
            level: "info",
            message: `Session started: ${event.sessionKey || "unknown"}`,
            metadata: {
              ...base.metadata,
              event: "session_start",
            },
          },
        ],
        apiKey
      );
      return;
    }

    // Tool call completed
    if (event.type === "after_tool_call" || event.action === "after_tool_call") {
      const toolName = event.toolName || "unknown";
      const duration = event.durationMs || 0;
      const hasError = !!event.error;

      await postLog(
        [
          {
            ...base,
            level: hasError ? "warn" : "debug",
            message: hasError
              ? `Tool call failed: ${toolName} (${duration}ms) — ${event.error}`
              : `Tool call: ${toolName} (${duration}ms)`,
            metadata: {
              ...base.metadata,
              event: "tool_call",
              tool_name: toolName,
              tool_call_id: event.toolCallId || null,
              duration_ms: duration,
              had_error: hasError,
            },
          },
        ],
        apiKey
      );
      return;
    }

    // Agent ended
    if (event.type === "agent_end" || event.action === "agent_end") {
      await postLog(
        [
          {
            ...base,
            level: event.error ? "error" : "info",
            message: event.error
              ? `Agent ended with error: ${event.error}`
              : "Agent run completed successfully",
            metadata: {
              ...base.metadata,
              event: "agent_end",
              had_error: !!event.error,
            },
          },
        ],
        apiKey
      );
      return;
    }
  } catch (err) {
    // Never disrupt agent work
    console.error("[audit-logger] Unhandled error:", err);
  }
};

export default handler;
