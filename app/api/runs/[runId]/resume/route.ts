import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { CONFIG, launchMode } from "@/lib/config";
import { resumeRun } from "@/lib/run-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finish a run that stopped mid-flight, in place (same run id, same cohort —
 * only the unfinished lens cells and the compile run). Admin-gated exactly like
 * POST /api/runs, and dark behind the launch curtain like every run route.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  if (launchMode()) {
    return NextResponse.json({ code: "not_found", error: "not found" }, { status: 404 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { code: "unauthorized", error: "Admin token required — unlock via /admin or send x-admin-token." },
      { status: 401 },
    );
  }
  // A resume is always live work: there is no mock path to fall back on.
  if (CONFIG.authMode() === "none") {
    return NextResponse.json(
      {
        code: "no_auth",
        error:
          "Research credentials are not configured on this server, so live runs are disabled. The operator can configure them from the admin desk setup notes and restart the server.",
      },
      { status: 503 },
    );
  }

  const { runId } = await ctx.params;
  const result = resumeRun(decodeURIComponent(runId));
  if (result.ok) {
    return NextResponse.json({ runId: result.runId }, { status: 202 });
  }
  if (result.code === "active_run") {
    return NextResponse.json(
      {
        code: "active_run",
        error: "A run is already in progress — Mag8 runs one pipeline at a time.",
        activeRunId: result.activeRunId,
      },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { code: result.code, error: result.error },
    { status: result.code === "not_found" ? 404 : 400 },
  );
}
