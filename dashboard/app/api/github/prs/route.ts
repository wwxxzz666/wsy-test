export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests } from "@/lib/schema";
import { desc, asc, eq, gte, like, and, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const repo = url.searchParams.get("repo") || "all";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const sort = url.searchParams.get("sort") || "created";
    const order = url.searchParams.get("order") || "desc";
    const minQuality = parseFloat(url.searchParams.get("minQuality") || "0");
    const search = url.searchParams.get("search") || "";

    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(pullRequests.status, status as "open" | "merged" | "closed"));
    }
    if (repo !== "all") {
      conditions.push(eq(pullRequests.repo, repo));
    }
    if (minQuality > 0) {
      conditions.push(gte(pullRequests.qualityScore, minQuality));
    }
    if (search) {
      conditions.push(like(pullRequests.title, `%${search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn =
      sort === "quality" ? pullRequests.qualityScore : pullRequests.createdAt;
    const orderFn = order === "asc" ? asc : desc;

    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(pullRequests)
        .where(where)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(pullRequests)
        .where(where),
    ]);

    const total = countResult[0]?.count || 0;

    return NextResponse.json({
      data,
      total,
      page,
      pageSize: limit,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch PRs", details: String(error) },
      { status: 500 }
    );
  }
}
