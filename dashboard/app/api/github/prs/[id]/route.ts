export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { pullRequests, prReviews, qualityScores } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDb();
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    const pr = await db.query.pullRequests.findFirst({
      where: eq(pullRequests.id, decodedId),
    });

    if (!pr) {
      return NextResponse.json({ error: "PR not found" }, { status: 404 });
    }

    const reviews = await db
      .select()
      .from(prReviews)
      .where(eq(prReviews.prId, decodedId));

    const quality = await db.query.qualityScores.findFirst({
      where: eq(qualityScores.prId, decodedId),
    });

    return NextResponse.json({
      ...pr,
      reviews,
      qualityBreakdown: quality || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch PR", details: String(error) },
      { status: 500 }
    );
  }
}
