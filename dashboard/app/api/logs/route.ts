export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { agentLogs } from "@/lib/schema";
import { desc, eq, gte, like, and, sql } from "drizzle-orm";
import { subDays } from "date-fns";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const level = url.searchParams.get("level") || "all";
    const source = url.searchParams.get("source") || "all";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const search = url.searchParams.get("search") || "";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const conditions = [];

    if (level !== "all") {
      conditions.push(eq(agentLogs.level, level as "debug" | "info" | "warn" | "error"));
    }
    if (source !== "all") {
      conditions.push(eq(agentLogs.source, source));
    }
    if (search) {
      conditions.push(like(agentLogs.message, `%${search}%`));
    }
    if (from) {
      conditions.push(gte(agentLogs.timestamp, new Date(from)));
    } else {
      // Default to last 7 days
      conditions.push(gte(agentLogs.timestamp, subDays(new Date(), 7)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * limit;

    const [entries, countResult] = await Promise.all([
      db
        .select()
        .from(agentLogs)
        .where(where)
        .orderBy(desc(agentLogs.timestamp))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(agentLogs)
        .where(where),
    ]);

    return NextResponse.json({
      entries,
      total: countResult[0]?.count || 0,
      page,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch logs", details: String(error) },
      { status: 500 }
    );
  }
}
