export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import {
  heartbeats,
  conversationMessages,
  agentLogs,
  metricsTokens,
  commandAudit,
  subagentRuns,
} from "@/lib/schema";
import { lt, sql } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * POST /api/maintenance/cleanup
 *
 * Deletes old data to prevent unbounded SQLite growth.
 * Retention policy:
 *   - heartbeats: 30 days
 *   - conversation_messages: 14 days
 *   - agent_logs: 7 days
 *   - metrics_tokens: 90 days
 *   - command_audit: 30 days
 *   - subagent_runs: 90 days
 *
 * Accepts optional JSON body to override defaults:
 *   { "heartbeatDays": 30, "conversationDays": 14, "logDays": 7, "metricsDays": 90, "auditDays": 30, "subagentRunDays": 90 }
 */
export async function POST(request: Request) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    await ensureDb();

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body or invalid JSON — use defaults
    }

    const heartbeatDays = (body.heartbeatDays as number) || 30;
    const conversationDays = (body.conversationDays as number) || 14;
    const logDays = (body.logDays as number) || 7;
    const metricsDays = (body.metricsDays as number) || 90;
    const auditDays = (body.auditDays as number) || 30;

    const now = new Date();

    // Count rows to be deleted before deleting (drizzle delete doesn't reliably return rowsAffected)
    const hbCutoff = subDays(now, heartbeatDays);
    const [hbCount] = await db.select({ count: sql<number>`count(*)` }).from(heartbeats).where(lt(heartbeats.timestamp, hbCutoff));
    await db.delete(heartbeats).where(lt(heartbeats.timestamp, hbCutoff));

    const convCutoff = subDays(now, conversationDays);
    const [convCount] = await db.select({ count: sql<number>`count(*)` }).from(conversationMessages).where(lt(conversationMessages.timestamp, convCutoff));
    await db.delete(conversationMessages).where(lt(conversationMessages.timestamp, convCutoff));

    const logCutoff = subDays(now, logDays);
    const [logCount] = await db.select({ count: sql<number>`count(*)` }).from(agentLogs).where(lt(agentLogs.timestamp, logCutoff));
    await db.delete(agentLogs).where(lt(agentLogs.timestamp, logCutoff));

    const metricsCutoff = subDays(now, metricsDays);
    const [metricsCount] = await db.select({ count: sql<number>`count(*)` }).from(metricsTokens).where(lt(metricsTokens.timestamp, metricsCutoff));
    await db.delete(metricsTokens).where(lt(metricsTokens.timestamp, metricsCutoff));

    const auditCutoff = subDays(now, auditDays);
    const [auditCount] = await db.select({ count: sql<number>`count(*)` }).from(commandAudit).where(lt(commandAudit.timestamp, auditCutoff));
    await db.delete(commandAudit).where(lt(commandAudit.timestamp, auditCutoff));

    const subagentRunDays = (body.subagentRunDays as number) || 90;
    const subagentCutoff = subDays(now, subagentRunDays);
    const [subagentCount] = await db.select({ count: sql<number>`count(*)` }).from(subagentRuns).where(lt(subagentRuns.startedAt, subagentCutoff));
    await db.delete(subagentRuns).where(lt(subagentRuns.startedAt, subagentCutoff));

    const details = {
      heartbeats: hbCount?.count ?? 0,
      conversationMessages: convCount?.count ?? 0,
      agentLogs: logCount?.count ?? 0,
      metricsTokens: metricsCount?.count ?? 0,
      commandAudit: auditCount?.count ?? 0,
      subagentRuns: subagentCount?.count ?? 0,
    };

    const totalDeleted = Object.values(details).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      totalDeleted,
      details,
      retentionPolicy: {
        heartbeatDays,
        conversationDays,
        logDays,
        metricsDays,
        auditDays,
        subagentRunDays,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 }
    );
  }
}
