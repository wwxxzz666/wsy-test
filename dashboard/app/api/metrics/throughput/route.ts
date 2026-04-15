export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, subagentRuns, heartbeats } from "@/lib/schema";
import { desc, gte, eq, sql, and } from "drizzle-orm";

export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    // Slots used: count in_progress subagent runs
    const slotsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subagentRuns)
      .where(eq(subagentRuns.outcome, "in_progress"));
    const slotsUsed = slotsResult[0]?.count || 0;

    // PRs today
    const prsTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, todayStart));
    const prsToday = prsTodayResult[0]?.count || 0;

    // Merged today
    const mergedTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.status, "merged"),
          gte(pullRequests.mergedAt, todayStart)
        )
      );
    const mergedToday = mergedTodayResult[0]?.count || 0;

    // Average spawn-to-submit: avg duration of completed subagent runs (in minutes)
    const avgDurationResult = await db
      .select({
        avgMs: sql<number>`COALESCE(avg(${subagentRuns.durationMs}), 0)`,
      })
      .from(subagentRuns)
      .where(
        and(
          sql`${subagentRuns.durationMs} IS NOT NULL`,
          sql`${subagentRuns.durationMs} > 0`
        )
      );
    const avgSpawnToSubmit = Math.round((avgDurationResult[0]?.avgMs || 0) / 60000);

    // Idle cycles: heartbeats in last 3 hours where no subagent was spawned
    // Count heartbeats, then count heartbeats that overlap with subagent spawns
    let idleCycles = 0;
    try {
      const recentHeartbeats = await db
        .select({ count: sql<number>`count(*)` })
        .from(heartbeats)
        .where(gte(heartbeats.timestamp, threeHoursAgo));

      const heartbeatsWithSpawns = await db
        .select({
          count: sql<number>`count(DISTINCT ${heartbeats.id})`,
        })
        .from(heartbeats)
        .innerJoin(
          subagentRuns,
          sql`${subagentRuns.startedAt} BETWEEN datetime(${heartbeats.timestamp}, '-5 minutes') AND datetime(${heartbeats.timestamp}, '+5 minutes')`
        )
        .where(gte(heartbeats.timestamp, threeHoursAgo));

      const totalHB = recentHeartbeats[0]?.count || 0;
      const activeHB = heartbeatsWithSpawns[0]?.count || 0;
      idleCycles = Math.max(totalHB - activeHB, 0);
    } catch {
      // heartbeats table might be empty
    }

    // Hourly PRs: PRs per hour for last 12 hours
    const hourlyPRs: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pullRequests)
        .where(
          and(
            gte(pullRequests.createdAt, hourStart),
            sql`${pullRequests.createdAt} < ${hourEnd}`
          )
        );
      hourlyPRs.push(hourResult[0]?.count || 0);
    }

    return NextResponse.json({
      slotsUsed,
      totalSlots: 10,
      prsToday,
      mergedToday,
      avgSpawnToSubmit,
      idleCycles,
      hourlyPRs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch throughput metrics", details: String(error) },
      { status: 500 }
    );
  }
}
