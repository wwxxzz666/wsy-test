export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/metrics/correlations
 *
 * Analyzes which factors correlate with merge success.
 * Helps the agent and prompt architect understand what works.
 */
export async function GET() {
  try {
    await ensureDb();

    const allPRs = await db
      .select({
        status: pullRequests.status,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        filesChanged: pullRequests.filesChanged,
        prType: pullRequests.prType,
        repo: pullRequests.repo,
        createdAt: pullRequests.createdAt,
        qualityScore: pullRequests.qualityScore,
      })
      .from(pullRequests);

    if (allPRs.length === 0) {
      return NextResponse.json({ factors: [], insights: [] });
    }

    const total = allPRs.length;
    const merged = allPRs.filter((p) => p.status === "merged");
    const overallMergeRate = total > 0 ? merged.length / total : 0;

    // Factor 1: Diff size buckets
    const sizeBuckets = [
      { label: "1-25 lines", min: 0, max: 25 },
      { label: "26-50 lines", min: 26, max: 50 },
      { label: "51-100 lines", min: 51, max: 100 },
      { label: "101-200 lines", min: 101, max: 200 },
      { label: "201-500 lines", min: 201, max: 500 },
      { label: "500+ lines", min: 501, max: Infinity },
    ];

    const sizeCorrelation = sizeBuckets.map((bucket) => {
      const inBucket = allPRs.filter((p) => {
        const diff = (p.additions ?? 0) + (p.deletions ?? 0);
        return diff >= bucket.min && diff <= bucket.max;
      });
      const mergedInBucket = inBucket.filter((p) => p.status === "merged");
      const rate = inBucket.length > 0 ? mergedInBucket.length / inBucket.length : 0;
      return {
        label: bucket.label,
        total: inBucket.length,
        merged: mergedInBucket.length,
        mergeRate: Math.round(rate * 1000) / 10,
        lift: overallMergeRate > 0 ? Math.round((rate / overallMergeRate - 1) * 100) : 0,
      };
    });

    // Factor 2: PR type
    const typeGroups = new Map<string, { total: number; merged: number }>();
    for (const pr of allPRs) {
      const type = pr.prType || "unknown";
      const group = typeGroups.get(type) || { total: 0, merged: 0 };
      group.total++;
      if (pr.status === "merged") group.merged++;
      typeGroups.set(type, group);
    }

    const typeCorrelation = Array.from(typeGroups.entries())
      .map(([type, stats]) => ({
        label: type,
        total: stats.total,
        merged: stats.merged,
        mergeRate: stats.total > 0 ? Math.round((stats.merged / stats.total) * 1000) / 10 : 0,
        lift:
          overallMergeRate > 0 && stats.total > 0
            ? Math.round(((stats.merged / stats.total) / overallMergeRate - 1) * 100)
            : 0,
      }))
      .sort((a, b) => b.mergeRate - a.mergeRate);

    // Factor 3: Files changed
    const filesBuckets = [
      { label: "1 file", min: 0, max: 1 },
      { label: "2-3 files", min: 2, max: 3 },
      { label: "4-5 files", min: 4, max: 5 },
      { label: "6-10 files", min: 6, max: 10 },
      { label: "10+ files", min: 11, max: Infinity },
    ];

    const filesCorrelation = filesBuckets.map((bucket) => {
      const inBucket = allPRs.filter((p) => {
        const files = p.filesChanged ?? 0;
        return files >= bucket.min && files <= bucket.max;
      });
      const mergedInBucket = inBucket.filter((p) => p.status === "merged");
      const rate = inBucket.length > 0 ? mergedInBucket.length / inBucket.length : 0;
      return {
        label: bucket.label,
        total: inBucket.length,
        merged: mergedInBucket.length,
        mergeRate: Math.round(rate * 1000) / 10,
        lift: overallMergeRate > 0 ? Math.round((rate / overallMergeRate - 1) * 100) : 0,
      };
    });

    // Factor 4: Day of week
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayGroups = new Map<number, { total: number; merged: number }>();
    for (const pr of allPRs) {
      if (!pr.createdAt) continue;
      const day = new Date(pr.createdAt).getDay();
      const group = dayGroups.get(day) || { total: 0, merged: 0 };
      group.total++;
      if (pr.status === "merged") group.merged++;
      dayGroups.set(day, group);
    }

    const dayCorrelation = Array.from(dayGroups.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, stats]) => ({
        label: dayNames[day],
        total: stats.total,
        merged: stats.merged,
        mergeRate: stats.total > 0 ? Math.round((stats.merged / stats.total) * 1000) / 10 : 0,
        lift:
          overallMergeRate > 0 && stats.total > 0
            ? Math.round(((stats.merged / stats.total) / overallMergeRate - 1) * 100)
            : 0,
      }));

    // Generate insights
    const insights: string[] = [];

    // Best size
    const bestSize = sizeCorrelation
      .filter((s) => s.total >= 2)
      .sort((a, b) => b.mergeRate - a.mergeRate)[0];
    if (bestSize && bestSize.mergeRate > overallMergeRate * 100) {
      insights.push(
        `PRs with ${bestSize.label} have the highest merge rate at ${bestSize.mergeRate}% (+${bestSize.lift}% vs average)`
      );
    }

    // Best type
    const bestType = typeCorrelation.filter((t) => t.total >= 2)[0];
    if (bestType && bestType.mergeRate > 0) {
      insights.push(
        `"${bestType.label}" PRs merge at ${bestType.mergeRate}% — focus on this type`
      );
    }

    // Worst type
    const worstType = typeCorrelation
      .filter((t) => t.total >= 3)
      .sort((a, b) => a.mergeRate - b.mergeRate)[0];
    if (worstType && worstType.mergeRate === 0) {
      insights.push(
        `"${worstType.label}" PRs have 0% merge rate across ${worstType.total} attempts — consider avoiding`
      );
    }

    // Oversized penalty
    const oversized = sizeCorrelation.filter((s) => s.label.includes("500+") || s.label.includes("201-500"));
    const oversizedTotal = oversized.reduce((s, b) => s + b.total, 0);
    if (oversizedTotal > total * 0.2) {
      insights.push(
        `${Math.round((oversizedTotal / total) * 100)}% of PRs are over 200 lines — this is killing merge rate`
      );
    }

    return NextResponse.json({
      overallMergeRate: Math.round(overallMergeRate * 1000) / 10,
      factors: [
        { name: "Diff Size", data: sizeCorrelation },
        { name: "PR Type", data: typeCorrelation },
        { name: "Files Changed", data: filesCorrelation },
        { name: "Day of Week", data: dayCorrelation },
      ],
      insights,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute correlations", details: String(error) },
      { status: 500 }
    );
  }
}
