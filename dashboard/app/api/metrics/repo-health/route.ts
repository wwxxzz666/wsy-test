export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews, subagentRuns } from "@/lib/schema";
import { sql, gte, eq, and } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * GET /api/metrics/repo-health?range=90d
 *
 * Returns per-repo health scores including:
 * - Responsiveness: has the repo reviewed any of our PRs?
 * - Merge velocity: avg days from PR submission to merge
 * - Time to first review
 * - Engagement level: responsive / slow / dead
 * - Follow-up stats per repo
 */
export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "90d";
    const days = parseInt(range) || 90;
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
        reviewed: sql<number>`sum(case when ${pullRequests.reviewCount} > 0 then 1 else 0 end)`,
      })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, since))
      .groupBy(pullRequests.repo);

    // Get merge velocity: avg time from creation to merge (in days)
    const mergeVelocity = await db
      .select({
        repo: pullRequests.repo,
        avgMergeDays: sql<number>`round(avg(
          (${pullRequests.mergedAt} - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
        minMergeDays: sql<number>`round(min(
          (${pullRequests.mergedAt} - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
        maxMergeDays: sql<number>`round(max(
          (${pullRequests.mergedAt} - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
      })
      .from(pullRequests)
      .where(
        and(
          gte(pullRequests.createdAt, since),
          eq(pullRequests.status, "merged")
        )
      )
      .groupBy(pullRequests.repo);

    const velocityMap = new Map(mergeVelocity.map((v) => [v.repo, v]));

    // Get time to first review per repo
    // We need to join PRs with their earliest review
    const firstReviewTimes = await db
      .select({
        repo: pullRequests.repo,
        avgFirstReviewDays: sql<number>`round(avg(
          (min_review.first_review_at - ${pullRequests.createdAt}) / 86400.0
        ), 1)`,
      })
      .from(pullRequests)
      .innerJoin(
        sql`(
          SELECT pr_id, MIN(submitted_at) as first_review_at
          FROM pr_reviews
          GROUP BY pr_id
        ) as min_review`,
        sql`min_review.pr_id = ${pullRequests.id}`
      )
      .where(gte(pullRequests.createdAt, since))
      .groupBy(pullRequests.repo);

    const firstReviewMap = new Map(
      firstReviewTimes.map((r) => [r.repo, r.avgFirstReviewDays])
    );

    // Follow-up stats per repo
    let followUpMap = new Map<
      string,
      { total: number; successes: number; active: number }
    >();
    try {
      const fuStats = await db
        .select({
          repo: subagentRuns.repo,
          total: sql<number>`count(*)`,
          successes: sql<number>`sum(case when ${subagentRuns.outcome} = 'success' then 1 else 0 end)`,
          active: sql<number>`sum(case when ${subagentRuns.outcome} = 'in_progress' then 1 else 0 end)`,
        })
        .from(subagentRuns)
        .where(
          and(
            gte(subagentRuns.startedAt, since),
            eq(subagentRuns.type, "followup")
          )
        )
        .groupBy(subagentRuns.repo);

      followUpMap = new Map(
        fuStats.map((f) => [
          f.repo,
          {
            total: f.total ?? 0,
            successes: f.successes ?? 0,
            active: f.active ?? 0,
          },
        ])
      );
    } catch {
      // Table might not exist
    }

    // Niche detection: agentic AI / LLM repos (our golden niche)
    const NICHE_REPO_PATTERNS = [
      /langchain/i, /langgraph/i, /llama.index/i, /llama_index/i, /autogen/i,
      /crewai/i, /semantic.kernel/i, /haystack/i, /\bdspy\b/i, /instructor/i,
      /magentic/i, /openai/i, /anthropic/i, /ollama/i, /\bvllm\b/i, /litellm/i,
      /lmstudio/i, /guidance/i, /outlines/i, /lancedb/i, /chromadb/i,
      /chroma.core/i, /weaviate/i, /qdrant/i, /milvus/i, /pinecone/i,
      /transformers/i, /huggingface/i, /llama.cpp/i, /llamacpp/i, /mistral/i,
      /cohere/i, /anyscale/i, /ray.project/i, /replicate/i, /together/i,
    ];
    const NICHE_KEYWORDS = [
      /\bagent\b/i, /\bagentic\b/i, /\bllm\b/i, /\brag\b/i, /\bembedding/i,
      /\bvector/i, /\binference\b/i, /\btransformer/i, /\bprompt/i,
      /\bchatbot\b/i, /\bcopilot\b/i, /\bai[-_]assistant/i, /\bgenai\b/i,
    ];
    function isNicheRepo(repoSlug: string): boolean {
      return NICHE_REPO_PATTERNS.some((p) => p.test(repoSlug)) ||
        NICHE_KEYWORDS.some((p) => p.test(repoSlug));
    }

    // Per-repo average diff size for merge prediction
    const diffStats = await db
      .select({
        repo: pullRequests.repo,
        avgDiff: sql<number>`round(avg(COALESCE(${pullRequests.additions}, 0) + COALESCE(${pullRequests.deletions}, 0)), 0)`,
      })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, since))
      .groupBy(pullRequests.repo);

    const diffMap = new Map(diffStats.map((d) => [d.repo, d.avgDiff ?? 0]));

    // Build repo health objects
    const repos = repoStats.map((r) => {
      const merged = r.merged ?? 0;
      const total = r.total ?? 0;
      const reviewed = r.reviewed ?? 0;
      const closedCount = r.closed ?? 0;
      const openCount = r.open ?? 0;
      const mergeRate =
        total > 0 ? Math.round((merged / total) * 1000) / 10 : 0;
      const reviewRate =
        total > 0 ? Math.round((reviewed / total) * 1000) / 10 : 0;

      const velocity = velocityMap.get(r.repo);
      const avgFirstReview = firstReviewMap.get(r.repo);
      const followUps = followUpMap.get(r.repo);

      // Compute engagement level
      let engagement: "responsive" | "slow" | "dead" = "dead";
      if (reviewed > 0) {
        const avgReviewDays = avgFirstReview ?? 999;
        if (avgReviewDays <= 3) engagement = "responsive";
        else if (avgReviewDays <= 14) engagement = "slow";
        else engagement = "dead";
      } else if (total <= 1) {
        engagement = "slow"; // Too few data points
      }

      // Health score: 0-100 composite
      let healthScore = 0;
      // Merge rate contributes 40%
      healthScore += Math.min(mergeRate, 100) * 0.4;
      // Review rate contributes 30%
      healthScore += Math.min(reviewRate, 100) * 0.3;
      // Speed of review contributes 20% (inverse: faster = higher)
      if (avgFirstReview != null && avgFirstReview > 0) {
        healthScore += Math.max(0, 100 - avgFirstReview * 10) * 0.2;
      }
      // Quality contributes 10%
      healthScore += Math.min(r.avgQuality ?? 0, 100) * 0.1;
      // Niche fit bonus (agentic AI repos get +15)
      const nicheFit = isNicheRepo(r.repo);
      if (nicheFit) healthScore += 15;
      healthScore = Math.round(Math.min(healthScore, 100));

      // Recommended action for the pipeline
      // - target_actively: responsive repo with proven merge history
      // - one_more_try: open PR got review but not merged, follow up
      // - build_trust_first: good repo but no history with us, start small
      // - avoid: dead or hostile, don't waste tokens
      let recommendedAction: "target_actively" | "one_more_try" | "build_trust_first" | "avoid";
      if (merged > 0 && engagement === "responsive") {
        recommendedAction = "target_actively";
      } else if (openCount > 0 && reviewed > 0 && merged === 0) {
        recommendedAction = "one_more_try";
      } else if (engagement === "dead" || (total >= 3 && reviewed === 0)) {
        recommendedAction = "avoid";
      } else {
        recommendedAction = "build_trust_first";
      }

      // Merge prediction score (0-100)
      // Based on monitor's weighted factors
      const avgDiff = diffMap.get(r.repo) ?? 0;
      let mergePrediction = 0;
      // Small diffs are easier to merge: <20 lines = +40, <50 = +20, <100 = +10
      if (avgDiff < 20) mergePrediction += 40;
      else if (avgDiff < 50) mergePrediction += 20;
      else if (avgDiff < 100) mergePrediction += 10;
      // Repo has merged our PRs before: +20
      if (merged > 0) mergePrediction += 20;
      // Repo is responsive (reviews within 3 days): +20
      if (engagement === "responsive") mergePrediction += 20;
      else if (engagement === "slow") mergePrediction += 5;
      // Niche fit (AI repos where we have domain expertise): +10
      if (nicheFit) mergePrediction += 10;
      // High review rate means repo is engaged: +10
      if (reviewRate >= 50) mergePrediction += 10;
      else if (reviewRate > 0) mergePrediction += 5;
      // Penalty: multiple rejected PRs = hostile repo
      if (closedCount >= 3 && merged === 0) mergePrediction -= 30;
      else if (closedCount >= 2 && merged === 0) mergePrediction -= 15;
      mergePrediction = Math.round(Math.max(0, Math.min(100, mergePrediction)));

      return {
        repo: r.repo,
        healthScore,
        engagement,
        nicheFit,
        recommendedAction,
        mergePrediction,
        avgDiffSize: avgDiff,
        prs: {
          total,
          merged,
          closed: closedCount,
          open: openCount,
          reviewed,
          mergeRate,
          reviewRate,
          avgQuality: r.avgQuality ?? 0,
        },
        velocity: velocity
          ? {
              avgDays: velocity.avgMergeDays ?? 0,
              minDays: velocity.minMergeDays ?? 0,
              maxDays: velocity.maxMergeDays ?? 0,
            }
          : null,
        timeToFirstReview: avgFirstReview ?? null,
        followUps: followUps ?? { total: 0, successes: 0, active: 0 },
      };
    });

    // Sort by health score descending
    repos.sort((a, b) => b.healthScore - a.healthScore);

    return NextResponse.json({ repos, range: `${days}d` });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch repo health", details: String(error) },
      { status: 500 }
    );
  }
}
