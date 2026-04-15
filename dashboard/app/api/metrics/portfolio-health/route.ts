export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews } from "@/lib/schema";
import { desc, eq, sql, and, lte } from "drizzle-orm";

export async function GET() {
  try {
    await ensureDb();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Core counts
    const [openResult, mergedResult, closedResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "open")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "merged")),
      db.select({ count: sql<number>`count(*)` }).from(pullRequests).where(eq(pullRequests.status, "closed")),
    ]);

    const open = openResult[0]?.count || 0;
    const merged = mergedResult[0]?.count || 0;
    const closed = closedResult[0]?.count || 0;

    // Stale PRs: open and created > 7 days ago (using createdAt as proxy for updatedAt)
    const staleResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.status, "open"),
          lte(pullRequests.createdAt, sevenDaysAgo)
        )
      );
    const stale = staleResult[0]?.count || 0;

    // Changes requested: open PRs with a changes_requested review (most recent review per PR)
    const changesRequestedResult = await db
      .select({
        count: sql<number>`count(DISTINCT ${pullRequests.id})`,
      })
      .from(pullRequests)
      .innerJoin(prReviews, eq(prReviews.prId, pullRequests.id))
      .where(
        and(
          eq(pullRequests.status, "open"),
          eq(prReviews.state, "changes_requested")
        )
      );
    const changesRequested = changesRequestedResult[0]?.count || 0;

    // CI failing: open PRs where metadata contains CI failure indicators
    // Since there's no dedicated CI column, check metadata JSON for common patterns
    let ciFailingOurs = 0;
    try {
      const ciResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pullRequests)
        .where(
          and(
            eq(pullRequests.status, "open"),
            sql`(
              json_extract(${pullRequests.metadata}, '$.ci_status') = 'failure'
              OR json_extract(${pullRequests.metadata}, '$.ciStatus') = 'failure'
              OR json_extract(${pullRequests.metadata}, '$.checks_failing') > 0
            )`
          )
        );
      ciFailingOurs = ciResult[0]?.count || 0;
    } catch {
      // metadata might not have CI fields — that's fine
    }

    // Portfolio score: merged / (merged + closed) * 100
    const portfolioScore =
      merged + closed > 0
        ? Math.round((merged / (merged + closed)) * 1000) / 10
        : 0;

    // Trend: last 7 days of open PR counts
    // For each of the last 7 days, count PRs that were open at end of that day
    // Approximation: PRs created before end-of-day AND not closed/merged before end-of-day
    const trend: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const dayEndResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(pullRequests)
        .where(
          and(
            lte(pullRequests.createdAt, dayEnd),
            sql`(
              ${pullRequests.status} = 'open'
              OR (${pullRequests.mergedAt} IS NOT NULL AND ${pullRequests.mergedAt} > ${dayEnd})
              OR (${pullRequests.closedAt} IS NOT NULL AND ${pullRequests.closedAt} > ${dayEnd})
            )`
          )
        );
      trend.push(dayEndResult[0]?.count || 0);
    }

    // Status determination
    const status: "healthy" | "warning" | "critical" = "healthy";

    return NextResponse.json({
      open,
      merged,
      closed,
      stale,
      changesRequested,
      ciFailingOurs,
      portfolioScore,
      trend,
      status,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch portfolio health", details: String(error) },
      { status: 500 }
    );
  }
}
