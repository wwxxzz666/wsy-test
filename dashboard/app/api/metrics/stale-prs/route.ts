export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews } from "@/lib/schema";
import { sql, eq, and, lte } from "drizzle-orm";

/**
 * GET /api/metrics/stale-prs?days=7
 *
 * Returns open PRs that have been sitting with no human engagement
 * beyond a threshold (default 7 days). Used for the "stale PR rework"
 * view so we can bump, follow up, or rework PRs that need attention.
 */
export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const staleDays = parseInt(url.searchParams.get("days") || "7") || 7;
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - staleDays * 86400 * 1000);

    // Find open PRs created before the stale threshold
    const openPRs = await db
      .select({
        id: pullRequests.id,
        repo: pullRequests.repo,
        number: pullRequests.number,
        title: pullRequests.title,
        status: pullRequests.status,
        createdAt: pullRequests.createdAt,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        filesChanged: pullRequests.filesChanged,
        reviewCount: pullRequests.reviewCount,
        htmlUrl: pullRequests.htmlUrl,
        qualityScore: pullRequests.qualityScore,
      })
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.status, "open"),
          lte(pullRequests.createdAt, staleThreshold)
        )
      );

    // For each open PR, check if it has any human reviews
    const prIds = openPRs.map((pr) => pr.id);

    let reviewMap = new Map<string, { count: number; hasHuman: boolean; latestState: string | null }>();

    if (prIds.length > 0) {
      // Get review info per PR
      const reviews = await db
        .select({
          prId: prReviews.prId,
          reviewer: prReviews.reviewer,
          state: prReviews.state,
          submittedAt: prReviews.submittedAt,
        })
        .from(prReviews)
        .where(
          sql`${prReviews.prId} IN (${sql.join(
            prIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );

      for (const rev of reviews) {
        const existing = reviewMap.get(rev.prId) || {
          count: 0,
          hasHuman: false,
          latestState: null,
        };
        existing.count++;
        // Automated reviewers typically have [bot] suffix or known service names
        const isAutomated =
          /\[bot\]$/i.test(rev.reviewer) ||
          /^(dependabot|renovate|github-actions|codecov|gemini-code-assist|coderabbit)/i.test(
            rev.reviewer
          );
        if (!isAutomated) {
          existing.hasHuman = true;
        }
        existing.latestState = rev.state;
        reviewMap.set(rev.prId, existing);
      }
    }

    // Build stale PR objects with recommendations
    const stalePRs = openPRs.map((pr) => {
      const daysOpen = Math.round(
        (now.getTime() - pr.createdAt.getTime()) / 86400000
      );
      const reviewInfo = reviewMap.get(pr.id) || {
        count: 0,
        hasHuman: false,
        latestState: null,
      };

      // Recommendation logic (V9: never close PRs, rework instead):
      // - rework: rework with a different approach and push updates
      // - followup: has human review, respond to feedback
      // - wait: recently submitted, give maintainers time
      let recommendation: "rework" | "wait" | "followup";
      if (reviewInfo.hasHuman) {
        if (reviewInfo.latestState === "changes_requested") {
          recommendation = "followup"; // They asked for changes, we should respond
        } else if (daysOpen > 21) {
          recommendation = "rework"; // Stale with review but no merge — try a different approach
        } else {
          recommendation = "wait";
        }
      } else if (daysOpen > 14) {
        recommendation = "rework"; // 2 weeks, no human interest — rework with better targeting
      } else {
        recommendation = "rework"; // Past stale threshold with zero engagement — needs a fresh approach
      }

      return {
        id: pr.id,
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        daysOpen,
        createdAt: pr.createdAt,
        diffSize: (pr.additions ?? 0) + (pr.deletions ?? 0),
        filesChanged: pr.filesChanged ?? 0,
        reviewCount: reviewInfo.count,
        hasHumanReview: reviewInfo.hasHuman,
        latestReviewState: reviewInfo.latestState,
        qualityScore: pr.qualityScore,
        htmlUrl: pr.htmlUrl,
        recommendation,
      };
    });

    // Sort: rework recommendations first, then by days open descending
    stalePRs.sort((a, b) => {
      const recOrder = { rework: 0, followup: 1, wait: 2 };
      const orderDiff = recOrder[a.recommendation] - recOrder[b.recommendation];
      if (orderDiff !== 0) return orderDiff;
      return b.daysOpen - a.daysOpen;
    });

    // Summary stats
    const reworkCount = stalePRs.filter((p) => p.recommendation === "rework").length;
    const followupCount = stalePRs.filter((p) => p.recommendation === "followup").length;
    const waitCount = stalePRs.filter((p) => p.recommendation === "wait").length;
    const avgDaysOpen =
      stalePRs.length > 0
        ? Math.round(stalePRs.reduce((sum, p) => sum + p.daysOpen, 0) / stalePRs.length)
        : 0;

    // Repos with most stale PRs
    const repoStaleCount = new Map<string, number>();
    for (const pr of stalePRs) {
      repoStaleCount.set(pr.repo, (repoStaleCount.get(pr.repo) || 0) + 1);
    }
    const worstRepos = [...repoStaleCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([repo, count]) => ({ repo, count }));

    return NextResponse.json({
      stalePRs,
      summary: {
        total: stalePRs.length,
        rework: reworkCount,
        followup: followupCount,
        wait: waitCount,
        avgDaysOpen,
        worstRepos,
      },
      staleDays,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch stale PRs", details: String(error) },
      { status: 500 }
    );
  }
}
