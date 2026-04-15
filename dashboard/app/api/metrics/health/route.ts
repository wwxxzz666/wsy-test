export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { heartbeats, agentLogs } from "@/lib/schema";
import { desc, gte, eq, and, sql } from "drizzle-orm";

export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Heartbeat data
    const recentHeartbeats = await db
      .select()
      .from(heartbeats)
      .orderBy(desc(heartbeats.timestamp))
      .limit(200);

    const latestBeat = recentHeartbeats[0];
    let streak = 0;
    for (const beat of recentHeartbeats) {
      if (beat.status === "alive") streak++;
      else break;
    }

    // Uptime calculation
    const totalBeats = recentHeartbeats.length;
    const aliveBeats = recentHeartbeats.filter((b) => b.status === "alive").length;
    const uptimePercentage = totalBeats > 0 ? (aliveBeats / totalBeats) * 100 : 0;
    const firstBeat = recentHeartbeats[recentHeartbeats.length - 1];
    const offlineBeats = totalBeats - aliveBeats;
    const downtimeMinutes = offlineBeats * 5; // assuming 5 min intervals

    // Error rate
    const recentErrors = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentLogs)
      .where(and(gte(agentLogs.timestamp, oneDayAgo), eq(agentLogs.level, "error")));

    const errorCount = recentErrors[0]?.count || 0;
    const errorPerHour = Math.round((errorCount / 24) * 10) / 10;

    const lastError = await db
      .select()
      .from(agentLogs)
      .where(eq(agentLogs.level, "error"))
      .orderBy(desc(agentLogs.timestamp))
      .limit(1);

    // Determine error trend
    const olderErrors = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentLogs)
      .where(
        and(
          gte(agentLogs.timestamp, new Date(now.getTime() - 48 * 60 * 60 * 1000)),
          eq(agentLogs.level, "error")
        )
      );

    const olderErrorCount = (olderErrors[0]?.count || 0) - errorCount;
    let trend: "increasing" | "stable" | "decreasing" = "stable";
    if (errorCount > olderErrorCount * 1.2) trend = "increasing";
    else if (errorCount < olderErrorCount * 0.8) trend = "decreasing";

    return NextResponse.json({
      heartbeat: {
        lastBeat: latestBeat?.timestamp || null,
        intervalMinutes: 5,
        streak,
      },
      uptime: {
        percentage: Math.round(uptimePercentage * 10) / 10,
        since: firstBeat?.timestamp || now,
        totalDowntimeMinutes: downtimeMinutes,
      },
      errorRate: {
        perHour: errorPerHour,
        trend,
        lastError: lastError[0]?.timestamp || null,
      },
      sessions: [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch health data", details: String(error) },
      { status: 500 }
    );
  }
}
