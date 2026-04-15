export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";
import { classifyPRType, type PRType } from "@/lib/pr-type";

/**
 * GET /api/metrics/pr-types
 *
 * Classifies all PRs by type (bug_fix, docs, typo, dep_update, test, dead_code, etc.)
 * and returns per-type merge rates and counts.
 * This enables measuring which PR types convert best.
 */
export async function GET() {
  try {
    await ensureDb();

    const allPRs = await db
      .select({
        id: pullRequests.id,
        title: pullRequests.title,
        body: pullRequests.body,
        status: pullRequests.status,
        additions: pullRequests.additions,
        deletions: pullRequests.deletions,
        prType: pullRequests.prType,
      })
      .from(pullRequests);

    // Classify each PR — prefer persisted prType, fall back to title heuristics
    const typeStats = new Map<
      PRType,
      { total: number; merged: number; closed: number; open: number; avgDiffSize: number; totalDiff: number }
    >();

    for (const pr of allPRs) {
      const prType = (pr.prType as PRType) || classifyPRType(pr.title, pr.body);
      const existing = typeStats.get(prType) || {
        total: 0,
        merged: 0,
        closed: 0,
        open: 0,
        avgDiffSize: 0,
        totalDiff: 0,
      };

      existing.total++;
      if (pr.status === "merged") existing.merged++;
      else if (pr.status === "closed") existing.closed++;
      else existing.open++;
      existing.totalDiff += (pr.additions ?? 0) + (pr.deletions ?? 0);

      typeStats.set(prType, existing);
    }

    // Build response array
    const types = [...typeStats.entries()]
      .map(([type, stats]) => ({
        type,
        total: stats.total,
        merged: stats.merged,
        closed: stats.closed,
        open: stats.open,
        mergeRate:
          stats.total > 0
            ? Math.round((stats.merged / stats.total) * 1000) / 10
            : 0,
        avgDiffSize:
          stats.total > 0 ? Math.round(stats.totalDiff / stats.total) : 0,
      }))
      .sort((a, b) => b.mergeRate - a.mergeRate || b.total - a.total);

    // Overall stats
    const totalPRs = allPRs.length;
    const totalMerged = allPRs.filter((p) => p.status === "merged").length;
    const overallMergeRate =
      totalPRs > 0
        ? Math.round((totalMerged / totalPRs) * 1000) / 10
        : 0;

    // Best performing type
    const bestType = types.find((t) => t.total >= 2 && t.mergeRate > 0) || null;

    // Tier 1: safest easy-wins (count toward 80% target)
    const tier1Types: PRType[] = ["docs", "typo"];
    const tier1Stats = types.filter((t) => tier1Types.includes(t.type as PRType));
    const tier1Total = tier1Stats.reduce((s, t) => s + t.total, 0);
    const tier1Merged = tier1Stats.reduce((s, t) => s + t.merged, 0);
    const tier1Ratio =
      totalPRs > 0
        ? Math.round((tier1Total / totalPRs) * 1000) / 10
        : 0;
    const tier1MergeRate =
      tier1Total > 0
        ? Math.round((tier1Merged / tier1Total) * 1000) / 10
        : 0;

    // Tier 2: tracked, moderate risk (test, dep_update)
    const tier2Types: PRType[] = ["test", "dep_update"];
    const tier2Stats = types.filter((t) => tier2Types.includes(t.type as PRType));
    const tier2Total = tier2Stats.reduce((s, t) => s + t.total, 0);
    const tier2Merged = tier2Stats.reduce((s, t) => s + t.merged, 0);
    const tier2MergeRate =
      tier2Total > 0
        ? Math.round((tier2Merged / tier2Total) * 1000) / 10
        : 0;

    // Tier 3: tracked, discouraged (dead_code)
    const tier3Types: PRType[] = ["dead_code"];
    const tier3Stats = types.filter((t) => tier3Types.includes(t.type as PRType));
    const tier3Total = tier3Stats.reduce((s, t) => s + t.total, 0);
    const tier3Merged = tier3Stats.reduce((s, t) => s + t.merged, 0);
    const tier3MergeRate =
      tier3Total > 0
        ? Math.round((tier3Merged / tier3Total) * 1000) / 10
        : 0;

    // Combined easy-win stats (all tiers, for backwards compat)
    const easyWinTotal = tier1Total + tier2Total + tier3Total;
    const easyWinMerged = tier1Merged + tier2Merged + tier3Merged;
    const easyWinRatio =
      totalPRs > 0
        ? Math.round((easyWinTotal / totalPRs) * 1000) / 10
        : 0;
    const easyWinMergeRate =
      easyWinTotal > 0
        ? Math.round((easyWinMerged / easyWinTotal) * 1000) / 10
        : 0;

    return NextResponse.json({
      types,
      summary: {
        totalPRs,
        totalMerged,
        overallMergeRate,
        bestType: bestType?.type || null,
        bestTypeMergeRate: bestType?.mergeRate || 0,
        // Tier 1 is the real target: docs + typo
        tier1Ratio,
        tier1MergeRate,
        tier1Total,
        tier1Merged,
        // Tier 2: test + dep_update (tracked, not in target)
        tier2MergeRate,
        tier2Total,
        tier2Merged,
        // Tier 3: dead_code (tracked, discouraged)
        tier3MergeRate,
        tier3Total,
        tier3Merged,
        // Combined easy-win (all tiers)
        easyWinRatio,
        easyWinMergeRate,
        easyWinTotal,
        easyWinMerged,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to classify PR types", details: String(error) },
      { status: 500 }
    );
  }
}
