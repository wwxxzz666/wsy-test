const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://clawoss-dashboard.vercel.app";
const AGENT_ID = "clawoss";
const GITHUB_USERNAME = "BillionClaw";
const ACTIVE_MODEL = process.env.CLAWOSS_MODEL_PRIMARY || "unknown";
const ACTIVE_PROVIDER = ACTIVE_MODEL.includes("/")
  ? ACTIVE_MODEL.split("/")[0]
  : "custom";
const INPUT_COST_PER_TOKEN =
  (Number(process.env.CLAWOSS_MODEL_INPUT_COST_PER_MTOK || "0.6") || 0.6) /
  1_000_000;
const OUTPUT_COST_PER_TOKEN =
  (Number(process.env.CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK || "3.0") || 3.0) /
  1_000_000;

let accumulatedInputTokens = 0;
let accumulatedOutputTokens = 0;
let accumulatedDurationMs = 0;
let toolCallCount = 0;
let startTime = Date.now();
let lastSkillName: string | null = null;
let lastRepoName: string | null = null;
let lastIssueName: string | null = null;
const reposUsed = new Set<string>();
const subagentMeta = new Map<
  string,
  { repo: string | null; issue: string | null; task: string }
>();

async function postNonBlocking(
  path: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<void> {
  const url = `${DASHBOARD_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) return;
      console.error(
        `[dashboard-reporter] POST ${path} returned ${res.status}`
      );
    } catch (err) {
      console.error(
        `[dashboard-reporter] POST ${path} failed (attempt ${attempt + 1}):`,
        err
      );
    }

    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
}

// Fire-and-forget conversation message — no retry, short timeout
async function postConversation(
  body: Record<string, unknown>,
  apiKey: string
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    await fetch(`${DASHBOARD_URL}/api/ingest/conversation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch {
    // Silently ignore — conversation logs are supplementary
  }
}

// Post agent state snapshot (work queue, pipeline, repos, skill)
async function postState(apiKey: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    // Try to read work queue and pipeline state from workspace memory files
    let workQueue: unknown[] = [];
    let pipelineState: Record<string, unknown> = {};

    try {
      const fs = await import("fs");
      const wqPath = `${process.cwd()}/workspace/memory/work-queue.md`;
      const psPath = `${process.cwd()}/workspace/memory/pipeline-state.md`;

      // Parse work queue markdown table
      try {
        const wqContent = fs.readFileSync(wqPath, "utf-8");
        const lines = wqContent.split("\n").filter(
          (l: string) =>
            l.includes("|") &&
            !l.startsWith("priority") &&
            !l.startsWith("--") &&
            !l.startsWith("#") &&
            !l.startsWith("<!--")
        );
        workQueue = lines
          .map((line: string) => {
            const parts = line.split("|").map((p: string) => p.trim());
            return {
              priority: parts[0] || "MEDIUM",
              repo: parts[1] || "",
              issue: parts[2] || "",
              title: parts[3] || "",
              solvabilityScore: parseInt(parts[4]) || 0,
              discovered: parts[5] || "",
            };
          })
          .filter((item: { repo: string }) => item.repo);
      } catch {
        // File may not exist yet
      }

      // Parse pipeline state
      try {
        const psContent = fs.readFileSync(psPath, "utf-8");
        const statsMatch = psContent.match(/submitted:\s*(\d+)/);
        const mergedMatch = psContent.match(/merged:\s*(\d+)/);
        const rejectedMatch = psContent.match(/rejected:\s*(\d+)/);
        const abandonedMatch = psContent.match(/abandoned:\s*(\d+)/);
        pipelineState = {
          activePRs: [],
          statsToday: {
            submitted: statsMatch ? parseInt(statsMatch[1]) : 0,
            merged: mergedMatch ? parseInt(mergedMatch[1]) : 0,
            rejected: rejectedMatch ? parseInt(rejectedMatch[1]) : 0,
            abandoned: abandonedMatch ? parseInt(abandonedMatch[1]) : 0,
          },
        };
      } catch {
        // File may not exist yet
      }
    } catch {
      // fs import may fail in some environments
    }

    await fetch(`${DASHBOARD_URL}/api/ingest/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        currentSkill: lastSkillName,
        currentRepo: lastRepoName,
        currentIssue: lastIssueName,
        workQueue,
        pipelineState,
        activeRepos: Array.from(reposUsed),
        metadata: {
          agent_id: AGENT_ID,
          tool_calls: toolCallCount,
          model: ACTIVE_MODEL,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch {
    // Silently ignore state posting failures
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
  result?: unknown;
  durationMs?: number;
  runId?: string;
  toolCallId?: string;
  error?: string;
  assistantMessage?: string;
  userMessage?: string;
  skillName?: string;
}) => {
  const apiKey = process.env.CLAW_API_KEY;
  if (!apiKey) {
    console.warn("[dashboard-reporter] CLAW_API_KEY not set, skipping");
    return;
  }

  const sessionId = event.sessionKey || event.runId || "main";
  const ts = event.timestamp?.toISOString() || new Date().toISOString();

  try {
    // Track skill name if provided
    if (event.skillName) {
      lastSkillName = event.skillName;
    }

    // Stream user messages to conversation feed
    if (event.type === "user_message" || event.action === "user_message") {
      if (event.userMessage) {
        await postConversation(
          {
            messages: [
              {
                sessionId,
                role: "user",
                content: event.userMessage.slice(0, 5000),
                timestamp: ts,
                metadata: { agent_id: AGENT_ID },
              },
            ],
          },
          apiKey
        );
      }
      return;
    }

    // After a tool call: accumulate metrics + stream tool call to conversation feed
    if (
      event.type === "after_tool_call" ||
      event.action === "after_tool_call"
    ) {
      toolCallCount++;
      if (event.durationMs) {
        accumulatedDurationMs += event.durationMs;
      }

      const params = event.params || {};
      if (typeof params === "object") {
        const paramStr = JSON.stringify(params);
        accumulatedInputTokens += Math.ceil(paramStr.length / 4);
        accumulatedOutputTokens += Math.ceil(paramStr.length / 8);
      }

      // Track repos from tool params
      const paramStr = JSON.stringify(params);
      const repoMatch = paramStr.match(
        /(?:repos?|repository)['":\s]+([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/i
      );
      if (repoMatch) {
        reposUsed.add(repoMatch[1]);
        lastRepoName = repoMatch[1];
      }

      // Track issue numbers
      const issueMatch = paramStr.match(/#(\d+)/);
      if (issueMatch) {
        lastIssueName = `#${issueMatch[1]}`;
      }

      // Detect sub-agent lifecycle events and relay their conversations
      const toolName = event.toolName || "unknown";

      // When orchestrator spawns a sub-agent, log it and extract repo/issue
      if (toolName === "sessions_spawn" && event.result) {
        try {
          const spawnResult =
            typeof event.result === "string"
              ? JSON.parse(event.result)
              : event.result;
          const childKey =
            (spawnResult as Record<string, string>)?.childSessionKey || null;
          if (childKey) {
            // Extract repo and issue from the spawn task text
            const taskText =
              typeof params === "object" &&
              "task" in (params as Record<string, unknown>)
                ? String((params as Record<string, string>).task)
                : "";
            const taskRepoMatch = taskText.match(
              /([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)/
            );
            const taskRepo = taskRepoMatch ? taskRepoMatch[1] : lastRepoName;
            const taskIssue = taskRepoMatch
              ? `#${taskRepoMatch[2]}`
              : lastIssueName;

            // Store mapping so we can tag relayed messages later
            subagentMeta.set(childKey, {
              repo: taskRepo,
              issue: taskIssue,
              task: taskText.slice(0, 500),
            });

            await postConversation(
              {
                messages: [
                  {
                    sessionId: childKey,
                    role: "system",
                    content: `Sub-agent spawned. Task: ${taskText.slice(0, 500) || "(unknown)"}`,
                    timestamp: ts,
                    metadata: {
                      agent_id: AGENT_ID,
                      event: "subagent_spawn",
                      parent_session: sessionId,
                      child_session: childKey,
                      repo: taskRepo,
                      issue: taskIssue,
                    },
                  },
                ],
              },
              apiKey
            );
          }
        } catch {
          // Parse failure — not critical
        }
      }

      // When orchestrator reads sub-agent history, relay those messages
      if (toolName === "sessions_history" && event.result) {
        try {
          const historyResult =
            typeof event.result === "string"
              ? JSON.parse(event.result)
              : event.result;
          const hist = historyResult as {
            sessionKey?: string;
            messages?: Array<{
              role: string;
              content: unknown;
            }>;
          };
          const childKey = hist?.sessionKey || null;
          const childMessages = hist?.messages || [];

          if (childKey && childMessages.length > 0) {
            // Look up repo/issue for this sub-agent
            const meta = subagentMeta.get(childKey);
            const childRepo = meta?.repo || lastRepoName;
            const childIssue = meta?.issue || lastIssueName;

            const relayMsgs: Record<string, unknown>[] = [];
            for (const cm of childMessages.slice(-20)) {
              const role = cm.role;
              let content = "";

              if (typeof cm.content === "string") {
                content = cm.content.slice(0, 3000);
              } else if (Array.isArray(cm.content)) {
                const parts: string[] = [];
                for (const block of cm.content as Array<Record<string, unknown>>) {
                  if (block.type === "text" && typeof block.text === "string") {
                    parts.push(block.text.slice(0, 1000));
                  } else if (block.type === "toolCall") {
                    parts.push(
                      `[TOOL] ${block.name || "?"}(${JSON.stringify(block.arguments || {}).slice(0, 200)})`
                    );
                  } else if (block.type === "toolResult") {
                    const resultContent = block.content || block.text || "";
                    const resultText =
                      typeof resultContent === "string"
                        ? resultContent
                        : Array.isArray(resultContent)
                        ? (resultContent as Array<Record<string, string>>)
                            .filter((b) => b.type === "text")
                            .map((b) => b.text || "")
                            .join("\n")
                        : JSON.stringify(resultContent);
                    parts.push(`[RESULT] ${resultText.slice(0, 500)}`);
                  }
                }
                content = parts.join("\n").slice(0, 3000);
              }

              if (!content.trim()) continue;

              // Map OpenClaw roles to dashboard roles
              let dashRole: string;
              if (role === "assistant") dashRole = "assistant";
              else if (role === "user") dashRole = "user";
              else if (role === "toolResult") dashRole = "tool_result";
              else dashRole = "system";

              relayMsgs.push({
                sessionId: childKey,
                role: dashRole,
                content,
                timestamp: ts,
                metadata: {
                  agent_id: AGENT_ID,
                  source: "subagent_relay",
                  parent_session: sessionId,
                  repo: childRepo,
                  issue: childIssue,
                },
              });
            }

            if (relayMsgs.length > 0) {
              await postConversation({ messages: relayMsgs }, apiKey);
            }
          }
        } catch {
          // Parse failure — not critical
        }
      }

      // Stream tool call to live conversation feed
      const paramsSummary = params
        ? JSON.stringify(params, null, 2).slice(0, 2000)
        : "";

      const messages: Record<string, unknown>[] = [
        {
          sessionId,
          role: "tool_call",
          content: paramsSummary || `(no params)`,
          toolName,
          toolCallId: event.toolCallId || null,
          durationMs: event.durationMs || null,
          timestamp: ts,
          metadata: { agent_id: AGENT_ID, skill: lastSkillName },
        },
      ];

      // Include tool result if available
      const resultStr = event.result
        ? typeof event.result === "string"
          ? event.result.slice(0, 3000)
          : JSON.stringify(event.result, null, 2).slice(0, 3000)
        : null;

      if (resultStr) {
        messages.push({
          sessionId,
          role: "tool_result",
          content: resultStr,
          toolName,
          toolCallId: event.toolCallId || null,
          durationMs: event.durationMs || null,
          timestamp: ts,
          metadata: { agent_id: AGENT_ID },
        });
      }

      // If there was an error from the tool call
      if (event.error) {
        messages.push({
          sessionId,
          role: "tool_result",
          content: `ERROR: ${event.error}`,
          toolName,
          toolCallId: event.toolCallId || null,
          timestamp: ts,
          metadata: { agent_id: AGENT_ID, error: true },
        });
      }

      await postConversation({ messages }, apiKey);
      return;
    }

    // On agent_end: flush accumulated metrics + stream completion + post state
    if (event.type === "agent_end" || event.action === "agent_end") {
      const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Stream the last assistant message and any conversation messages
      const convMessages: Record<string, unknown>[] = [];

      // If we have the assistant's final message, send it
      if (event.assistantMessage) {
        convMessages.push({
          sessionId,
          role: "assistant",
          content: event.assistantMessage.slice(0, 5000),
          timestamp: ts,
          tokenCount: accumulatedOutputTokens || null,
          metadata: {
            agent_id: AGENT_ID,
            event: "agent_end",
            skill: lastSkillName,
          },
        });
      }

      // Send any messages array content as conversation turns
      if (event.messages && Array.isArray(event.messages)) {
        for (const msg of event.messages.slice(-10)) {
          if (typeof msg === "string" && msg.trim()) {
            convMessages.push({
              sessionId,
              role: "assistant",
              content: msg.slice(0, 5000),
              timestamp: ts,
              metadata: { agent_id: AGENT_ID, source: "messages_array" },
            });
          }
        }
      }

      // Stream a system message about the run completion
      convMessages.push({
        sessionId,
        role: "system",
        content: event.error
          ? `Run ended with error: ${event.error} (${toolCallCount} tool calls, ${uptimeSeconds}s)`
          : `Run completed: ${toolCallCount} tool calls, ${uptimeSeconds}s, ~${accumulatedInputTokens + accumulatedOutputTokens} tokens`,
        timestamp: ts,
        metadata: {
          agent_id: AGENT_ID,
          event: "agent_end",
          tool_calls: toolCallCount,
          uptime_seconds: uptimeSeconds,
          had_error: !!event.error,
          repos: Array.from(reposUsed),
          skill: lastSkillName,
        },
      });

      if (convMessages.length > 0) {
        await postConversation({ messages: convMessages }, apiKey);
      }

      // Post agent state snapshot (work queue, pipeline, repos, skill)
      await postState(apiKey);

      // Send heartbeat with enriched metadata
      await postNonBlocking(
        "/api/ingest/heartbeat",
        {
          agent_id: AGENT_ID,
          github_username: GITHUB_USERNAME,
          status: event.error ? "degraded" : "alive",
          currentTask: lastSkillName || null,
          uptimeSeconds,
          metadata: {
            session_key: sessionId,
            tool_calls: toolCallCount,
            model: ACTIVE_MODEL,
            repos: Array.from(reposUsed),
            skill: lastSkillName,
          },
        },
        apiKey
      );

      // Send accumulated metrics if any
      if (accumulatedInputTokens > 0 || accumulatedOutputTokens > 0) {
        const costUsd =
          accumulatedInputTokens * INPUT_COST_PER_TOKEN +
          accumulatedOutputTokens * OUTPUT_COST_PER_TOKEN;

        await postNonBlocking(
          "/api/ingest/metrics",
          {
            metrics: [
              {
                channel: "agent",
                provider: ACTIVE_PROVIDER,
                model: ACTIVE_MODEL,
                inputTokens: accumulatedInputTokens,
                outputTokens: accumulatedOutputTokens,
                costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
                runDurationMs: accumulatedDurationMs,
                contextTokens: accumulatedInputTokens,
              },
            ],
          },
          apiKey
        );

        // Reset accumulators
        accumulatedInputTokens = 0;
        accumulatedOutputTokens = 0;
        accumulatedDurationMs = 0;
        toolCallCount = 0;
      }

      // Log agent completion with enriched metadata
      await postNonBlocking(
        "/api/ingest/logs",
        {
          entries: [
            {
              level: event.error ? "error" : "info",
              source: "hook:dashboard-reporter",
              message: event.error
                ? `Agent run ended with error: ${event.error}`
                : `Agent run completed (${toolCallCount} tool calls, ${uptimeSeconds}s, repos: ${Array.from(reposUsed).join(", ") || "none"})`,
              timestamp: ts,
              metadata: {
                event: "agent_end",
                agent_id: AGENT_ID,
                session_key: sessionId,
                run_id: event.runId || null,
                repos: Array.from(reposUsed),
                skill: lastSkillName,
              },
            },
          ],
        },
        apiKey
      );

      // Reset state tracking for next run
      lastSkillName = null;
      lastRepoName = null;
      lastIssueName = null;
      reposUsed.clear();
    }
  } catch (err) {
    // Never let telemetry errors disrupt agent work
    console.error("[dashboard-reporter] Unhandled error:", err);
  }
};

export default handler;
