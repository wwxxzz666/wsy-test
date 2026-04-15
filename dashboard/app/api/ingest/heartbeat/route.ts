export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb, pruneOldData } from "@/lib/db";
import { heartbeats } from "@/lib/schema";
import { nanoid } from "nanoid";
import { syncPRsFromGitHub } from "@/lib/github";

let _lastPrune = 0;
let _lastSync = 0;

const VALID_STATUSES = ["alive", "degraded", "offline"] as const;

export async function POST(request: Request) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    await ensureDb();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const status = (body.status as string) || "alive";
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const id = nanoid();

    await db.insert(heartbeats).values({
      id,
      timestamp: new Date(),
      status: status as "alive" | "degraded" | "offline",
      currentTask: typeof body.currentTask === "string" ? body.currentTask : null,
      uptimeSeconds: typeof body.uptimeSeconds === "number" ? body.uptimeSeconds : 0,
      metadata: body.metadata || null,
    });

    // Data retention: prune old rows at most once per hour
    const now = Date.now();
    if (now - _lastPrune > 3600_000) {
      _lastPrune = now;
      pruneOldData().catch((err) =>
        console.error("[heartbeat] Prune error:", err)
      );
    }

    // GitHub PR sync: sync PRs at most once every 5 minutes
    if (now - _lastSync > 300_000) {
      _lastSync = now;
      syncPRsFromGitHub().catch((err) =>
        console.error("[heartbeat] GitHub sync error:", err)
      );
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[heartbeat] Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to process heartbeat", details: String(error) },
      { status: 500 }
    );
  }
}
