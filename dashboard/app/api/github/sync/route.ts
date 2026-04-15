export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { syncPRsFromGitHub } from "@/lib/github";

export async function GET() {
  try {
    const result = await syncPRsFromGitHub();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "GitHub sync failed", details: String(error) },
      { status: 500 }
    );
  }
}
