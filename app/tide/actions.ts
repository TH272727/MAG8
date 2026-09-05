"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { refreshTide } from "@/lib/tide/desk";
import { saveTideDiff } from "@/lib/tide-settings";

/* ============================================================================
 * Server actions for The Tide.
 *
 * Two different gates, and they are not the same gate:
 *
 *   the pre-launch curtain applies to EVERY action here, and an admin token
 *   does not bypass it — flip the site to full mode to operate;
 *
 *   the admin token additionally applies to anything that spends time, writes,
 *   or changes what every visitor sees: refreshing the sources and saving the
 *   weights.
 *
 * Reading the desk needs neither, because it is a pure function of data that is
 * already stored and the pages call it directly. That is also what makes the
 * weights safe to expose: a visitor changing nothing still gets a fully
 * re-derived desk, and an operator changing a weight changes what everyone
 * sees, which is why only the second is gated.
 * ========================================================================== */

export interface ActionState {
  ok: boolean;
  message: string;
}

async function adminAuthorized(): Promise<boolean> {
  if (launchMode()) return false;
  return tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
}

/** Decided on the server, never inferred on the client. */
export async function tideUnlockedAction(): Promise<boolean> {
  return adminAuthorized();
}

/**
 * Re-read every source and recount breadth.
 *
 * Reports the transport reason rather than a count when nothing could be read:
 * "0 of 37" reads like a market fact, and a dead network is not one. A refresh
 * in which nothing was read stores nothing, so the previous reading survives
 * it — blanking a working desk with an empty fetch is a mistake this codebase
 * has already made once.
 */
export async function refreshTideAction(): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const report = await refreshTide();
    if (report.disabled) {
      return { ok: false, message: "The desk is switched off by MAG8_TIDE=0." };
    }
    if (report.readNothing) {
      const why = report.series.find((s) => s.note && !s.ok)?.note ?? "no source answered";
      return {
        ok: false,
        message: `Nothing could be read, so the stored readings are unchanged. The source reported: ${why}`,
      };
    }
    const breadth = report.breadth;
    const breadthNote = !breadth
      ? ""
      : breadth.skipped
        ? ` Breadth was not counted: ${breadth.note}.`
        : ` Breadth counted ${breadth.ok} of ${breadth.requested} companies.`;
    const failed = report.failed > 0 ? `, ${report.failed} could not be read` : "";
    return {
      ok: true,
      message:
        `Read ${report.ok} series${failed}. ${report.stored.toLocaleString()} observations stored.` + breadthNote,
    };
  } catch (err) {
    return {
      ok: false,
      message: `The refresh could not complete: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

/** Persist only what differs from the default-and-environment baseline. */
export async function saveTideSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const { count } = saveTideDiff(input);
    return {
      ok: true,
      message:
        count === 0
          ? "Saved — every value is back at its default, so nothing is stored as an override."
          : `Saved — ${count} setting${count === 1 ? "" : "s"} now differ${count === 1 ? "s" : ""} from the default.`,
    };
  } catch {
    return { ok: false, message: "The settings could not be saved." };
  }
}
