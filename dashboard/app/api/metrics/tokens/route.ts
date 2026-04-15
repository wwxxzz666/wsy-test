export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { metricsTokens } from "@/lib/schema";
import { gte, desc } from "drizzle-orm";
import { format, subDays, subWeeks, subMonths } from "date-fns";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "week";

    let since: Date;
    switch (range) {
      case "day":
        since = subDays(new Date(), 1);
        break;
      case "month":
        since = subMonths(new Date(), 1);
        break;
      default:
        since = subWeeks(new Date(), 1);
    }

    const metrics = await db
      .select()
      .from(metricsTokens)
      .where(gte(metricsTokens.timestamp, since))
      .orderBy(desc(metricsTokens.timestamp));

    // Group by day
    const grouped = new Map<string, { inputTokens: number; outputTokens: number }>();
    for (const m of metrics) {
      const key = format(m.timestamp, "yyyy-MM-dd");
      const existing = grouped.get(key) || { inputTokens: 0, outputTokens: 0 };
      existing.inputTokens += m.inputTokens || 0;
      existing.outputTokens += m.outputTokens || 0;
      grouped.set(key, existing);
    }

    const data = Array.from(grouped.entries()).map(([date, tokens]) => ({
      date,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
    }));

    data.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch token metrics", details: String(error) },
      { status: 500 }
    );
  }
}
