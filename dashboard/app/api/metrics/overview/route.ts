export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { heartbeats, pullRequests, prReviews, metricsTokens, agentLogs, conversationMessages, subagentRuns } from "@/lib/schema";
import { desc, gte, sql, eq } from "drizzle-orm";
import { DEFAULT_MODEL, getCostModel } from "@/lib/cost-models";

export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Latest heartbeat
    const latestHeartbeat = await db
      .select()
      .from(heartbeats)
      .orderBy(desc(heartbeats.timestamp))
      .limit(1);

    const hb = latestHeartbeat[0];
    const isOnline = hb
      ? hb.status === "alive" &&
        hb.timestamp.getTime() > fiveMinutesAgo.getTime()
      : false;
    const heartbeatMeta =
      hb?.metadata && typeof hb.metadata === "object"
        ? (hb.metadata as Record<string, unknown>)
        : null;
    const heartbeatBudget =
      heartbeatMeta?.budget && typeof heartbeatMeta.budget === "object"
        ? (heartbeatMeta.budget as Record<string, unknown>)
        : null;

    // Active model from latest heartbeat metadata or latest token metrics
    const latestMetricModel = await db
      .select({ model: metricsTokens.model })
      .from(metricsTokens)
      .orderBy(desc(metricsTokens.timestamp))
      .limit(1);
    const activeModel =
      (typeof heartbeatMeta?.model === "string" && heartbeatMeta.model) ||
      latestMetricModel[0]?.model ||
      DEFAULT_MODEL;
    const activeCostModel = getCostModel(activeModel);

    // Heartbeat streak
    const recentHeartbeats = await db
      .select()
      .from(heartbeats)
      .orderBy(desc(heartbeats.timestamp))
      .limit(100);

    let streak = 0;
    for (const beat of recentHeartbeats) {
      if (beat.status === "alive") streak++;
      else break;
    }

    // PR stats - full breakdown
    const [totalPRsResult, mergedPRsResult, openPRsResult, closedPRsResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "merged")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "open")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "closed")),
    ]);

    const totalPRs = totalPRsResult[0]?.count || 0;
    const mergedPRs = mergedPRsResult[0]?.count || 0;
    const openPRs = openPRsResult[0]?.count || 0;
    const closedPRs = closedPRsResult[0]?.count || 0;
    const mergeRate = totalPRs > 0 ? Math.round((mergedPRs / totalPRs) * 1000) / 10 : 0;

    // PRs that have received at least one review
    const reviewedPRsResult = await db
      .select({ count: sql<number>`count(DISTINCT ${prReviews.prId})` })
      .from(prReviews);
    const reviewedPRs = reviewedPRsResult[0]?.count || 0;

    // Follow-up sub-agent stats
    let followUpStats = { total: 0, active: 0, ledToMerge: 0 };
    try {
      const fuResults = await db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`sum(case when ${subagentRuns.outcome} = 'in_progress' then 1 else 0 end)`,
          success: sql<number>`sum(case when ${subagentRuns.outcome} = 'success' then 1 else 0 end)`,
        })
        .from(subagentRuns)
        .where(eq(subagentRuns.type, "followup"));
      followUpStats = {
        total: fuResults[0]?.total || 0,
        active: fuResults[0]?.active || 0,
        ledToMerge: fuResults[0]?.success || 0,
      };
    } catch {
      // subagent_runs table might not exist
    }

    // Today's token usage and cost from metrics_tokens table
    const todayMetrics = await db
      .select({
        totalInput: sql<number>`COALESCE(SUM(input_tokens), 0)`,
        totalOutput: sql<number>`COALESCE(SUM(output_tokens), 0)`,
        totalCost: sql<number>`COALESCE(SUM(cost_usd), 0)`,
      })
      .from(metricsTokens)
      .where(gte(metricsTokens.timestamp, todayStart));

    let inputTokensToday = todayMetrics[0]?.totalInput || 0;
    let outputTokensToday = todayMetrics[0]?.totalOutput || 0;
    let tokensUsedToday = inputTokensToday + outputTokensToday;
    let costToday = todayMetrics[0]?.totalCost || 0;

    // Fallback: estimate from conversation messages if metrics_tokens is empty
    if (tokensUsedToday === 0) {
      const convTokens = await db
        .select({
          totalTokens: sql<number>`COALESCE(SUM(token_count), 0)`,
          estimatedFromLength: sql<number>`COALESCE(SUM(CASE WHEN token_count IS NULL OR token_count = 0 THEN LENGTH(content) / 4 ELSE 0 END), 0)`,
        })
        .from(conversationMessages)
        .where(gte(conversationMessages.timestamp, todayStart));

      const fromCounts = convTokens[0]?.totalTokens || 0;
      const fromLength = convTokens[0]?.estimatedFromLength || 0;
      tokensUsedToday = fromCounts > 0 ? fromCounts : fromLength;
      // Estimate 70/30 input/output split for fallback
      inputTokensToday = Math.round(tokensUsedToday * 0.7);
      outputTokensToday = tokensUsedToday - inputTokensToday;
      // Estimate cost from active model pricing when direct cost metrics are missing
      if (tokensUsedToday > 0 && costToday === 0) {
        const avgCostPerToken =
          (activeCostModel.inputCostPerToken +
            activeCostModel.outputCostPerToken) /
          2;
        costToday = tokensUsedToday * avgCostPerToken;
      }
    }

    // Recent activity from logs
    const recentLogs = await db
      .select()
      .from(agentLogs)
      .orderBy(desc(agentLogs.timestamp))
      .limit(10);

    const recentActivity = recentLogs.map((log) => ({
      id: log.id,
      type: inferActivityType(log.message),
      description: log.message,
      timestamp: log.timestamp,
      metadata: (log.metadata as Record<string, unknown>) || {},
    }));

    // Recent PRs
    const recentPRs = await db
      .select({
        id: pullRequests.id,
        number: pullRequests.number,
        title: pullRequests.title,
        repo: pullRequests.repo,
        status: pullRequests.status,
        qualityScore: pullRequests.qualityScore,
        mergeProbability: pullRequests.mergeProbability,
        createdAt: pullRequests.createdAt,
      })
      .from(pullRequests)
      .orderBy(desc(pullRequests.createdAt))
      .limit(5);

    // Daily budget
    const todayPRs = await db
      .select({
        count: sql<number>`count(*)`,
        repo: pullRequests.repo,
      })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, todayStart))
      .groupBy(pullRequests.repo);

    const perRepo: Record<string, number> = {};
    let dailyPRs = 0;
    for (const row of todayPRs) {
      perRepo[row.repo] = row.count;
      dailyPRs += row.count;
    }

    // Current task from heartbeat
    let currentTask = null;
    if (hb?.currentTask) {
      try {
        currentTask =
          typeof hb.currentTask === "string"
            ? JSON.parse(hb.currentTask)
            : hb.currentTask;
      } catch {
        currentTask = { title: hb.currentTask, status: "coding", progress: 50 };
      }
    }

    // Average time-to-first-review (hours)
    let avgHoursToReview: number | null = null;
    try {
      const reviewTimeResult = await db
        .select({
          avgHours: sql<number>`round(avg((${prReviews.submittedAt} - ${pullRequests.createdAt}) / 3600.0), 1)`,
        })
        .from(pullRequests)
        .innerJoin(prReviews, eq(prReviews.prId, pullRequests.id));
      avgHoursToReview = reviewTimeResult[0]?.avgHours ?? null;
    } catch {
      // No reviews yet
    }

    // Total cost for cost-per-merge calculation
    const totalCostResult = await db
      .select({ total: sql<number>`COALESCE(SUM(cost_usd), 0)` })
      .from(metricsTokens);
    const totalCostAllTime = totalCostResult[0]?.total || 0;
    const costPerMerge = mergedPRs > 0 ? totalCostAllTime / mergedPRs : 0;

    // Total tokens for cost-per-merge
    const totalTokensResult = await db
      .select({
        input: sql<number>`COALESCE(SUM(input_tokens), 0)`,
        output: sql<number>`COALESCE(SUM(output_tokens), 0)`,
      })
      .from(metricsTokens);
    const totalTokensAllTime = (totalTokensResult[0]?.input || 0) + (totalTokensResult[0]?.output || 0);
    const tokensPerMerge = mergedPRs > 0 ? Math.round(totalTokensAllTime / mergedPRs) : 0;
    const toNumber = (value: unknown, fallback = 0): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const budgetTotal = toNumber(
      heartbeatBudget?.totalTokens,
      toNumber(process.env.CLAWOSS_TOKEN_BUDGET_TOTAL, 0)
    );
    const budgetUsed = toNumber(heartbeatBudget?.usedTokens, 0);
    const budgetRemaining = toNumber(
      heartbeatBudget?.remainingTokens,
      Math.max(0, budgetTotal - budgetUsed)
    );
    const tokenBudget = {
      enabled:
        Boolean(heartbeatBudget?.enabled) ||
        toNumber(process.env.CLAWOSS_TOKEN_BUDGET_TOTAL, 0) > 0,
      totalTokens: budgetTotal,
      usedTokens: budgetUsed,
      remainingTokens: budgetRemaining,
      paused: Boolean(heartbeatBudget?.paused),
    };

    return NextResponse.json({
      agentStatus: {
        isOnline,
        lastHeartbeat: hb?.timestamp || new Date(0),
        currentTask: hb?.currentTask || null,
        uptimeSeconds: hb?.uptimeSeconds || 0,
        heartbeatStreak: streak,
      },
      stats: {
        totalPRs,
        mergedPRs,
        openPRs,
        closedPRs,
        reviewedPRs,
        mergeRate,
        tokensUsedToday,
        inputTokensToday,
        outputTokensToday,
        costToday,
        totalCostAllTime,
        costPerMerge,
        tokensPerMerge,
        avgHoursToReview,
        activeModel,
      },
      funnel: {
        submitted: totalPRs,
        reviewed: reviewedPRs,
        merged: mergedPRs,
        rejected: closedPRs,
        open: openPRs,
      },
      followUps: followUpStats,
      recentActivity,
      currentTask,
      recentPRs,
      dailyBudget: {
        dailyPRs,
        perRepo,
      },
      runtime: {
        model: activeModel,
        tokenBudget,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch overview", details: String(error) },
      { status: 500 }
    );
  }
}

function inferActivityType(message: string): string {
  if (/merged/i.test(message)) return "pr_merged";
  if (/created|submitted|opened/i.test(message)) return "pr_created";
  if (/closed/i.test(message)) return "pr_closed";
  if (/review/i.test(message)) return "review_received";
  if (/heartbeat/i.test(message)) return "heartbeat";
  if (/error|fail/i.test(message)) return "error";
  return "task_started";
}
