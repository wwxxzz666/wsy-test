export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

interface ActionItem {
  id: string;
  priority: "P0" | "P1" | "P2";
  category: "targeting" | "quality" | "volume" | "tooling" | "followup";
  title: string;
  problem: string;
  suggestedFix: string;
  impactEstimate: string;
  dataPoint: string;
}

/**
 * GET /api/metrics/action-items
 *
 * Synthesizes all dashboard metrics into a prioritized action list.
 * This is the "single pane of glass" for prompt improvement decisions.
 */
export async function GET() {
  try {
    await ensureDb();
    const items: ActionItem[] = [];

    // Gather all data
    const [totalResult, mergedResult, closedResult, openResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "merged")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "closed")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "open")),
    ]);

    const total = totalResult[0]?.count || 0;
    const merged = mergedResult[0]?.count || 0;
    const closed = closedResult[0]?.count || 0;
    const open = openResult[0]?.count || 0;

    // Review data
    const reviewedResult = await db
      .select({ count: sql<number>`count(DISTINCT ${prReviews.prId})` })
      .from(prReviews);
    const reviewed = reviewedResult[0]?.count || 0;

    // Per-repo stats
    const repoStats = await db
      .select({
        repo: pullRequests.repo,
        total: sql<number>`count(*)`,
        merged: sql<number>`sum(case when ${pullRequests.status} = 'merged' then 1 else 0 end)`,
        closed: sql<number>`sum(case when ${pullRequests.status} = 'closed' then 1 else 0 end)`,
      })
      .from(pullRequests)
      .groupBy(pullRequests.repo);

    // Oversized PRs
    const oversizedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(sql`(${pullRequests.additions} + ${pullRequests.deletions}) > 200`);
    const oversized = oversizedResult[0]?.count || 0;

    // PRs with no review at all
    const unreviewed = total - reviewed;
    const unreviewedRate = total > 0 ? Math.round((unreviewed / total) * 100) : 0;
    const mergeRate = total > 0 ? (merged / total) * 100 : 0;

    // Multi-PR repos (possible spam)
    const spamRepos = repoStats.filter((r) => r.total >= 3);
    const zeroMergeRepos = repoStats.filter((r) => r.total >= 2 && r.merged === 0);

    // ---- Generate action items ----

    // P0: No reviews (targeting problem)
    if (unreviewedRate > 60) {
      items.push({
        id: "fix-targeting",
        priority: "P0",
        category: "targeting",
        title: "Fix repo targeting — most PRs are ignored",
        problem: `${unreviewedRate}% of PRs (${unreviewed}/${total}) received zero reviews. The agent is targeting repos that don't engage with external PRs.`,
        suggestedFix: "Update discovery skill to filter for repos with: (1) recent external contributor merges, (2) < 7 day median time-to-first-review, (3) active maintainer presence. Remove all repos with 0% review rate from target list.",
        impactEstimate: "Could increase review rate from 16% to 50%+, which directly enables more merges",
        dataPoint: `${unreviewed}/${total} PRs unreviewed (${unreviewedRate}%)`,
      });
    }

    // P0: Zero or near-zero merge rate
    if (total >= 10 && mergeRate < 5) {
      items.push({
        id: "fix-merge-rate",
        priority: "P0",
        category: "quality",
        title: "Increase merge rate from 2% to >30%",
        problem: `Only ${merged}/${total} PRs merged (${mergeRate.toFixed(1)}%). AI benchmark is 32.7%. Current approach is fundamentally not working.`,
        suggestedFix: "Focus on trusted repos, run repo's linter/tests before opening PR, check CONTRIBUTING.md for conventions, ensure issue reference is valid, keep diffs under 50 lines. Rework rejected PRs instead of abandoning.",
        impactEstimate: `Each 10% improvement in merge rate = ~${Math.round(total * 0.1)} additional merges`,
        dataPoint: `${merged}/${total} merged (${mergeRate.toFixed(1)}%)`,
      });
    }

    // P1: Dedup — multiple open PRs per repo
    if (spamRepos.length >= 3) {
      items.push({
        id: "fix-dedup",
        priority: "P1",
        category: "volume",
        title: "Dedup guard — max 1 open PR per repo",
        problem: `${spamRepos.length} repos have 3+ PRs. Multiple concurrent PRs per repo damages reputation with maintainers.`,
        suggestedFix: "Enforce lock file mechanism: memory/locks/{owner}_{repo}.lock prevents concurrent agents on same repo. Post-PR-creation dedup check closes duplicates automatically.",
        impactEstimate: "Eliminates duplicate submissions, improves per-repo reputation",
        dataPoint: `${spamRepos.length} repos with 3+ PRs: ${spamRepos
          .sort((a, b) => b.total - a.total)
          .slice(0, 3)
          .map((r) => `${r.repo} (${r.total})`)
          .join(", ")}`,
      });
    }

    // P1: Oversized PRs
    if (total > 0 && oversized / total > 0.2) {
      items.push({
        id: "fix-pr-size",
        priority: "P1",
        category: "quality",
        title: "Enforce PR size limits — too many oversized PRs",
        problem: `${oversized}/${total} PRs (${Math.round((oversized / total) * 100)}%) are over 200 lines. Research shows 50-line PRs merge 40% faster.`,
        suggestedFix: "Add diff size check to implementation skill: if total additions+deletions > 100 lines, split into multiple PRs or reduce scope. Target 25-50 lines for docs/typos, 50-100 for bug fixes.",
        impactEstimate: "Smaller PRs merge 40% faster and get reviewed 2x more often",
        dataPoint: `${oversized} oversized PRs (>${Math.round((oversized / total) * 100)}% of total)`,
      });
    }

    // P1: Dead repos still being targeted
    if (zeroMergeRepos.length >= 3) {
      items.push({
        id: "fix-dead-repos",
        priority: "P1",
        category: "targeting",
        title: "Stop targeting unresponsive repos",
        problem: `${zeroMergeRepos.length} repos have 2+ PRs with 0 merges. Agent isn't learning from past failures.`,
        suggestedFix: "Add repo blocklist based on past performance. If a repo has closed 2+ PRs without merge, add to avoid list for 30 days. Implement in heartbeat step 0.",
        impactEstimate: "Eliminates wasted cycles on dead-end repos",
        dataPoint: `${zeroMergeRepos.length} repos: ${zeroMergeRepos
          .slice(0, 3)
          .map((r) => r.repo)
          .join(", ")}`,
      });
    }

    // Note: CLA is no longer flagged — agent now signs CLAs automatically

    // P1: High close rate — rework instead of abandoning
    if (total >= 10 && closed / total > 0.3) {
      items.push({
        id: "fix-rework-rate",
        priority: "P1",
        category: "quality",
        title: "Rework closed PRs instead of abandoning them",
        problem: `${closed}/${total} PRs (${Math.round((closed / total) * 100)}%) were closed without merge. Many of these could be salvaged by addressing feedback and reopening.`,
        suggestedFix: "Implement rework pipeline: when a PR is closed with feedback, spawn a follow-up subagent to rework with a different approach and force-push to the same branch. Never give up on a PR unless fundamentally invalid (wrong repo, feature not bug fix).",
        impactEstimate: "Converting even 20% of closed PRs to merges would significantly boost merge rate",
        dataPoint: `${closed} closed PRs (${Math.round((closed / total) * 100)}% close rate)`,
      });
    }

    // P2: Follow-up rate
    if (open > 5) {
      items.push({
        id: "fix-followup",
        priority: "P2",
        category: "followup",
        title: "Improve PR follow-up rate",
        problem: `${open} PRs are still open. Many may have review comments that need responses or rework.`,
        suggestedFix: "Check open PRs every cycle. If reviewer left comments, spawn follow-up sub-agent immediately. If changes requested, rework and push updates. Balance follow-ups with new PR submissions.",
        impactEstimate: "Responding to reviews within 4h increases merge rate by ~25%",
        dataPoint: `${open} open PRs pending follow-up`,
      });
    }

    // Sort by priority
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        p0: items.filter((i) => i.priority === "P0").length,
        p1: items.filter((i) => i.priority === "P1").length,
        p2: items.filter((i) => i.priority === "P2").length,
      },
      context: {
        totalPRs: total,
        mergeRate: Math.round(mergeRate * 10) / 10,
        reviewRate: total > 0 ? Math.round((reviewed / total) * 100) : 0,
        oversizedRate: total > 0 ? Math.round((oversized / total) * 100) : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute action items", details: String(error) },
      { status: 500 }
    );
  }
}
