export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { agentState } from "@/lib/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    await ensureDb();

    const latest = await db
      .select()
      .from(agentState)
      .orderBy(desc(agentState.timestamp))
      .limit(1);

    if (latest.length === 0) {
      return NextResponse.json({
        state: null,
        message: "No agent state reported yet",
      });
    }

    const s = latest[0];
    return NextResponse.json({
      state: {
        id: s.id,
        timestamp: s.timestamp,
        currentSkill: s.currentSkill,
        currentRepo: s.currentRepo,
        currentIssue: s.currentIssue,
        workQueue: s.workQueue,
        pipelineState: s.pipelineState,
        activeRepos: s.activeRepos,
        metadata: s.metadata,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch state", details: String(error) },
      { status: 500 }
    );
  }
}
