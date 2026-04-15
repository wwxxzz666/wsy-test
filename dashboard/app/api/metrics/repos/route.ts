export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, subagentRuns, prReviews } from "@/lib/schema";
import { sql, gte, eq, min } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * GET /api/metrics/repos?range=30d
 *
 * Returns per-repo success rates computed from pull_requests and subagent_runs tables.
 */
export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "30d";
    const days = parseInt(range) || 30;
    const since = subDays(new Date(), days);

    // Per-repo PR stats
    const repoStats = await db
      .select({
        repo: pullRequests.repo,
        total: sql<number>`count(*)`,
        merged: sql<number>`sum(case when ${pullRequests.status} = 'merged' then 1 else 0 end)`,
        closed: sql<number>`sum(case when ${pullRequests.status} = 'closed' then 1 else 0 end)`,
        open: sql<number>`sum(case when ${pullRequests.status} = 'open' then 1 else 0 end)`,
        avgQuality: sql<number>`round(avg(${pullRequests.qualityScore}), 1)`,
        avgAdditions: sql<number>`round(avg(${pullRequests.additions}), 0)`,
        avgDeletions: sql<number>`round(avg(${pullRequests.deletions}), 0)`,
      })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, since))
      .groupBy(pullRequests.repo);

    // Per-repo sub-agent run stats (if table has data)
    let runStats: { repo: string; totalRuns: number; successes: number; failures: number; avgDurationMs: number }[] = [];
    try {
      runStats = await db
        .select({
          repo: subagentRuns.repo,
          totalRuns: sql<number>`count(*)`,
          successes: sql<number>`sum(case when ${subagentRuns.outcome} = 'success' then 1 else 0 end)`,
          failures: sql<number>`sum(case when ${subagentRuns.outcome} = 'failure' then 1 else 0 end)`,
          avgDurationMs: sql<number>`round(avg(${subagentRuns.durationMs}), 0)`,
        })
        .from(subagentRuns)
        .where(gte(subagentRuns.startedAt, since))
        .groupBy(subagentRuns.repo);
    } catch {
      // Table might not exist yet on older deployments
    }

    // Time-to-first-review: per-repo average time from PR creation to first review
    // Uses raw SQL for the timestamp subtraction since drizzle's timestamp mode converts to Date objects
    let reviewTimeStats: { repo: string; avgHoursToReview: number; reviewedCount: number }[] = [];
    try {
      const rawReviewTimes = await db
        .select({
          repo: pullRequests.repo,
          avgHoursToReview: sql<number>`round(avg((${prReviews.submittedAt} - ${pullRequests.createdAt}) / 3600.0), 1)`,
          reviewedCount: sql<number>`count(DISTINCT ${pullRequests.id})`,
        })
        .from(pullRequests)
        .innerJoin(prReviews, eq(prReviews.prId, pullRequests.id))
        .where(gte(pullRequests.createdAt, since))
        .groupBy(pullRequests.repo);
      reviewTimeStats = rawReviewTimes;
    } catch {
      // pr_reviews may be empty
    }
    const reviewTimeMap = new Map(reviewTimeStats.map((r) => [r.repo, r]));

    // Merge PR stats, run stats, and review time stats by repo
    const runMap = new Map(runStats.map((r) => [r.repo, r]));

    const repos = repoStats.map((r) => {
      const merged = r.merged ?? 0;
      const total = r.total ?? 0;
      const resolved = merged + (r.closed ?? 0);
      const mergeRate = resolved > 0 ? Math.round((merged / resolved) * 1000) / 10 : 0;
      const runs = runMap.get(r.repo);
      const reviewTime = reviewTimeMap.get(r.repo);

      // Repo health: responsive if avg review time < 72h, dead if no reviews at all
      const hasReviews = (reviewTime?.reviewedCount ?? 0) > 0;
      const avgHoursToReview = reviewTime?.avgHoursToReview ?? null;
      const responsiveness = !hasReviews
        ? "unknown"
        : avgHoursToReview !== null && avgHoursToReview <= 24
          ? "fast"
          : avgHoursToReview !== null && avgHoursToReview <= 72
            ? "moderate"
            : "slow";

      // Composite health score (0-100) — weighted toward merge probability
      let healthScore = 50; // baseline

      // Merge rate impact (0-35 points) — the #1 signal
      if (mergeRate >= 50) healthScore += 35;
      else if (mergeRate >= 30) healthScore += 25;
      else if (mergeRate >= 10) healthScore += 15;
      else if (merged > 0) healthScore += 5;
      else healthScore -= 15; // no merges at all

      // Review responsiveness (0-25 points)
      if (responsiveness === "fast") healthScore += 25;
      else if (responsiveness === "moderate") healthScore += 15;
      else if (responsiveness === "slow") healthScore += 5;
      else healthScore -= 5; // unknown = no reviews

      // Review coverage — are our PRs getting reviewed at all?
      const reviewCoverage = total > 0 ? (reviewTime?.reviewedCount ?? 0) / total : 0;
      if (reviewCoverage >= 0.5) healthScore += 15;
      else if (reviewCoverage > 0) healthScore += 5;
      else healthScore -= 10; // zero reviews

      // Open PR backlog penalty
      const openCount = r.open ?? 0;
      if (openCount >= 10) healthScore -= 10; // very many of our PRs sitting open
      else if (openCount >= 5) healthScore -= 5;

      // Sub-agent success rate bonus
      if (runs && runs.totalRuns > 0) {
        const successRate = (runs.successes ?? 0) / runs.totalRuns;
        if (successRate >= 0.7) healthScore += 10;
        else if (successRate >= 0.4) healthScore += 5;
      }

      // Clamp 0-100
      healthScore = Math.max(0, Math.min(100, healthScore));

      // Recommendation based on health score
      const recommendation: "target" | "watch" | "avoid" =
        healthScore >= 65 ? "target"
        : healthScore >= 40 ? "watch"
        : "avoid";

      return {
        repo: r.repo,
        prs: {
          total,
          merged,
          closed: r.closed ?? 0,
          open: r.open ?? 0,
          mergeRate,
          avgQuality: r.avgQuality ?? 0,
          avgAdditions: r.avgAdditions ?? 0,
          avgDeletions: r.avgDeletions ?? 0,
        },
        review: {
          avgHoursToReview: avgHoursToReview ?? null,
          reviewedCount: reviewTime?.reviewedCount ?? 0,
          responsiveness,
        },
        runs: runs
          ? {
              total: runs.totalRuns,
              successes: runs.successes ?? 0,
              failures: runs.failures ?? 0,
              successRate:
                runs.totalRuns > 0
                  ? Math.round(((runs.successes ?? 0) / runs.totalRuns) * 1000) / 10
                  : 0,
              avgDurationMs: runs.avgDurationMs ?? 0,
            }
          : null,
        health: {
          score: healthScore,
          recommendation,
        },
      };
    });

    // Sort by health score descending (best repos first), then by total PRs
    repos.sort((a, b) => b.health.score - a.health.score || b.prs.total - a.prs.total);

    return NextResponse.json({ repos, range: `${days}d` });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch repo metrics", details: String(error) },
      { status: 500 }
    );
  }
}
