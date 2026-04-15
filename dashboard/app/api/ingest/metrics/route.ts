export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { metricsTokens } from "@/lib/schema";
import { nanoid } from "nanoid";
import { computeTokenCost } from "@/lib/cost-models";

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

    // Accept either { metrics: [...] } or a single metric object
    let metrics: Record<string, unknown>[];
    if (Array.isArray(body.metrics)) {
      metrics = body.metrics as Record<string, unknown>[];
    } else if (body.inputTokens !== undefined || body.outputTokens !== undefined) {
      // Single metric object sent directly
      metrics = [body];
    } else if (body.metrics && !Array.isArray(body.metrics)) {
      return NextResponse.json(
        { error: "metrics must be an array" },
        { status: 400 }
      );
    } else {
      metrics = [];
    }

    for (const metric of metrics) {
      const inputTokens = (metric.inputTokens as number) || 0;
      const outputTokens = (metric.outputTokens as number) || 0;
      const rawCost = metric.costUsd as number | null | undefined;
      const model = (metric.model as string) || null;

      // Auto-compute cost from model table/default env config if not provided
      const costUsd =
        rawCost != null && rawCost > 0
          ? rawCost
          : computeTokenCost(inputTokens, outputTokens, model ?? undefined);

      await db.insert(metricsTokens).values({
        id: nanoid(),
        timestamp: new Date(),
        channel: (metric.channel as string) || null,
        provider: (metric.provider as string) || null,
        model,
        inputTokens,
        outputTokens,
        costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
        runDurationMs: (metric.runDurationMs as number) || null,
        contextTokens: (metric.contextTokens as number) || null,
      });
    }

    return NextResponse.json({ ok: true, count: metrics.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to ingest metrics", details: String(error) },
      { status: 500 }
    );
  }
}
