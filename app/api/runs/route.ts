import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorized } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { startRun } from "@/lib/run-manager";
import type { RunParams } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  count: z.number().int().min(CONFIG.candidates.min).max(CONFIG.candidates.max).optional(),
  force: z.boolean().optional(),
  mock: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { code: "unauthorized", error: "Admin token required — unlock via /admin or send x-admin-token." },
      { status: 401 },
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body → defaults
  }
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ code: "bad_request", error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const params: RunParams = {
    count: parsed.data.count ?? CONFIG.candidates.default,
    force: parsed.data.force ?? false,
    mock: parsed.data.mock ?? false,
  };

  if (params.mock && !CONFIG.allowMock()) {
    return NextResponse.json(
      { code: "mock_dev_only", error: "Mock runs are available in development only (set MAG8_ALLOW_MOCK=1 to enable them on a demo deployment)." },
      { status: 400 },
    );
  }
  if (!params.mock && !CONFIG.hasApiKey()) {
    return NextResponse.json(
      {
        code: "no_api_key",
        error:
          "ANTHROPIC_API_KEY is not set. Real pipeline runs require it — add it to .env.local and restart the server. Mock runs remain available in development.",
      },
      { status: 503 },
    );
  }

  const result = startRun(params);
  if (!result.ok) {
    return NextResponse.json(
      { code: "active_run", error: "A run is already in progress — Mag8 runs one pipeline at a time.", activeRunId: result.activeRunId },
      { status: 409 },
    );
  }
  return NextResponse.json({ runId: result.runId }, { status: 202 });
}
