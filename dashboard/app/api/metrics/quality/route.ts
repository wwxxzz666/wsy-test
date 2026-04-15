export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, qualityScores, prReviews } from "@/lib/schema";
import { desc, gte, eq, sql } from "drizzle-orm";
import { subDays, format } from "date-fns";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "30d";
    const days = parseInt(range) || 30;
    const since = subDays(new Date(), days);

    // Overview stats
    const allScores = await db
      .select()
      .from(qualityScores)
      .where(gte(qualityScores.scoredAt, since));

    const avgScore =
      allScores.length > 0
        ? allScores.reduce((s, q) => s + q.overallScore, 0) / allScores.length
        : 0;

    // First pass rate (PRs merged without changes_requested)
    const allPRs = await db
      .select()
      .from(pullRequests)
      .where(gte(pullRequests.createdAt, since));

    const mergedPRs = allPRs.filter((p) => p.status === "merged");
    const closedPRs = allPRs.filter((p) => p.status === "closed");
    const totalResolved = mergedPRs.length + closedPRs.length;

    // Check which PRs had changes_requested reviews
    let firstPassCount = 0;
    for (const pr of mergedPRs) {
      const reviews = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prId, pr.id));
      const hadChangesRequested = reviews.some(
        (r) => r.state === "changes_requested"
      );
      if (!hadChangesRequested) firstPassCount++;
    }

    const firstPassRate =
      mergedPRs.length > 0 ? (firstPassCount / mergedPRs.length) * 100 : 0;
    const rejectionRate =
      totalResolved > 0 ? (closedPRs.length / totalResolved) * 100 : 0;

    // Quality trend - group by day
    const trendMap = new Map<string, number[]>();
    for (const score of allScores) {
      const day = format(score.scoredAt, "yyyy-MM-dd");
      const existing = trendMap.get(day) || [];
      existing.push(score.overallScore);
      trendMap.set(day, existing);
    }

    const trend = Array.from(trendMap.entries())
      .map(([date, scores]) => ({
        date,
        score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Quality by repo
    const repoMap = new Map<string, { scores: number[]; count: number }>();
    for (const pr of allPRs) {
      if (pr.qualityScore != null) {
        const existing = repoMap.get(pr.repo) || { scores: [], count: 0 };
        existing.scores.push(pr.qualityScore);
        existing.count++;
        repoMap.set(pr.repo, existing);
      }
    }

    const byRepo = Array.from(repoMap.entries()).map(([repo, data]) => ({
      repo,
      avgScore:
        Math.round(
          (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10
        ) / 10,
      prCount: data.count,
    }));

    // Distribution
    const buckets = [
      { range: "0-20", count: 0 },
      { range: "20-40", count: 0 },
      { range: "40-60", count: 0 },
      { range: "60-80", count: 0 },
      { range: "80-100", count: 0 },
    ];
    for (const score of allScores) {
      const idx = Math.min(Math.floor(score.overallScore / 20), 4);
      buckets[idx].count++;
    }

    // Review feedback
    const recentReviews = await db
      .select()
      .from(prReviews)
      .orderBy(desc(prReviews.submittedAt))
      .limit(20);

    const feedback = [];
    for (const review of recentReviews) {
      if (!review.body) continue;
      const pr = await db.query.pullRequests.findFirst({
        where: eq(pullRequests.id, review.prId),
      });
      if (!pr) continue;

      feedback.push({
        prNumber: pr.number,
        prTitle: pr.title,
        reviewer: review.reviewer,
        comment: review.body,
        sentiment:
          review.state === "approved"
            ? "positive"
            : review.state === "changes_requested"
              ? "negative"
              : "neutral",
        date: review.submittedAt,
      });
    }

    return NextResponse.json({
      overview: {
        avgScore: Math.round(avgScore * 10) / 10,
        avgScoreChange: 0,
        firstPassRate: Math.round(firstPassRate * 10) / 10,
        firstPassChange: 0,
        reviewScore: 0,
        rejectionRate: Math.round(rejectionRate * 10) / 10,
        rejectionChange: 0,
      },
      trend,
      byRepo,
      rejectionReasons: [],
      distribution: buckets,
      feedback,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch quality data", details: String(error) },
      { status: 500 }
    );
  }
}
