export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/ingest/merge-probability
 *
 * Update merge probability scores for PRs. Called by the agent's
 * scoring model (V10) after computing P(merge) for each candidate.
 *
 * Body: { "scores": [ { "repo": "owner/repo", "number": 123, "score": 72 }, ... ] }
 * Or single: { "repo": "owner/repo", "number": 123, "score": 72 }
 *
 * Score is an integer 0-100 representing P(merge).
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

    // Support both single and batch updates
    let scores: { repo: string; number: number; score: number }[];

    if (Array.isArray(body.scores)) {
      scores = body.scores as { repo: string; number: number; score: number }[];
    } else if (body.repo && body.number != null && body.score != null) {
      scores = [
        {
          repo: body.repo as string,
          number: body.number as number,
          score: body.score as number,
        },
      ];
    } else {
      return NextResponse.json(
        { error: "Provide {repo, number, score} or {scores: [{repo, number, score}, ...]}" },
        { status: 400 }
      );
    }

    let updated = 0;
    let notFound = 0;

    for (const { repo, number, score } of scores) {
      if (!repo || number == null || score == null) continue;

      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
      const prId = `${repo}#${number}`;

      const result = await db
        .update(pullRequests)
        .set({ mergeProbability: clampedScore })
        .where(eq(pullRequests.id, prId));

      if (result.rowsAffected > 0) {
        updated++;
      } else {
        notFound++;
      }
    }

    return NextResponse.json({ ok: true, updated, notFound });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to ingest merge probability", details: String(error) },
      { status: 500 }
    );
  }
}
