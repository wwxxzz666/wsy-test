export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews, subagentRuns, autonomySnapshots } from "@/lib/schema";
import { sql, eq, desc, gte } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * GET /api/metrics/autonomy
 *
 * Autonomy health scorecard — surfaces where the agent makes bad autonomous decisions
 * so we can fix prompts/tools instead of manually auditing PRs.
 *
 * Tracks:
 * - Duplicate PR detection (same repo + same issue = wasted cycle)
 * - Oversized PR detection (>200 lines = prompt gap)
 * - Wasted cycle detection (closed without review = bad targeting)
 * - Decision quality per pipeline stage
 * - Quick rejections (closed within 1 hour — CI/policy auto-rejected)
 */
export async function GET() {
  try {
    await ensureDb();

    const allPRs = await db
      .select({
        id: pullRequests.id,
        repo: pullRequests.repo,
        number: pullRequests.number,
        title: pullRequests.title,
        body: pullRequests.body,
        status: pullRequests.status,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        filesChanged: pullRequests.filesChanged,
        qualityScore: pullRequests.qualityScore,
        createdAt: pullRequests.createdAt,
        closedAt: pullRequests.closedAt,
        mergedAt: pullRequests.mergedAt,
        htmlUrl: pullRequests.htmlUrl,
        prType: pullRequests.prType,
        reviewCount: pullRequests.reviewCount,
      })
      .from(pullRequests)
      .orderBy(desc(pullRequests.createdAt));

    // --- DUPLICATE PR DETECTION ---
    // Group PRs by repo, look for multiple PRs targeting the same issue
    const repoGroups = new Map<string, typeof allPRs>();
    for (const pr of allPRs) {
      const existing = repoGroups.get(pr.repo) || [];
      existing.push(pr);
      repoGroups.set(pr.repo, existing);
    }

    const duplicateRepos: {
      repo: string;
      prCount: number;
      prs: { number: number; title: string; status: string; htmlUrl: string | null }[];
    }[] = [];

    for (const [repo, prs] of repoGroups) {
      if (prs.length >= 2) {
        // Two strategies: (1) match by referenced issue number in body, (2) title similarity
        const issueGroups = new Map<string, typeof prs>();
        const ungrouped: typeof prs = [];

        for (const pr of prs) {
          // Extract issue references like "Fixes #123", "Closes #456", "Resolves #789"
          const issueRefs = (pr.body || "").match(/(?:fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi);
          if (issueRefs && issueRefs.length > 0) {
            const issueNum = issueRefs[0].replace(/\D+/g, "");
            const key = `issue-${issueNum}`;
            const group = issueGroups.get(key) || [];
            group.push(pr);
            issueGroups.set(key, group);
          } else {
            ungrouped.push(pr);
          }
        }

        // Also group ungrouped PRs by title similarity
        const titleGroups = new Map<string, typeof prs>();
        for (const pr of ungrouped) {
          const normalized = pr.title
            .toLowerCase()
            .replace(/\b#\d+\b/g, "")
            .replace(/[^a-z0-9 ]/g, "")
            .trim();
          const key = normalized.split(/\s+/).slice(0, 4).join(" ");
          const group = titleGroups.get(key) || [];
          group.push(pr);
          titleGroups.set(key, group);
        }

        // Merge both detection methods
        const allGroups = [...issueGroups.values(), ...titleGroups.values()];
        for (const group of allGroups) {
          if (group.length >= 2) {
            duplicateRepos.push({
              repo,
              prCount: group.length,
              prs: group.map((p) => ({
                number: p.number,
                title: p.title,
                status: p.status,
                htmlUrl: p.htmlUrl,
              })),
            });
          }
        }
      }
    }

    // --- OVERSIZED PR DETECTION ---
    const oversizedPRs = allPRs
      .filter((pr) => {
        const diffSize = (pr.additions ?? 0) + (pr.deletions ?? 0);
        return diffSize > 200;
      })
      .map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        diffSize: (pr.additions ?? 0) + (pr.deletions ?? 0),
        filesChanged: pr.filesChanged ?? 0,
        status: pr.status,
        htmlUrl: pr.htmlUrl,
      }));

    // --- WASTED CYCLES ---
    // PRs closed without ever receiving a review = bad targeting
    const wastedCycles = allPRs
      .filter(
        (pr) =>
          pr.status === "closed" &&
          (pr.reviewCount ?? 0) === 0
      )
      .map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        htmlUrl: pr.htmlUrl,
        diffSize: (pr.additions ?? 0) + (pr.deletions ?? 0),
        reason: inferClosureReason(pr),
      }));

    // --- QUICK REJECTIONS ---
    // PRs closed within 1 hour = likely auto-rejected (CLA, CI, policy)
    const quickRejections = allPRs
      .filter((pr) => {
        if (pr.status !== "closed" || !pr.closedAt || !pr.createdAt) return false;
        const hoursOpen =
          (pr.closedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60);
        return hoursOpen < 1;
      })
      .map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        htmlUrl: pr.htmlUrl,
        hoursOpen: pr.closedAt && pr.createdAt
          ? Math.round(
              ((pr.closedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60)) * 10
            ) / 10
          : 0,
      }));

    // --- PIPELINE DECISION QUALITY ---
    const totalPRs = allPRs.length;
    const mergedPRs = allPRs.filter((p) => p.status === "merged").length;
    const closedPRs = allPRs.filter((p) => p.status === "closed").length;
    const openPRs = allPRs.filter((p) => p.status === "open").length;
    const reviewedPRs = allPRs.filter((p) => (p.reviewCount ?? 0) > 0).length;
    const oversizedCount = oversizedPRs.length;
    const duplicateCount = duplicateRepos.reduce((sum, d) => sum + d.prCount - 1, 0); // extra PRs beyond 1
    const wastedCount = wastedCycles.length;

    // Autonomy score: 100 - penalties for bad decisions
    // Each penalty type reflects a prompt/tool gap
    const duplicatePenalty = Math.min(duplicateCount * 5, 25); // -5 per duplicate, max -25
    const oversizedPenalty = Math.min(oversizedCount * 3, 15); // -3 per oversized, max -15
    const wastedPenalty = Math.min(wastedCount * 2, 20); // -2 per wasted, max -20
    const mergeRateBonus = totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 40) : 0; // up to +40 for merge rate
    const reviewRateBonus = totalPRs > 0 ? Math.round((reviewedPRs / totalPRs) * 20) : 0; // up to +20 for review rate

    const autonomyScore = Math.max(
      0,
      Math.min(
        100,
        40 + mergeRateBonus + reviewRateBonus - duplicatePenalty - oversizedPenalty - wastedPenalty
      )
    );

    // --- CLA CHECK DETECTION (informational only — agent now signs CLAs) ---
    const claBotPrIds = new Set<string>();
    try {
      const claReviews = await db
        .select({ prId: prReviews.prId, reviewer: prReviews.reviewer, body: prReviews.body })
        .from(prReviews);
      for (const rev of claReviews) {
        const isClaBot = /cla/i.test(rev.reviewer) || /cla.*not.*signed|sign.*cla|contributor.*license/i.test(rev.body || "");
        if (isClaBot) claBotPrIds.add(rev.prId);
      }
    } catch {
      // non-critical
    }

    // --- FAILURE CATEGORIES (MAST-inspired) ---
    // Classify closed PRs by failure type to identify which autonomous capabilities need work
    // Note: CLA is no longer a failure category — agent signs CLAs automatically
    const failureCategories: Record<string, { count: number; prs: string[] }> = {
      no_review: { count: 0, prs: [] },        // Targeting failure: repo never engaged
      quick_reject: { count: 0, prs: [] },     // System design: CI/policy auto-rejected
      changes_requested: { count: 0, prs: [] },// Task verification: fix was wrong
      scope_reject: { count: 0, prs: [] },     // Coordination: PR too large or off-topic
      duplicate: { count: 0, prs: [] },        // Coordination: submitted same fix twice
    };

    const closedPRsList = allPRs.filter((p) => p.status === "closed");
    for (const pr of closedPRsList) {
      const prRef = `${pr.repo}#${pr.number}`;
      const hoursOpen = pr.closedAt && pr.createdAt
        ? (pr.closedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60)
        : 999;
      const diffSize = (pr.additions ?? 0) + (pr.deletions ?? 0);

      if (hoursOpen < 1) {
        failureCategories.quick_reject.count++;
        failureCategories.quick_reject.prs.push(prRef);
      } else if ((pr.reviewCount ?? 0) === 0) {
        failureCategories.no_review.count++;
        failureCategories.no_review.prs.push(prRef);
      } else if (diffSize > 200) {
        failureCategories.scope_reject.count++;
        failureCategories.scope_reject.prs.push(prRef);
      } else {
        failureCategories.changes_requested.count++;
        failureCategories.changes_requested.prs.push(prRef);
      }
    }

    // Check duplicates among closed PRs
    for (const dup of duplicateRepos) {
      const closedDups = dup.prs.filter((p) => p.status === "closed");
      if (closedDups.length > 0) {
        failureCategories.duplicate.count += closedDups.length;
        for (const p of closedDups) {
          failureCategories.duplicate.prs.push(`${dup.repo}#${p.number}`);
        }
      }
    }

    // --- PROMPT GAPS ---
    // Automatically detect which prompt gaps are active based on data patterns
    const promptGaps: { id: string; name: string; severity: string; evidence: string; count: number }[] = [];

    if (duplicateCount > 0) {
      promptGaps.push({
        id: "dedup",
        name: "No PR de-duplication guard",
        severity: "critical",
        evidence: `${duplicateCount} duplicate PRs across ${duplicateRepos.length} repos`,
        count: duplicateCount,
      });
    }

    if (oversizedCount > 0) {
      promptGaps.push({
        id: "size_limit",
        name: "No diff size enforcement",
        severity: "critical",
        evidence: `${oversizedCount} PRs exceed 200-line limit`,
        count: oversizedCount,
      });
    }

    if (wastedCount > 0) {
      promptGaps.push({
        id: "targeting",
        name: "Bad repo targeting (closed without review)",
        severity: "high",
        evidence: `${wastedCount} PRs closed without any review`,
        count: wastedCount,
      });
    }

    // Note: CLA is no longer a prompt gap — agent signs CLAs automatically

    if (quickRejections.length > 0) {
      promptGaps.push({
        id: "auto_reject",
        name: "Auto-rejected (CI/policy)",
        severity: "high",
        evidence: `${quickRejections.length} PRs closed within 1 hour`,
        count: quickRejections.length,
      });
    }

    // Check for repos with 0% merge rate and 3+ PRs (dead repos the agent keeps targeting)
    const deadRepoTargets = [...repoGroups.entries()]
      .filter(([, prs]) => {
        return (
          prs.length >= 3 &&
          prs.every((p) => p.status !== "merged") &&
          prs.some((p) => p.status === "closed")
        );
      })
      .map(([repo, prs]) => repo);

    if (deadRepoTargets.length > 0) {
      promptGaps.push({
        id: "dead_repos",
        name: "Targeting unresponsive repos repeatedly",
        severity: "medium",
        evidence: `${deadRepoTargets.length} repos with 3+ PRs and 0 merges: ${deadRepoTargets.slice(0, 3).join(", ")}`,
        count: deadRepoTargets.length,
      });
    }

    // --- SUBAGENT EFFICIENCY ---
    let subagentStats = { total: 0, success: 0, failure: 0, abandoned: 0, avgDurationMs: 0 };
    try {
      const saResults = await db
        .select({
          total: sql<number>`count(*)`,
          success: sql<number>`sum(case when ${subagentRuns.outcome} = 'success' then 1 else 0 end)`,
          failure: sql<number>`sum(case when ${subagentRuns.outcome} = 'failure' then 1 else 0 end)`,
          abandoned: sql<number>`sum(case when ${subagentRuns.outcome} = 'abandoned' then 1 else 0 end)`,
          avgDuration: sql<number>`avg(${subagentRuns.durationMs})`,
        })
        .from(subagentRuns);
      subagentStats = {
        total: saResults[0]?.total || 0,
        success: saResults[0]?.success || 0,
        failure: saResults[0]?.failure || 0,
        abandoned: saResults[0]?.abandoned || 0,
        avgDurationMs: Math.round(saResults[0]?.avgDuration || 0),
      };
    } catch {
      // subagent_runs may not exist yet
    }

    // --- PERSIST SNAPSHOT (throttled to once per hour) ---
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentSnapshot = await db
        .select({ id: autonomySnapshots.id })
        .from(autonomySnapshots)
        .where(gte(autonomySnapshots.timestamp, oneHourAgo))
        .limit(1);

      if (recentSnapshot.length === 0) {
        await db.insert(autonomySnapshots).values({
          id: nanoid(),
          timestamp: new Date(),
          score: autonomyScore,
          totalPrs: totalPRs,
          mergedPrs: mergedPRs,
          duplicateCount,
          oversizedCount,
          wastedCount,
          promptGaps: promptGaps.length,
        });
      }
    } catch {
      // snapshot table may not exist yet, non-critical
    }

    // --- LOAD HISTORY for trend ---
    let history: { timestamp: Date; score: number }[] = [];
    try {
      const rows = await db
        .select({
          timestamp: autonomySnapshots.timestamp,
          score: autonomySnapshots.score,
        })
        .from(autonomySnapshots)
        .orderBy(desc(autonomySnapshots.timestamp))
        .limit(168); // 7 days at 1/hour
      history = rows.reverse();
    } catch {
      // non-critical
    }

    return NextResponse.json({
      autonomyScore,
      history,
      pipeline: {
        total: totalPRs,
        reviewed: reviewedPRs,
        merged: mergedPRs,
        closed: closedPRs,
        open: openPRs,
        reviewRate: totalPRs > 0 ? Math.round((reviewedPRs / totalPRs) * 1000) / 10 : 0,
        mergeRate: totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 1000) / 10 : 0,
      },
      penalties: {
        duplicates: { count: duplicateCount, penalty: duplicatePenalty },
        oversized: { count: oversizedCount, penalty: oversizedPenalty },
        wasted: { count: wastedCount, penalty: wastedPenalty },
      },
      bonuses: {
        mergeRate: mergeRateBonus,
        reviewRate: reviewRateBonus,
      },
      promptGaps,
      duplicateRepos: duplicateRepos.slice(0, 10),
      oversizedPRs: oversizedPRs.slice(0, 10),
      wastedCycles: wastedCycles.slice(0, 10),
      quickRejections: quickRejections.slice(0, 10),
      deadRepoTargets,
      subagentStats,
      failureCategories,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute autonomy metrics", details: String(error) },
      { status: 500 }
    );
  }
}

function inferClosureReason(pr: {
  title: string;
  body: string | null;
  reviewCount: number | null;
}): string {
  if ((pr.reviewCount ?? 0) === 0) return "no_review";
  if (/automated|policy.reject/i.test(pr.body || "")) return "policy_reject";
  return "rejected";
}
