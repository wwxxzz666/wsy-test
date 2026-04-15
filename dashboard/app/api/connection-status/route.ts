export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { heartbeats, metricsTokens, agentLogs } from "@/lib/schema";
import { desc, gte, sql, eq, and } from "drizzle-orm";
import { DEFAULT_MODEL } from "@/lib/cost-models";

export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Latest heartbeat
    const latestHeartbeat = await db
      .select()
      .from(heartbeats)
      .orderBy(desc(heartbeats.timestamp))
      .limit(1);

    const hb = latestHeartbeat[0];
    const lastBeatTime = hb?.timestamp?.getTime() || 0;
    const heartbeatMeta =
      hb?.metadata && typeof hb.metadata === "object"
        ? (hb.metadata as Record<string, unknown>)
        : null;
    const heartbeatBudget =
      heartbeatMeta?.budget && typeof heartbeatMeta.budget === "object"
        ? (heartbeatMeta.budget as Record<string, unknown>)
        : null;

    // Determine connection state
    let connectionState: "connected" | "degraded" | "disconnected" | "unknown" = "unknown";
    let connectionMessage = "No heartbeat data available";

    if (hb) {
      if (hb.status === "offline") {
        connectionState = "disconnected";
        connectionMessage = "Agent paused or offline";
      } else if (hb.status === "degraded") {
        connectionState = "degraded";
        connectionMessage = "Agent reporting degraded health";
      } else if (lastBeatTime > fiveMinutesAgo.getTime()) {
        connectionState = "connected";
        connectionMessage = "Agent is actively reporting";
      } else if (lastBeatTime > fifteenMinutesAgo.getTime()) {
        connectionState = "degraded";
        connectionMessage = "Agent heartbeat delayed";
      } else {
        connectionState = "disconnected";
        connectionMessage = "Agent has not reported recently";
      }
    }

    // Recent heartbeat count (last hour)
    const recentHeartbeats = await db
      .select({ count: sql<number>`count(*)` })
      .from(heartbeats)
      .where(gte(heartbeats.timestamp, oneHourAgo));

    // Recent errors (last hour)
    const recentErrors = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentLogs)
      .where(and(gte(agentLogs.timestamp, oneHourAgo), eq(agentLogs.level, "error")));

    // Last metric received
    const lastMetric = await db
      .select()
      .from(metricsTokens)
      .orderBy(desc(metricsTokens.timestamp))
      .limit(1);

    // Data pipeline status
    const hasHeartbeats = (recentHeartbeats[0]?.count || 0) > 0;
    const hasMetrics = !!lastMetric[0];
    const hasRecentMetrics = lastMetric[0]
      ? lastMetric[0].timestamp.getTime() > oneHourAgo.getTime()
      : false;
    const activeModel =
      (typeof heartbeatMeta?.model === "string" && heartbeatMeta.model) ||
      lastMetric[0]?.model ||
      DEFAULT_MODEL;
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

    return NextResponse.json({
      connection: {
        state: connectionState,
        message: connectionMessage,
        lastHeartbeat: hb?.timestamp || null,
        heartbeatStatus: hb?.status || null,
        model: activeModel,
        tokenBudget: {
          enabled:
            Boolean(heartbeatBudget?.enabled) ||
            toNumber(process.env.CLAWOSS_TOKEN_BUDGET_TOTAL, 0) > 0,
          totalTokens: budgetTotal,
          usedTokens: budgetUsed,
          remainingTokens: budgetRemaining,
          paused: Boolean(heartbeatBudget?.paused),
        },
      },
      pipeline: {
        heartbeats: hasHeartbeats,
        metrics: hasRecentMetrics,
        heartbeatsLastHour: recentHeartbeats[0]?.count || 0,
        errorsLastHour: recentErrors[0]?.count || 0,
        lastMetricAt: lastMetric[0]?.timestamp || null,
      },
      hasAnyData: hasHeartbeats || hasMetrics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check connection", details: String(error) },
      { status: 500 }
    );
  }
}
