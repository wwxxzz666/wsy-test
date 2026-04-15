export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews, autonomySnapshots, agentState } from "@/lib/schema";
import { eq, sql, desc, gte, and } from "drizzle-orm";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  metric: string;
  value: number | string;
  threshold: number | string | null;
  timestamp: string;
}

/**
 * GET /api/metrics/alerts
 *
 * Computes real-time alerts based on dashboard metrics.
 * These surface problems that need immediate prompt/config changes.
 */
export async function GET() {
  try {
    await ensureDb();
    const alerts: Alert[] = [];
    const now = new Date();

    // 1. Merge rate check
    const [totalResult, mergedResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "merged")),
    ]);
    const totalPRs = totalResult[0]?.count || 0;
    const mergedPRs = mergedResult[0]?.count || 0;
    const mergeRate = totalPRs > 0 ? (mergedPRs / totalPRs) * 100 : 0;

    if (totalPRs >= 10 && mergeRate < 5) {
      alerts.push({
        id: "low-merge-rate",
        severity: "critical",
        title: "Merge rate critically low",
        detail: `${mergeRate.toFixed(1)}% merge rate across ${totalPRs} PRs. AI benchmark is 32.7%. Check targeting strategy and PR quality.`,
        metric: "merge_rate",
        value: mergeRate.toFixed(1),
        threshold: "5%",
        timestamp: now.toISOString(),
      });
    } else if (totalPRs >= 10 && mergeRate < 20) {
      alerts.push({
        id: "low-merge-rate",
        severity: "warning",
        title: "Merge rate below benchmark",
        detail: `${mergeRate.toFixed(1)}% merge rate vs 32.7% AI benchmark.`,
        metric: "merge_rate",
        value: mergeRate.toFixed(1),
        threshold: "32.7%",
        timestamp: now.toISOString(),
      });
    }

    // 2. Review rate check
    const reviewedResult = await db
      .select({ count: sql<number>`count(DISTINCT ${prReviews.prId})` })
      .from(prReviews);
    const reviewed = reviewedResult[0]?.count || 0;
    const reviewRate = totalPRs > 0 ? (reviewed / totalPRs) * 100 : 0;

    if (totalPRs >= 10 && reviewRate < 20) {
      alerts.push({
        id: "low-review-rate",
        severity: "critical",
        title: "Most PRs are being ignored",
        detail: `Only ${reviewRate.toFixed(0)}% of PRs received any review. ${totalPRs - reviewed} PRs have zero engagement.`,
        metric: "review_rate",
        value: reviewRate.toFixed(0),
        threshold: "20%",
        timestamp: now.toISOString(),
      });
    }

    // 3. Duplicate detection
    const repoCounts = await db
      .select({
        repo: pullRequests.repo,
        count: sql<number>`count(*)`,
      })
      .from(pullRequests)
      .groupBy(pullRequests.repo);

    const multiPrRepos = repoCounts.filter((r) => r.count >= 3);
    if (multiPrRepos.length >= 3) {
      alerts.push({
        id: "duplicate-spam",
        severity: "warning",
        title: "Possible PR spam detected",
        detail: `${multiPrRepos.length} repos have 3+ PRs. Top: ${multiPrRepos
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((r) => `${r.repo} (${r.count})`)
          .join(", ")}`,
        metric: "duplicate_repos",
        value: multiPrRepos.length,
        threshold: "3",
        timestamp: now.toISOString(),
      });
    }

    // 4. Autonomy score trend (if snapshots exist)
    try {
      const recentSnapshots = await db
        .select({
          score: autonomySnapshots.score,
          timestamp: autonomySnapshots.timestamp,
        })
        .from(autonomySnapshots)
        .orderBy(desc(autonomySnapshots.timestamp))
        .limit(5);

      if (recentSnapshots.length >= 2) {
        const latest = recentSnapshots[0].score;
        const previous = recentSnapshots[1].score;
        if (latest < previous - 10) {
          alerts.push({
            id: "autonomy-drop",
            severity: "warning",
            title: "Autonomy score dropped",
            detail: `Score fell from ${previous} to ${latest} (-${previous - latest} points).`,
            metric: "autonomy_score",
            value: latest,
            threshold: previous.toString(),
            timestamp: now.toISOString(),
          });
        }
        if (latest === 0) {
          alerts.push({
            id: "autonomy-zero",
            severity: "critical",
            title: "Autonomy score is zero",
            detail: "All penalty categories are maxed out. Prompt improvements needed urgently.",
            metric: "autonomy_score",
            value: 0,
            threshold: ">0",
            timestamp: now.toISOString(),
          });
        }
      }
    } catch {
      // snapshots table may not exist yet
    }

    // 5. Daily volume check
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayPRs = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, todayStart));
    const todayCount = todayPRs[0]?.count || 0;

    if (todayCount > 30) {
      alerts.push({
        id: "high-volume",
        severity: "info",
        title: "High PR volume today",
        detail: `${todayCount} PRs submitted today. Ensure quality checks (linter, tests, size limits) are running for each submission.`,
        metric: "daily_prs",
        value: todayCount,
        threshold: "30",
        timestamp: now.toISOString(),
      });
    }

    // 6. All PRs closed (zero success) — most severe
    if (totalPRs >= 20 && mergedPRs === 0) {
      alerts.push({
        id: "zero-merges",
        severity: "critical",
        title: "No PRs have been merged",
        detail: `0 out of ${totalPRs} PRs merged. The current strategy is not working. Major changes needed.`,
        metric: "merged_prs",
        value: 0,
        threshold: ">0",
        timestamp: now.toISOString(),
      });
    }

    // 7. Always-on subagent dead check
    try {
      const healthRows = await db
        .select()
        .from(agentState)
        .where(eq(agentState.currentSkill, "subagent-health"))
        .orderBy(desc(agentState.timestamp))
        .limit(1);

      const healthRow = healthRows[0];
      if (healthRow && healthRow.metadata) {
        const meta = healthRow.metadata as Record<string, unknown>;
        const alwaysOnData = (meta.alwaysOn || {}) as Record<
          string,
          { status?: string; ageMinutes?: number }
        >;
        const alwaysOnLabels = ["scout", "pr-monitor", "pr-analyst"];
        const deadAlwaysOn = alwaysOnLabels.filter((label) => {
          const camelKey = label.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
          const data = alwaysOnData[camelKey] || alwaysOnData[label];
          if (!data) return true;
          return data.status === "DEAD" || (data.ageMinutes != null && data.ageMinutes > 30);
        });

        if (deadAlwaysOn.length > 0) {
          alerts.push({
            id: "always-on-dead",
            severity: "critical",
            title: "Always-on subagent(s) dead",
            detail: `${deadAlwaysOn.join(", ")} ${deadAlwaysOn.length === 1 ? "has" : "have"} been dead or stale for >30 min. Check subagent health and restart.`,
            metric: "always_on_dead",
            value: deadAlwaysOn.length,
            threshold: "0",
            timestamp: now.toISOString(),
          });
        }

        // 8. Impl slots empty — agent is idle
        const implSlotsData = (meta.implSlots || []) as Array<{
          status?: string;
        } | null>;
        const activeImplSlots = implSlotsData.filter(
          (s) => s !== null && (s.status === "ACTIVE" || s.status === "IDLE")
        ).length;

        if (activeImplSlots === 0) {
          alerts.push({
            id: "slots-empty",
            severity: "warning",
            title: "All impl slots empty — agent is idle",
            detail: `0/${implSlotsData.length || 10} implementation slots in use. The agent may be stuck or paused.`,
            metric: "impl_slots_active",
            value: 0,
            threshold: ">0",
            timestamp: now.toISOString(),
          });
        }
      }
    } catch {
      // subagent health data may not exist yet
    }

    // 10. PRs needing follow-up: 15+ open PRs older than 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oldPRsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.status, "open"),
          sql`${pullRequests.createdAt} < ${sevenDaysAgo}`
        )
      );
    const oldCount = oldPRsResult[0]?.count || 0;

    if (oldCount >= 15) {
      alerts.push({
        id: "prs-need-followup",
        severity: "info",
        title: "Many PRs awaiting review",
        detail: `${oldCount} open PRs older than 7 days. Consider bumping or following up on them.`,
        metric: "old_prs",
        value: oldCount,
        threshold: "15",
        timestamp: now.toISOString(),
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === "critical").length,
        warning: alerts.filter((a) => a.severity === "warning").length,
        info: alerts.filter((a) => a.severity === "info").length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute alerts", details: String(error) },
      { status: 500 }
    );
  }
}
