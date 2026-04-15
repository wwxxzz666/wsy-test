export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { subagentRuns } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * POST /api/ingest/subagent-run
 *
 * Record a sub-agent run start or completion.
 *
 * Start a run:
 *   { "repo": "owner/repo", "issueOrPr": "#123", "type": "implementation" }
 *   Returns { "id": "..." } — use this ID to update the run later.
 *
 * Complete a run (PATCH-style via POST with id):
 *   { "id": "...", "outcome": "success", "prNumber": 456, "durationMs": 120000 }
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

    // If an ID is provided, this is an update to an existing run
    if (body.id && typeof body.id === "string") {
      const updates: Record<string, unknown> = {};

      if (body.outcome) updates.outcome = body.outcome;
      if (body.failureReason) updates.failureReason = body.failureReason;
      if (body.prNumber) updates.prNumber = body.prNumber;
      if (body.durationMs) updates.durationMs = body.durationMs;
      if (body.metadata) updates.metadata = body.metadata;

      // Set finishedAt if outcome is terminal
      const terminalOutcomes = ["success", "failure", "abandoned"];
      if (
        body.outcome &&
        terminalOutcomes.includes(body.outcome as string)
      ) {
        updates.finishedAt = new Date();
      }

      await db
        .update(subagentRuns)
        .set(updates)
        .where(eq(subagentRuns.id, body.id));

      return NextResponse.json({ ok: true, id: body.id, updated: true });
    }

    // Otherwise, create a new run
    const repo = body.repo as string;
    const type = body.type as string;
    if (!repo || !type) {
      return NextResponse.json(
        { error: "repo and type are required" },
        { status: 400 }
      );
    }

    const id = nanoid();
    await db.insert(subagentRuns).values({
      id,
      sessionId: (body.sessionId as string) || null,
      repo,
      issueOrPr: (body.issueOrPr as string) || null,
      type: type as "implementation" | "followup",
      startedAt: new Date(),
      outcome: "in_progress",
      metadata: (body.metadata as Record<string, unknown>) || null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to ingest subagent run", details: String(error) },
      { status: 500 }
    );
  }
}
