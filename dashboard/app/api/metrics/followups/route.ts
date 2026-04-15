export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { subagentRuns, pullRequests } from "@/lib/schema";
import { sql, eq, desc, gte } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * GET /api/metrics/followups?range=30d
 *
 * Returns follow-up sub-agent tracking data:
 * - Per-PR follow-up rounds and outcomes
 * - Conversion rate: follow-ups that led to a merge
 * - Active follow-ups currently in progress
 */
export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "30d";
    const days = parseInt(range) || 30;
    const since = subDays(new Date(), days);

    // All follow-up runs
    const followupRuns = await db
      .select()
      .from(subagentRuns)
      .where(eq(subagentRuns.type, "followup"))
      .orderBy(desc(subagentRuns.startedAt));

    // Group by PR (issueOrPr field contains PR reference like "#123")
    const prFollowups = new Map<
      string,
      {
        repo: string;
        pr: string;
        rounds: number;
        latestOutcome: string;
        latestAt: Date;
        totalDurationMs: number;
        isActive: boolean;
      }
    >();

    for (const run of followupRuns) {
      const key = `${run.repo}:${run.issueOrPr || run.prNumber || "unknown"}`;
      const existing = prFollowups.get(key);
      if (existing) {
        existing.rounds++;
        existing.totalDurationMs += run.durationMs || 0;
        if (run.outcome === "in_progress") existing.isActive = true;
      } else {
        prFollowups.set(key, {
          repo: run.repo,
          pr: run.issueOrPr || `#${run.prNumber}` || "unknown",
          rounds: 1,
          latestOutcome: run.outcome,
          latestAt: run.startedAt,
          totalDurationMs: run.durationMs || 0,
          isActive: run.outcome === "in_progress",
        });
      }
    }

    const perPR = Array.from(prFollowups.values()).sort(
      (a, b) => b.latestAt.getTime() - a.latestAt.getTime()
    );

    // Aggregate stats
    const totalFollowups = followupRuns.length;
    const activeFollowups = followupRuns.filter(
      (r) => r.outcome === "in_progress"
    ).length;
    const successfulFollowups = followupRuns.filter(
      (r) => r.outcome === "success"
    ).length;
    const failedFollowups = followupRuns.filter(
      (r) => r.outcome === "failure"
    ).length;

    // Conversion: count PRs where at least one follow-up succeeded AND PR is now merged
    let conversions = 0;
    for (const [, data] of prFollowups) {
      if (data.latestOutcome === "success") {
        // Check if the PR is merged
        try {
          const pr = await db.query.pullRequests.findFirst({
            where: eq(pullRequests.repo, data.repo),
          });
          if (pr?.status === "merged") conversions++;
        } catch {
          // Skip
        }
      }
    }

    const conversionRate =
      prFollowups.size > 0
        ? Math.round((conversions / prFollowups.size) * 1000) / 10
        : 0;

    return NextResponse.json({
      summary: {
        totalFollowups,
        activeFollowups,
        successfulFollowups,
        failedFollowups,
        uniquePRs: prFollowups.size,
        conversionRate,
        avgRoundsPerPR:
          prFollowups.size > 0
            ? Math.round(
                (totalFollowups / prFollowups.size) * 10
              ) / 10
            : 0,
      },
      perPR,
      range: `${days}d`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch followup metrics", details: String(error) },
      { status: 500 }
    );
  }
}
