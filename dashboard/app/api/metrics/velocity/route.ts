export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/metrics/velocity
 *
 * Daily PR velocity — submissions, merges, closes per day.
 * Powers the velocity timeline chart on the overview page.
 * Returns last 30 days of data.
 */
export async function GET() {
  try {
    await ensureDb();

    // Get all PRs with their dates
    const prs = await db
      .select({
        createdAt: pullRequests.createdAt,
        mergedAt: pullRequests.mergedAt,
        closedAt: pullRequests.closedAt,
        status: pullRequests.status,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
      })
      .from(pullRequests);

    // Build daily buckets for last 30 days
    const now = new Date();
    const days: {
      date: string;
      submitted: number;
      merged: number;
      closed: number;
      totalLines: number;
    }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      let submitted = 0;
      let merged = 0;
      let closed = 0;
      let totalLines = 0;

      for (const pr of prs) {
        const createdDate = pr.createdAt
          ? new Date(pr.createdAt).toISOString().split("T")[0]
          : null;
        const mergedDate = pr.mergedAt
          ? new Date(pr.mergedAt).toISOString().split("T")[0]
          : null;
        const closedDate = pr.closedAt
          ? new Date(pr.closedAt).toISOString().split("T")[0]
          : null;

        if (createdDate === dateStr) {
          submitted++;
          totalLines += (pr.additions ?? 0) + (pr.deletions ?? 0);
        }
        if (mergedDate === dateStr) merged++;
        if (closedDate === dateStr && pr.status === "closed") closed++;
      }

      days.push({ date: dateStr, submitted, merged, closed, totalLines });
    }

    // Compute rolling averages (7-day)
    const rolling7d = days.map((day, i) => {
      const window = days.slice(Math.max(0, i - 6), i + 1);
      const avgSubmitted =
        Math.round(
          (window.reduce((s, d) => s + d.submitted, 0) / window.length) * 10
        ) / 10;
      const avgMerged =
        Math.round(
          (window.reduce((s, d) => s + d.merged, 0) / window.length) * 10
        ) / 10;
      return { date: day.date, avgSubmitted, avgMerged };
    });

    // Summary
    const totalSubmitted = days.reduce((s, d) => s + d.submitted, 0);
    const totalMerged = days.reduce((s, d) => s + d.merged, 0);
    const totalClosed = days.reduce((s, d) => s + d.closed, 0);
    const activeDays = days.filter((d) => d.submitted > 0).length;
    const peakDay = days.reduce(
      (max, d) => (d.submitted > max.submitted ? d : max),
      days[0]
    );

    return NextResponse.json({
      days,
      rolling7d,
      summary: {
        totalSubmitted,
        totalMerged,
        totalClosed,
        activeDays,
        avgPerDay:
          activeDays > 0
            ? Math.round((totalSubmitted / activeDays) * 10) / 10
            : 0,
        peakDay: peakDay?.date || null,
        peakCount: peakDay?.submitted || 0,
        mergeRatio:
          totalSubmitted > 0
            ? Math.round((totalMerged / totalSubmitted) * 1000) / 10
            : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch velocity", details: String(error) },
      { status: 500 }
    );
  }
}
