export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { DashboardSettings } from "@/lib/types";

const DEFAULT_SETTINGS: DashboardSettings = {
  targetRepos: [],
  agentPaused: false,
  heartbeatIntervalMinutes: 5,
  qualityThreshold: 70,
  autoMerge: false,
  requiredReviews: 1,
  notifications: {
    slackWebhookUrl: "",
    onError: true,
    onPRMerged: true,
    onPRRejected: true,
    onAgentOffline: true,
  },
  dailyBudgetUsd: 50,
};

export async function GET() {
  try {
    await ensureDb();
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "dashboard_settings"),
    });

    const currentSettings = row
      ? { ...DEFAULT_SETTINGS, ...(row.value as Partial<DashboardSettings>) }
      : DEFAULT_SETTINGS;

    return NextResponse.json(currentSettings);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch settings", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDb();
    const body = await request.json();

    // Get existing settings
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "dashboard_settings"),
    });

    const currentSettings = row
      ? { ...DEFAULT_SETTINGS, ...(row.value as Partial<DashboardSettings>) }
      : DEFAULT_SETTINGS;

    const updatedSettings = { ...currentSettings, ...body };

    await db
      .insert(settings)
      .values({
        key: "dashboard_settings",
        value: updatedSettings,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: updatedSettings,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true, settings: updatedSettings });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update settings", details: String(error) },
      { status: 500 }
    );
  }
}
