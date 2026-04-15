export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

/**
 * GET /api/metrics/response-times
 *
 * Computes time-to-first-review distribution for all PRs.
 * Shows which repos are responsive and which ignore us.
 * Key metric: 4.6x longer wait for AI PRs (industry benchmark).
 */
export async function GET() {
  try {
    await ensureDb();

    // Get PRs with their first review time
    const prData = await db
      .select({
        prId: pullRequests.id,
        repo: pullRequests.repo,
        number: pullRequests.number,
        title: pullRequests.title,
        status: pullRequests.status,
        createdAt: pullRequests.createdAt,
        htmlUrl: pullRequests.htmlUrl,
      })
      .from(pullRequests);

    // Get all reviews
    const reviews = await db
      .select({
        prId: prReviews.prId,
        submittedAt: prReviews.submittedAt,
        state: prReviews.state,
        reviewer: prReviews.reviewer,
      })
      .from(prReviews);

    // Map first review per PR
    const firstReviewByPr = new Map<string, { submittedAt: Date; reviewer: string; state: string }>();
    for (const rev of reviews) {
      const existing = firstReviewByPr.get(rev.prId);
      if (!existing || rev.submittedAt.getTime() < existing.submittedAt.getTime()) {
        firstReviewByPr.set(rev.prId, {
          submittedAt: rev.submittedAt,
          reviewer: rev.reviewer,
          state: rev.state,
        });
      }
    }

    // Calculate hours to first review
    const responseTimes: {
      repo: string;
      number: number;
      title: string;
      status: string;
      htmlUrl: string | null;
      hoursToReview: number | null;
      reviewer: string | null;
      reviewState: string | null;
    }[] = [];

    for (const pr of prData) {
      const firstReview = firstReviewByPr.get(pr.prId);
      const hoursToReview = firstReview
        ? Math.round(
            ((firstReview.submittedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60)) * 10
          ) / 10
        : null;

      responseTimes.push({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        status: pr.status,
        htmlUrl: pr.htmlUrl,
        hoursToReview,
        reviewer: firstReview?.reviewer || null,
        reviewState: firstReview?.state || null,
      });
    }

    // Bucket distribution
    const buckets = [
      { label: "<1h", min: 0, max: 1, count: 0 },
      { label: "1-4h", min: 1, max: 4, count: 0 },
      { label: "4-12h", min: 4, max: 12, count: 0 },
      { label: "12-24h", min: 12, max: 24, count: 0 },
      { label: "1-3d", min: 24, max: 72, count: 0 },
      { label: "3-7d", min: 72, max: 168, count: 0 },
      { label: ">7d", min: 168, max: Infinity, count: 0 },
    ];

    const reviewed = responseTimes.filter((r) => r.hoursToReview != null);
    const unreviewed = responseTimes.filter((r) => r.hoursToReview == null);

    for (const pr of reviewed) {
      const h = pr.hoursToReview!;
      for (const bucket of buckets) {
        if (h >= bucket.min && h < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    // Per-repo response time stats
    const repoStats = new Map<string, { times: number[]; total: number; reviewed: number }>();
    for (const pr of responseTimes) {
      const stats = repoStats.get(pr.repo) || { times: [], total: 0, reviewed: 0 };
      stats.total++;
      if (pr.hoursToReview != null) {
        stats.times.push(pr.hoursToReview);
        stats.reviewed++;
      }
      repoStats.set(pr.repo, stats);
    }

    const repoResponseRanking = Array.from(repoStats.entries())
      .map(([repo, stats]) => ({
        repo,
        total: stats.total,
        reviewed: stats.reviewed,
        reviewRate: stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0,
        medianHours: stats.times.length > 0
          ? (() => {
              const sorted = [...stats.times].sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            })()
          : null,
        avgHours: stats.times.length > 0
          ? Math.round((stats.times.reduce((s, t) => s + t, 0) / stats.times.length) * 10) / 10
          : null,
      }))
      .sort((a, b) => {
        // Sort by review rate desc, then by median hours asc
        if (a.reviewRate !== b.reviewRate) return b.reviewRate - a.reviewRate;
        if (a.medianHours == null) return 1;
        if (b.medianHours == null) return -1;
        return a.medianHours - b.medianHours;
      });

    // Summary
    const allHours = reviewed.map((r) => r.hoursToReview!);
    const sortedHours = [...allHours].sort((a, b) => a - b);
    const medianHours = sortedHours.length > 0
      ? (() => {
          const mid = Math.floor(sortedHours.length / 2);
          return sortedHours.length % 2
            ? sortedHours[mid]
            : (sortedHours[mid - 1] + sortedHours[mid]) / 2;
        })()
      : null;
    const avgHours = allHours.length > 0
      ? Math.round((allHours.reduce((s, h) => s + h, 0) / allHours.length) * 10) / 10
      : null;

    return NextResponse.json({
      distribution: buckets,
      repoRanking: repoResponseRanking,
      summary: {
        totalPRs: responseTimes.length,
        reviewed: reviewed.length,
        unreviewed: unreviewed.length,
        reviewRate: responseTimes.length > 0
          ? Math.round((reviewed.length / responseTimes.length) * 100)
          : 0,
        medianHours,
        avgHours,
        // Benchmark: AI PRs wait 4.6x longer than human PRs
        benchmarkHumanMedian: medianHours != null ? Math.round((medianHours / 4.6) * 10) / 10 : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch response times", details: String(error) },
      { status: 500 }
    );
  }
}
