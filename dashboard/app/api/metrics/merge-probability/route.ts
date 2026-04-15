export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";
import { eq, sql, isNotNull } from "drizzle-orm";

/**
 * GET /api/metrics/merge-probability
 *
 * Merge probability analytics — distribution of P(merge) scores,
 * accuracy vs actual outcomes, and weight validation data.
 * Used to calibrate the V10 scoring model.
 */
export async function GET() {
  try {
    await ensureDb();

    // All PRs with merge probability scores
    const scoredPRs = await db
      .select({
        id: pullRequests.id,
        repo: pullRequests.repo,
        status: pullRequests.status,
        mergeProbability: pullRequests.mergeProbability,
        prType: pullRequests.prType,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        createdAt: pullRequests.createdAt,
      })
      .from(pullRequests)
      .where(isNotNull(pullRequests.mergeProbability));

    // Total PRs for context
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests);
    const totalPRs = totalResult?.count || 0;

    // Distribution buckets
    const distribution: Record<string, number> = {
      "0-20": 0,
      "20-40": 0,
      "40-60": 0,
      "60-80": 0,
      "80-100": 0,
    };

    for (const pr of scoredPRs) {
      const score = pr.mergeProbability ?? 0;
      if (score < 20) distribution["0-20"]++;
      else if (score < 40) distribution["20-40"]++;
      else if (score < 60) distribution["40-60"]++;
      else if (score < 80) distribution["60-80"]++;
      else distribution["80-100"]++;
    }

    // Average score
    const avgScore =
      scoredPRs.length > 0
        ? Math.round(
            scoredPRs.reduce((sum, pr) => sum + (pr.mergeProbability ?? 0), 0) /
              scoredPRs.length
          )
        : null;

    // Accuracy by outcome
    function avgForStatus(status: string) {
      const matching = scoredPRs.filter((pr) => pr.status === status);
      if (matching.length === 0) return null;
      return {
        avgPMerge: Math.round(
          matching.reduce((sum, pr) => sum + (pr.mergeProbability ?? 0), 0) /
            matching.length
        ),
        count: matching.length,
      };
    }

    const accuracy = {
      merged: avgForStatus("merged"),
      closed: avgForStatus("closed"),
      open: avgForStatus("open"),
    };

    // Accuracy indicator: if merged PRs have higher avg P(merge) than closed,
    // the model is directionally correct
    let modelAccuracy: "good" | "weak" | "inverted" | "insufficient_data" =
      "insufficient_data";
    if (accuracy.merged && accuracy.closed) {
      if (accuracy.merged.avgPMerge > accuracy.closed.avgPMerge + 10) {
        modelAccuracy = "good";
      } else if (accuracy.merged.avgPMerge > accuracy.closed.avgPMerge) {
        modelAccuracy = "weak";
      } else {
        modelAccuracy = "inverted";
      }
    }

    // Per-type breakdown (for weight validation)
    const typeBreakdown: Record<
      string,
      { count: number; avgScore: number; mergeCount: number }
    > = {};
    for (const pr of scoredPRs) {
      const type = pr.prType || "other";
      if (!typeBreakdown[type]) {
        typeBreakdown[type] = { count: 0, avgScore: 0, mergeCount: 0 };
      }
      typeBreakdown[type].count++;
      typeBreakdown[type].avgScore += pr.mergeProbability ?? 0;
      if (pr.status === "merged") typeBreakdown[type].mergeCount++;
    }
    for (const type of Object.keys(typeBreakdown)) {
      if (typeBreakdown[type].count > 0) {
        typeBreakdown[type].avgScore = Math.round(
          typeBreakdown[type].avgScore / typeBreakdown[type].count
        );
      }
    }

    // Per-size-bracket breakdown (for weight validation)
    const sizeBrackets = [
      { label: "<30 lines", min: 0, max: 30 },
      { label: "30-100 lines", min: 30, max: 100 },
      { label: "100-200 lines", min: 100, max: 200 },
      { label: ">200 lines", min: 200, max: Infinity },
    ];
    const sizeBreakdown = sizeBrackets.map((bracket) => {
      const matching = scoredPRs.filter((pr) => {
        const size = (pr.additions ?? 0) + (pr.deletions ?? 0);
        return size >= bracket.min && size < bracket.max;
      });
      return {
        label: bracket.label,
        count: matching.length,
        avgScore:
          matching.length > 0
            ? Math.round(
                matching.reduce(
                  (sum, pr) => sum + (pr.mergeProbability ?? 0),
                  0
                ) / matching.length
              )
            : null,
        mergeCount: matching.filter((pr) => pr.status === "merged").length,
      };
    });

    // Slot utilization (from subagent_runs if available)
    let slotUtilization = null;
    try {
      const { subagentRuns } = await import("@/lib/schema");
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const activeRuns = await db
        .select({ count: sql<number>`count(*)` })
        .from(subagentRuns)
        .where(eq(subagentRuns.outcome, "in_progress"));

      const recentRuns = await db
        .select({
          total: sql<number>`count(*)`,
          success: sql<number>`sum(case when ${subagentRuns.outcome} = 'success' then 1 else 0 end)`,
          failure: sql<number>`sum(case when ${subagentRuns.outcome} = 'failure' then 1 else 0 end)`,
          avgDurationMs: sql<number>`avg(${subagentRuns.durationMs})`,
        })
        .from(subagentRuns)
        .where(sql`${subagentRuns.startedAt} >= ${Math.floor(oneHourAgo.getTime() / 1000)}`);

      slotUtilization = {
        activeSlots: activeRuns[0]?.count || 0,
        maxSlots: 10,
        utilizationPct: Math.round(
          ((activeRuns[0]?.count || 0) / 10) * 100
        ),
        lastHour: {
          total: recentRuns[0]?.total || 0,
          success: recentRuns[0]?.success || 0,
          failure: recentRuns[0]?.failure || 0,
          avgDurationMs: recentRuns[0]?.avgDurationMs
            ? Math.round(recentRuns[0].avgDurationMs)
            : null,
        },
      };
    } catch {
      // subagent_runs table might not exist
    }

    return NextResponse.json({
      scored: scoredPRs.length,
      total: totalPRs,
      coveragePct:
        totalPRs > 0 ? Math.round((scoredPRs.length / totalPRs) * 100) : 0,
      avgScore,
      distribution,
      accuracy,
      modelAccuracy,
      typeBreakdown,
      sizeBreakdown,
      slotUtilization,
      weights: {
        current: {
          task_type: 15,
          size_score: 20,
          repo_responsiveness: 15,
          trust_score: 25,
          freshness: 10,
          contributor_fit: 10,
          competition: 5,
        },
        note: "Weights adjusted per dashboard analysis: trust_score 15->25, task_type 25->15. Rationale: all 4 merges came from responsive maintainers regardless of PR type.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute merge probability metrics", details: String(error) },
      { status: 500 }
    );
  }
}
