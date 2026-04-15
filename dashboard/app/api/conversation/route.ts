export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { conversationMessages } from "@/lib/schema";
import { desc, eq, gte, sql, and, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const after = searchParams.get("after") || searchParams.get("since"); // ISO timestamp for incremental polling
    const sessionsOnly = searchParams.get("sessions") === "true";
    const repo = searchParams.get("repo");
    const issue = searchParams.get("issue");

    // Return list of sessions with message counts
    if (sessionsOnly) {
      const sessions = await db
        .select({
          sessionId: conversationMessages.sessionId,
          firstMessage: sql<number>`MIN(timestamp)`,
          lastMessage: sql<number>`MAX(timestamp)`,
          messageCount: sql<number>`COUNT(*)`,
          // Extract repo/issue/subagent info from metadata
          repo: sql<string | null>`MAX(json_extract(metadata, '$.repo'))`,
          issue: sql<string | null>`MAX(json_extract(metadata, '$.issue'))`,
          event: sql<string | null>`MAX(json_extract(metadata, '$.event'))`,
          label: sql<string | null>`MAX(json_extract(metadata, '$.label'))`,
          isSubagentMeta: sql<number>`MAX(CASE WHEN json_extract(metadata, '$.isSubagent') = 1 THEN 1 ELSE 0 END)`,
        })
        .from(conversationMessages)
        .groupBy(conversationMessages.sessionId)
        .orderBy(sql`MAX(timestamp) DESC`)
        .limit(20);

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return NextResponse.json({
        sessions: sessions.map((s) => ({
          sessionId: s.sessionId,
          firstMessage: new Date(s.firstMessage * 1000).toISOString(),
          lastMessage: new Date(s.lastMessage * 1000).toISOString(),
          messageCount: s.messageCount,
          isActive: s.lastMessage * 1000 > fiveMinutesAgo,
          repo: s.repo || null,
          issue: s.issue || null,
          label: s.label || null,
          isSubagent: s.isSubagentMeta === 1 || s.sessionId.includes("subagent:"),
        })),
      });
    }

    // Build query conditions
    const conditions = [];
    if (sessionId) {
      conditions.push(eq(conversationMessages.sessionId, sessionId));
    }
    if (after) {
      conditions.push(gte(conversationMessages.timestamp, new Date(after)));
    }
    // Filter by repo/issue in metadata JSON (for sub-agent conversations)
    if (repo) {
      conditions.push(
        sql`json_extract(${conversationMessages.metadata}, '$.repo') = ${repo}`
      );
    }
    if (issue) {
      conditions.push(
        sql`json_extract(${conversationMessages.metadata}, '$.issue') = ${issue}`
      );
    }

    const messages = await db
      .select()
      .from(conversationMessages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(conversationMessages.timestamp))
      .limit(limit);

    // Return in chronological order for display
    messages.reverse();

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        timestamp: m.timestamp,
        role: m.role,
        content: m.content,
        toolName: m.toolName,
        toolCallId: m.toolCallId,
        durationMs: m.durationMs,
        tokenCount: m.tokenCount,
        metadata: m.metadata,
      })),
      count: messages.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch conversation", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    await ensureDb();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session parameter required" },
        { status: 400 }
      );
    }

    const result = await db
      .delete(conversationMessages)
      .where(eq(conversationMessages.sessionId, sessionId));

    return NextResponse.json({ ok: true, sessionId, deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete session", details: String(error) },
      { status: 500 }
    );
  }
}
