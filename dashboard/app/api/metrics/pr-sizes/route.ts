export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";

/**
 * GET /api/metrics/pr-sizes
 *
 * Returns PR size distribution data for a histogram view.
 * Buckets PRs by total lines changed (additions + deletions).
 * Highlights the 25-100 line "sweet spot" zone.
 *
 * Research: 50-line PRs merge 40% faster, 15% less likely to be reverted.
 * Sweet spot: 25-100 lines. Ideal: ~50 lines.
 */

const BUCKETS = [
  { min: 0, max: 10, label: "1-10" },
  { min: 11, max: 25, label: "11-25" },
  { min: 26, max: 50, label: "26-50" },
  { min: 51, max: 100, label: "51-100" },
  { min: 101, max: 200, label: "101-200" },
  { min: 201, max: 500, label: "201-500" },
  { min: 501, max: 1000, label: "501-1K" },
  { min: 1001, max: Infinity, label: "1K+" },
];

// Sweet spot: 25-100 lines (bucket indices 2 and 3)
const SWEET_SPOT_MIN = 25;
const SWEET_SPOT_MAX = 100;
const IDEAL_SIZE = 50;

export async function GET() {
  try {
    await ensureDb();

    const allPRs = await db
      .select({
        id: pullRequests.id,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        status: pullRequests.status,
      })
      .from(pullRequests);

    // Build bucket counts with merge rates
    const bucketData = BUCKETS.map((b) => ({
      ...b,
      total: 0,
      merged: 0,
      closed: 0,
      open: 0,
      inSweetSpot: b.min >= SWEET_SPOT_MIN && b.max <= SWEET_SPOT_MAX,
    }));

    let sweetSpotCount = 0;
    let sweetSpotMerged = 0;
    let outsideCount = 0;
    let outsideMerged = 0;
    let totalSize = 0;

    for (const pr of allPRs) {
      const size = (pr.additions ?? 0) + (pr.deletions ?? 0);
      totalSize += size;
      const inSweet = size >= SWEET_SPOT_MIN && size <= SWEET_SPOT_MAX;

      if (inSweet) {
        sweetSpotCount++;
        if (pr.status === "merged") sweetSpotMerged++;
      } else {
        outsideCount++;
        if (pr.status === "merged") outsideMerged++;
      }

      for (const bucket of bucketData) {
        if (size >= bucket.min && size <= bucket.max) {
          bucket.total++;
          if (pr.status === "merged") bucket.merged++;
          else if (pr.status === "closed") bucket.closed++;
          else bucket.open++;
          break;
        }
      }
    }

    const totalPRs = allPRs.length;
    const avgSize = totalPRs > 0 ? Math.round(totalSize / totalPRs) : 0;
    const medianSize = (() => {
      if (totalPRs === 0) return 0;
      const sizes = allPRs
        .map((pr) => (pr.additions ?? 0) + (pr.deletions ?? 0))
        .sort((a, b) => a - b);
      const mid = Math.floor(sizes.length / 2);
      return sizes.length % 2 === 0
        ? Math.round((sizes[mid - 1] + sizes[mid]) / 2)
        : sizes[mid];
    })();

    const sweetSpotRatio =
      totalPRs > 0
        ? Math.round((sweetSpotCount / totalPRs) * 1000) / 10
        : 0;
    const sweetSpotMergeRate =
      sweetSpotCount > 0
        ? Math.round((sweetSpotMerged / sweetSpotCount) * 1000) / 10
        : 0;
    const outsideMergeRate =
      outsideCount > 0
        ? Math.round((outsideMerged / outsideCount) * 1000) / 10
        : 0;

    return NextResponse.json({
      buckets: bucketData.map((b) => ({
        label: b.label,
        min: b.min,
        max: b.max === Infinity ? null : b.max,
        total: b.total,
        merged: b.merged,
        closed: b.closed,
        open: b.open,
        mergeRate:
          b.total > 0
            ? Math.round((b.merged / b.total) * 1000) / 10
            : 0,
        inSweetSpot: b.inSweetSpot,
      })),
      summary: {
        totalPRs,
        avgSize,
        medianSize,
        idealSize: IDEAL_SIZE,
        sweetSpotRange: { min: SWEET_SPOT_MIN, max: SWEET_SPOT_MAX },
        sweetSpotCount,
        sweetSpotRatio,
        sweetSpotMergeRate,
        outsideMergeRate,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute PR sizes", details: String(error) },
      { status: 500 }
    );
  }
}
