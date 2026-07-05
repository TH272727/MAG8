import { NextRequest, NextResponse } from "next/server";
import { getRunSnapshot } from "@/lib/db";
import { toPublicSnapshot } from "@/lib/public-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const snapshot = getRunSnapshot(runId);
  if (!snapshot) {
    return NextResponse.json({ code: "not_found", error: "run not found" }, { status: 404 });
  }
  // Public-view boundary: snapshot JSON is devtools-visible.
  return NextResponse.json(toPublicSnapshot(snapshot));
}
