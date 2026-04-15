export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

export async function GET() {
  const results: Record<string, unknown> = {
    TURSO_DATABASE_URL_SET: !!process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN_SET: !!process.env.TURSO_AUTH_TOKEN,
    VERCEL: !!process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Determine which URL we'd use
  let dbUrl = "file:local.db";
  if (process.env.TURSO_DATABASE_URL) {
    dbUrl = process.env.TURSO_DATABASE_URL;
    results.dbUrlType = "turso-remote";
    // Redact credentials
    results.dbUrlPreview = dbUrl.replace(/\/\/[^@]+@/, "//***@");
  } else if (process.env.VERCEL) {
    dbUrl = "file:/tmp/clawoss.db";
    results.dbUrlType = "vercel-tmp-fallback";
  } else {
    results.dbUrlType = "local-file";
  }

  // Try raw libsql client
  try {
    const client = createClient({
      url: dbUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Test 1: simple execute
    await client.execute("SELECT 1 as test");
    results.rawClientWorks = true;

    // Test 2: create table
    await client.execute(
      "CREATE TABLE IF NOT EXISTS _db_check (id TEXT PRIMARY KEY)"
    );
    results.createTableWorks = true;

    // Test 3: select from it
    const rows = await client.execute("SELECT * FROM _db_check LIMIT 1");
    results.selectWorks = true;
    results.rowCount = rows.rows.length;

    // Test 4: check if heartbeats table exists
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    results.tables = tables.rows.map((r) => r.name);

    // Cleanup
    await client.execute("DROP TABLE IF EXISTS _db_check");
  } catch (error: unknown) {
    results.rawClientWorks = false;
    results.error = String(error);
    results.errorStack =
      error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined;
  }

  return NextResponse.json(results);
}
