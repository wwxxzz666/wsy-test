export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { agentState } from "@/lib/schema";
import { nanoid } from "nanoid";

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

    const id = nanoid();

    await db.insert(agentState).values({
      id,
      timestamp: new Date(),
      currentSkill: (body.currentSkill as string) || (body.current_skill as string) || null,
      currentRepo: (body.currentRepo as string) || (body.current_repo as string) || null,
      currentIssue: (body.currentIssue as string) || (body.current_issue as string) || null,
      workQueue: body.workQueue || body.work_queue || null,
      pipelineState: body.pipelineState || body.pipeline_state || null,
      activeRepos: body.activeRepos || body.active_repos || null,
      metadata: body.metadata || null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[state] Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest state", details: String(error) },
      { status: 500 }
    );
  }
}
