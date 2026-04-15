export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { agentState } from "@/lib/schema";
import { nanoid } from "nanoid";

/**
 * POST /api/ingest/subagent-health
 *
 * Accept subagent health data from the agent's heartbeat cycle.
 *
 * Body:
 * {
 *   alwaysOn: {
 *     scout: { status, contextPct, ageMinutes, sessionKey },
 *     prMonitor: { status, contextPct, ageMinutes, sessionKey },
 *     prAnalyst: { status, contextPct, ageMinutes, sessionKey }
 *   },
 *   implSlots: [
 *     { label, repo, issue, status, contextPct, ageMinutes } | null
 *   ],
 *   timestamp?: string
 * }
 *
 * Stores in agent_state with currentSkill = "subagent-health" and the
 * payload in the metadata JSON field.
 */
export async function POST(request: Request) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    await ensureDb();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const alwaysOn = body.alwaysOn || body.always_on;
    const implSlots = body.implSlots || body.impl_slots;

    if (!alwaysOn) {
      return NextResponse.json(
        { error: "alwaysOn field is required" },
        { status: 400 }
      );
    }

    const id = nanoid();
    const timestamp = body.timestamp
      ? new Date(body.timestamp as string)
      : new Date();

    await db.insert(agentState).values({
      id,
      timestamp,
      currentSkill: "subagent-health",
      currentRepo: null,
      currentIssue: null,
      workQueue: null,
      pipelineState: null,
      activeRepos: null,
      metadata: {
        alwaysOn,
        implSlots: implSlots || [],
        ingestedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[subagent-health] Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest subagent health", details: String(error) },
      { status: 500 }
    );
  }
}
