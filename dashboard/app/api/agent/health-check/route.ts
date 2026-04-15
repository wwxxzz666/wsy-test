export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews, agentLogs } from "@/lib/schema";
import { eq, sql, gte } from "drizzle-orm";

/**
 * Hard blocklist — repos where submitting PRs risks bans or reputation damage.
 * These override ALL other logic (including approved PRs).
 * Source: collab_space/v9-closed-pr-failure-analysis.md
 */
const HARD_BLOCKLIST: { repo: string; reason: string }[] = [
  { repo: "run-llama/llama_index", reason: "Maintainer threatened to ban BillionClaw (PR #21031)." },
  { repo: "JosefNemec/Playnite", reason: "Maintainer rejected contribution style." },
  { repo: "micro-editor/micro", reason: "Maintainer rejected contribution." },
  { repo: "qdrant/qdrant", reason: "Policy violation flagged by maintainer." },
  { repo: "langchain-ai/langchain", reason: "Hostile closure — PR #35978 closed immediately." },
];

/**
 * Org-level blocklist — entire GitHub orgs to avoid.
 * Matched by repo prefix (e.g., "apache/" matches "apache/arrow", "apache/mahout", etc.)
 */
const BLOCKED_ORGS = ["apache/"];

function isBlocklisted(repo: string): boolean {
  if (HARD_BLOCKLIST.some((b) => b.repo === repo)) return true;
  if (BLOCKED_ORGS.some((org) => repo.startsWith(org))) return true;
  return false;
}

/**
 * GET /api/agent/health-check
 *
 * Lightweight health check endpoint designed for the ClawOSS agent
 * to call before each heartbeat cycle. Returns a simple JSON with:
 * - Current stats
 * - Blocked repos (avoid list + hard blocklist)
 * - Approved PRs ready to merge (excluding blocklisted repos)
 * - Top action items (what to fix in this cycle)
 *
 * The agent can use this to self-correct without human intervention.
 */
export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Basic stats
    const [totalResult, mergedResult, openResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "merged")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "open")),
    ]);

    const total = totalResult[0]?.count || 0;
    const merged = mergedResult[0]?.count || 0;
    const open = openResult[0]?.count || 0;

    // Today's PRs
    const todayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, todayStart));
    const todayPRs = todayResult[0]?.count || 0;

    // Repos to avoid (3+ PRs, 0 merges)
    const repoStats = await db
      .select({
        repo: pullRequests.repo,
        total: sql<number>`count(*)`,
        merged: sql<number>`sum(case when ${pullRequests.status} = 'merged' then 1 else 0 end)`,
        open: sql<number>`sum(case when ${pullRequests.status} = 'open' then 1 else 0 end)`,
      })
      .from(pullRequests)
      .groupBy(pullRequests.repo);

    const avoidRepos = repoStats
      .filter((r) => r.total >= 2 && (r.merged ?? 0) === 0)
      .map((r) => r.repo);

    // Repos with open PRs (don't submit new ones)
    const reposWithOpenPRs = repoStats
      .filter((r) => (r.open ?? 0) > 0)
      .map((r) => r.repo);

    // Closed PRs (for rework tracking)
    const closedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(eq(pullRequests.status, "closed"));
    const closed = closedResult[0]?.count || 0;

    // Average merge probability (V10 scoring)
    let avgMergeProbability: number | null = null;
    try {
      const mpResult = await db
        .select({
          avg: sql<number>`round(avg(${pullRequests.mergeProbability}))`,
          count: sql<number>`count(${pullRequests.mergeProbability})`,
        })
        .from(pullRequests)
        .where(sql`${pullRequests.mergeProbability} IS NOT NULL`);
      if (mpResult[0]?.count > 0) {
        avgMergeProbability = mpResult[0].avg;
      }
    } catch {
      // column might not exist yet
    }

    // Approved PRs ready to merge (highest priority action)
    let approvedPRs: { repo: string; number: number; title: string; htmlUrl: string | null }[] = [];
    try {
      const approvedReviews = await db
        .select({
          prId: prReviews.prId,
        })
        .from(prReviews)
        .where(eq(prReviews.state, "approved"));

      const approvedPrIds = [...new Set(approvedReviews.map((r) => r.prId))];

      if (approvedPrIds.length > 0) {
        const openApproved = await db
          .select({
            id: pullRequests.id,
            repo: pullRequests.repo,
            number: pullRequests.number,
            title: pullRequests.title,
            htmlUrl: pullRequests.htmlUrl,
          })
          .from(pullRequests)
          .where(eq(pullRequests.status, "open"));

        approvedPRs = openApproved
          .filter((pr) => approvedPrIds.includes(pr.id))
          .filter((pr) => !isBlocklisted(pr.repo)) // Never tell agent to merge at blocklisted repos
          .map((pr) => ({
            repo: pr.repo,
            number: pr.number,
            title: pr.title,
            htmlUrl: pr.htmlUrl,
          }));
      }
    } catch {
      // non-critical
    }

    // Merge hard blocklist into avoidRepos (deduplicated)
    const blockedRepoNames = HARD_BLOCKLIST.map((b) => b.repo);
    const allAvoidRepos = [...new Set([...avoidRepos, ...blockedRepoNames])];

    // Build blockedRepos with reasons for the agent
    const blockedRepos = HARD_BLOCKLIST.map((b) => ({
      repo: b.repo,
      reason: b.reason,
    }));

    // Also check if any open PRs are at blocklisted repos (agent should NOT follow up)
    const blockedOpenPRs = repoStats
      .filter((r) => (r.open ?? 0) > 0 && isBlocklisted(r.repo))
      .map((r) => r.repo);

    // Quick directives
    const directives: string[] = [];

    if (approvedPRs.length > 0) {
      directives.unshift("MERGE NOW: " + approvedPRs.length + " approved PR(s) ready to merge: " + approvedPRs.map((pr) => pr.repo + "#" + pr.number).join(", ") + ". Run `gh pr merge --squash` if CI passes, or comment asking maintainer to trigger CI.");
    }

    if (total > 0 && merged / total < 0.05) {
      directives.push("MERGE RATE CRITICAL: Only " + ((merged / total) * 100).toFixed(1) + "%. Target trusted repos, keep PRs under 50 lines, reference real issues.");
    }

    if (blockedOpenPRs.length > 0) {
      directives.push("BLOCKLISTED REPOS WITH OPEN PRs: " + blockedOpenPRs.join(", ") + ". Do NOT follow up, comment, or interact. Let these PRs expire silently. Any interaction risks account ban.");
    }

    if (allAvoidRepos.length > 5) {
      directives.push("TOO MANY DEAD REPOS: " + allAvoidRepos.length + " repos with 0 merges or blocklisted. Focus on responsive repos only.");
    }

    // No directive about open PR count — having many open PRs is fine

    if (closed > 0 && total > 0 && closed / total > 0.3) {
      directives.push("REWORK NEEDED: " + closed + " closed PRs (" + ((closed / total) * 100).toFixed(0) + "%). Rework rejected PRs instead of abandoning — reopen and address feedback.");
    }

    // Log directives for the directives panel
    if (directives.length > 0) {
      try {
        await db.insert(agentLogs).values({
          id: crypto.randomUUID(),
          timestamp: now,
          level: "info",
          source: "directive",
          message: directives.join(" | "),
          metadata: JSON.stringify({ directives, stats: { total, merged, open, closed } }),
        });
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      healthy: directives.length === 0,
      stats: {
        total,
        merged,
        open,
        closed,
        todayPRs,
        mergeRate: total > 0 ? Math.round((merged / total) * 1000) / 10 : 0,
        reworkRate: total > 0 ? Math.round((closed / total) * 1000) / 10 : 0,
        avgMergeProbability,
      },
      approvedPRs,
      avoidRepos: allAvoidRepos,
      blockedRepos,
      reposWithOpenPRs,
      directives,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { healthy: false, error: String(error) },
      { status: 500 }
    );
  }
}
