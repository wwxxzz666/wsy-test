export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { agentLogs } from "@/lib/schema";
import { nanoid } from "nanoid";

const VALID_LEVELS = ["debug", "info", "warn", "error"] as const;

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

    const entries = body.entries;
    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: "entries must be an array" },
        { status: 400 }
      );
    }

    let ingested = 0;
    const errors: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry || typeof entry !== "object") {
        errors.push(`Entry ${i}: must be an object`);
        continue;
      }
      if (!entry.message || typeof entry.message !== "string") {
        errors.push(`Entry ${i}: message is required and must be a string`);
        continue;
      }

      const level = (entry.level as string) || "info";
      if (!VALID_LEVELS.includes(level as (typeof VALID_LEVELS)[number])) {
        errors.push(`Entry ${i}: invalid level "${level}"`);
        continue;
      }

      await db.insert(agentLogs).values({
        id: nanoid(),
        timestamp: entry.timestamp ? new Date(entry.timestamp as string) : new Date(),
        level: level as "debug" | "info" | "warn" | "error",
        source: typeof entry.source === "string" ? entry.source : null,
        message: entry.message as string,
        metadata: entry.metadata || null,
      });
      ingested++;
    }

    return NextResponse.json({
      ok: true,
      count: ingested,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error("[logs] Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest logs", details: String(error) },
      { status: 500 }
    );
  }
}
