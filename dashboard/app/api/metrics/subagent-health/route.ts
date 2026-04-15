export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { agentState } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

const ALWAYS_ON_LABELS = ["scout", "pr-monitor", "pr-analyst"];
const TOTAL_SLOTS = 10;
const ALWAYS_ON_COUNT = 3;
const IMPL_SLOT_COUNT = TOTAL_SLOTS - ALWAYS_ON_COUNT;

interface SlotData {
  label: string;
  status: "ACTIVE" | "IDLE" | "STALE" | "DEAD";
  contextPct: number;
  ageMinutes: number;
  sessionKey?: string;
  repo?: string;
  issue?: string;
}

export async function GET() {
  try {
    await ensureDb();

    // Get latest agent_state row with currentSkill = "subagent-health"
    const rows = await db
      .select()
      .from(agentState)
      .where(eq(agentState.currentSkill, "subagent-health"))
      .orderBy(desc(agentState.timestamp))
      .limit(1);

    const row = rows[0];

    if (!row || !row.metadata) {
      // No data yet — return empty defaults
      const emptyAlwaysOn: SlotData[] = ALWAYS_ON_LABELS.map((label) => ({
        label,
        status: "DEAD" as const,
        contextPct: 0,
        ageMinutes: 0,
      }));
      const emptyImplSlots: null[] = Array.from(
        { length: IMPL_SLOT_COUNT },
        () => null
      );

      return NextResponse.json({
        alwaysOn: emptyAlwaysOn,
        implSlots: emptyImplSlots,
        totalActive: 0,
        totalSlots: TOTAL_SLOTS,
        lastUpdated: null,
      });
    }

    const meta = row.metadata as Record<string, unknown>;

    // Parse always-on slots
    const alwaysOnData = (meta.alwaysOn || {}) as Record<
      string,
      {
        status?: string;
        contextPct?: number;
        ageMinutes?: number;
        sessionKey?: string;
        repo?: string;
      }
    >;

    const alwaysOn: SlotData[] = ALWAYS_ON_LABELS.map((label) => {
      const camelKey = label.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const data = alwaysOnData[camelKey] || alwaysOnData[label] || {};
      return {
        label,
        status: (data.status as SlotData["status"]) || "DEAD",
        contextPct: data.contextPct ?? 0,
        ageMinutes: data.ageMinutes ?? 0,
        sessionKey: data.sessionKey,
        repo: data.repo,
      };
    });

    // Parse impl/followup slots
    const implSlotsData = (meta.implSlots || []) as Array<{
      label?: string;
      repo?: string;
      issue?: string;
      status?: string;
      contextPct?: number;
      ageMinutes?: number;
    } | null>;

    const implSlots: (SlotData | null)[] = Array.from(
      { length: IMPL_SLOT_COUNT },
      (_, i) => {
        const slot = implSlotsData[i];
        if (!slot) return null;
        return {
          label: slot.label || `impl-${i + 1}`,
          status: (slot.status as SlotData["status"]) || "ACTIVE",
          contextPct: slot.contextPct ?? 0,
          ageMinutes: slot.ageMinutes ?? 0,
          repo: slot.repo,
          issue: slot.issue,
        };
      }
    );

    // Count active
    const alwaysOnActive = alwaysOn.filter(
      (s) => s.status === "ACTIVE" || s.status === "IDLE"
    ).length;
    const implActive = implSlots.filter(
      (s) => s !== null && (s.status === "ACTIVE" || s.status === "IDLE")
    ).length;

    return NextResponse.json({
      alwaysOn,
      implSlots,
      totalActive: alwaysOnActive + implActive,
      totalSlots: TOTAL_SLOTS,
      lastUpdated: row.timestamp ? row.timestamp.toISOString() : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch subagent health", details: String(error) },
      { status: 500 }
    );
  }
}
