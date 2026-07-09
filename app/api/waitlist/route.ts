import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, tokenMatches } from "@/lib/auth";
import { countSignups, listSignups } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only signup readout. Deliberately launch-EXEMPT (with the waitlist action,
// the only API alive behind the curtain) so signups are checkable from a phone
// against the live site. ?token= exists because phone browsers can't set headers;
// wrong/missing token → 404, not 401, so the endpoint stays invisible.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req) && !tokenMatches(req.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ code: "not_found", error: "not found" }, { status: 404 });
  }
  const count = countSignups();
  if (req.nextUrl.searchParams.get("count") === "1") {
    return NextResponse.json({ count });
  }
  return NextResponse.json({ count, signups: listSignups() });
}
