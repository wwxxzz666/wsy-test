export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { metricsTokens } from "@/lib/schema";
import { gte, desc } from "drizzle-orm";
import { format, subWeeks, subMonths } from "date-fns";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "week";

    let since: Date;
    switch (range) {
      case "month":
        since = subMonths(new Date(), 1);
        break;
      case "3months":
        since = subMonths(new Date(), 3);
        break;
      default:
        since = subWeeks(new Date(), 1);
    }

    const metrics = await db
      .select()
      .from(metricsTokens)
      .where(gte(metricsTokens.timestamp, since))
      .orderBy(desc(metricsTokens.timestamp));

    const grouped = new Map<string, number>();
    for (const m of metrics) {
      const key = format(m.timestamp, "yyyy-MM-dd");
      grouped.set(key, (grouped.get(key) || 0) + (m.costUsd || 0));
    }

    let cumulative = 0;
    const data = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, dailyCost]) => {
        cumulative += dailyCost;
        return {
          date,
          dailyCost: Math.round(dailyCost * 100) / 100,
          cumulativeCost: Math.round(cumulative * 100) / 100,
        };
      });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch cost metrics", details: String(error) },
      { status: 500 }
    );
  }
}
