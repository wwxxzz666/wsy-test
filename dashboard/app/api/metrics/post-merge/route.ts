export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/metrics/post-merge
 *
 * Post-merge health tracking for merged PRs.
 * Checks if merged PRs have caused any regressions by looking for:
 * - Issues referencing the PR number
 * - Revert commits mentioning the PR
 * - Commits referencing the PR number in the days after merge
 *
 * This helps the agent learn which types of changes are safe.
 */
export async function GET() {
  try {
    await ensureDb();

    const mergedPRs = await db
      .select({
        id: pullRequests.id,
        repo: pullRequests.repo,
        number: pullRequests.number,
        title: pullRequests.title,
        mergedAt: pullRequests.mergedAt,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        prType: pullRequests.prType,
        htmlUrl: pullRequests.htmlUrl,
      })
      .from(pullRequests)
      .where(eq(pullRequests.status, "merged"));

    if (mergedPRs.length === 0) {
      return NextResponse.json({
        mergedPRs: [],
        summary: { total: 0, healthy: 0, regressed: 0, unknown: 0 },
      });
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const results: {
      repo: string;
      number: number;
      title: string;
      mergedAt: Date | null;
      htmlUrl: string | null;
      prType: string | null;
      diffSize: number;
      health: "healthy" | "regressed" | "unknown";
      daysSinceMerge: number;
      signals: string[];
    }[] = [];

    for (const pr of mergedPRs) {
      const [owner, repo] = pr.repo.split("/");
      if (!owner || !repo) continue;

      const daysSinceMerge = pr.mergedAt
        ? Math.round((Date.now() - pr.mergedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const signals: string[] = [];
      let health: "healthy" | "regressed" | "unknown" = "unknown";

      try {
        // Search for issues/PRs referencing this PR number
        const { data: searchResults } = await octokit.search.issuesAndPullRequests({
          q: `repo:${pr.repo} ${pr.number} is:issue`,
          per_page: 10,
        });

        // Check if any issues mention regression, revert, or break
        for (const issue of searchResults.items) {
          const text = `${issue.title} ${issue.body || ""}`.toLowerCase();
          if (/revert|regress|broke|break|rollback|undo/.test(text)) {
            signals.push(`Issue #${issue.number}: "${issue.title}" (possible regression)`);
            health = "regressed";
          }
        }

        // Check recent commits for reverts
        try {
          const { data: commits } = await octokit.repos.listCommits({
            owner,
            repo,
            since: pr.mergedAt?.toISOString(),
            per_page: 30,
          });

          for (const commit of commits) {
            const msg = (commit.commit.message || "").toLowerCase();
            if (
              (msg.includes("revert") && msg.includes(`#${pr.number}`)) ||
              (msg.includes("revert") && msg.includes(pr.title.toLowerCase().slice(0, 30)))
            ) {
              signals.push(`Revert commit: "${commit.commit.message.slice(0, 80)}"`);
              health = "regressed";
            }
          }
        } catch {
          // commits check failed
        }

        // If no negative signals found and it's been at least 3 days, mark healthy
        if (health === "unknown" && daysSinceMerge >= 3) {
          health = "healthy";
          signals.push(`No regressions detected in ${daysSinceMerge} days`);
        } else if (health === "unknown") {
          signals.push(`Monitoring (${daysSinceMerge}d since merge, need 3d minimum)`);
        }
      } catch {
        signals.push("Could not check health (API error)");
      }

      results.push({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        mergedAt: pr.mergedAt,
        htmlUrl: pr.htmlUrl,
        prType: pr.prType,
        diffSize: (pr.additions ?? 0) + (pr.deletions ?? 0),
        health,
        daysSinceMerge,
        signals,
      });
    }

    const healthy = results.filter((r) => r.health === "healthy").length;
    const regressed = results.filter((r) => r.health === "regressed").length;
    const unknown = results.filter((r) => r.health === "unknown").length;

    return NextResponse.json({
      mergedPRs: results,
      summary: {
        total: results.length,
        healthy,
        regressed,
        unknown,
        healthRate: results.length > 0
          ? Math.round((healthy / results.length) * 1000) / 10
          : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check post-merge health", details: String(error) },
      { status: 500 }
    );
  }
}
