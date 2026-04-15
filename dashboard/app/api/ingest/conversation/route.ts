export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { conversationMessages } from "@/lib/schema";
import { nanoid } from "nanoid";

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

    // Accept either { messages: [...] } or a single message
    let messages: Record<string, unknown>[];
    if (Array.isArray(body.messages)) {
      messages = body.messages as Record<string, unknown>[];
    } else if (body.role && body.content !== undefined) {
      messages = [body];
    } else {
      return NextResponse.json(
        { error: "Must provide 'messages' array or a single message with 'role' and 'content'" },
        { status: 400 }
      );
    }

    const ids: string[] = [];
    for (const msg of messages) {
      const id = (msg.id as string) || nanoid();
      const role = msg.role as string;
      if (!["user", "assistant", "tool_call", "tool_result", "system", "thinking"].includes(role)) {
        continue;
      }

      await db.insert(conversationMessages).values({
        id,
        sessionId: (msg.sessionId as string) || (msg.session_id as string) || "default",
        timestamp: msg.timestamp ? new Date(msg.timestamp as string) : new Date(),
        role: role as "user" | "assistant" | "tool_call" | "tool_result" | "system" | "thinking",
        content: String(msg.content || ""),
        toolName: (msg.toolName as string) || (msg.tool_name as string) || null,
        toolCallId: (msg.toolCallId as string) || (msg.tool_call_id as string) || null,
        durationMs: (msg.durationMs as number) || (msg.duration_ms as number) || null,
        tokenCount: (msg.tokenCount as number) || (msg.token_count as number) || null,
        metadata: msg.metadata || null,
      });
      ids.push(id);
    }

    return NextResponse.json({ ok: true, count: ids.length, ids });
  } catch (error) {
    console.error("[conversation] Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest conversation", details: String(error) },
      { status: 500 }
    );
  }
}
