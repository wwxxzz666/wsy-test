export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { agentLogs } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export interface DirectiveEntry {
  id: string;
  timestamp: string;
  message: string;
  directives: string[];
  stats: { total: number; merged: number; open: number; closed: number } | null;
}

/**
 * GET /api/metrics/directives
 *
 * Returns the last N directive log entries for the directives panel.
 * Directives are logged by the health-check endpoint with source='directive'.
 */
export async function GET(request: Request) {
  try {
    await ensureDb();
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

    const rows = await db
      .select()
      .from(agentLogs)
      .where(eq(agentLogs.source, "directive"))
      .orderBy(desc(agentLogs.timestamp))
      .limit(limit);

    const entries: DirectiveEntry[] = rows.map((row) => {
      let directives: string[] = [];
      let stats: DirectiveEntry["stats"] = null;
      try {
        const meta = typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata;
        if (meta && Array.isArray(meta.directives)) {
          directives = meta.directives;
        }
        if (meta && meta.stats) {
          stats = meta.stats;
        }
      } catch {
        // metadata parse failure — use message as single directive
        directives = [row.message];
      }

      return {
        id: row.id,
        timestamp: row.timestamp ? row.timestamp.toISOString() : new Date().toISOString(),
        message: row.message,
        directives,
        stats,
      };
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch directives", details: String(error) },
      { status: 500 }
    );
  }
}
