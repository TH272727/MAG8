"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { refreshScan } from "@/lib/insider/scanner";
import { saveInsiderDiff } from "@/lib/insider-settings";

/* ============================================================================
 * Server actions for the Insider Turnaround Scanner.
 *
 * Two different gates, and they are not the same gate:
 *
 *   the pre-launch curtain applies to EVERY action here, and an admin token
 *   does not bypass it — flip the site to full mode to operate;
 *
 *   the admin token additionally applies to anything that spends time, writes,
 *   or changes what every visitor sees: refreshing filings and saving settings.
 *
 * Reading the board needs neither. It is a pure function of data already
 * stored, which is also why a visitor can change the risk tolerance without
 * anything being fetched or written on their behalf.
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
export async function insiderUnlockedAction(): Promise<boolean> {
  return adminAuthorized();
}

/**
 * Walk the filings and work up the companies whose buying is most convincing.
 *
 * Reports the transport reason rather than a count when nothing could be read:
 * "no companies" reads like a market fact, and a dead network is not one. A
 * refresh in which nothing was read stores nothing, so the previous scan
 * survives it.
 */
export async function refreshInsiderAction(days?: number): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const scan = await refreshScan({
      lookbackDays: Number.isFinite(days) && (days ?? 0) > 0 ? days : undefined,
    });
    if (scan.disabled) {
      return { ok: false, message: "The scanner is switched off by MAG8_INSIDER=0." };
    }
    if (scan.readNothing) {
      const why = scan.notes[0] ?? scan.ingest.notes[0] ?? "no source answered";
      return {
        ok: false,
        message: `Nothing could be read, so everything stored is unchanged. The source reported: ${why}`,
      };
    }

    const i = scan.ingest;
    const parts = [
      `${i.daysRead} new day${i.daysRead === 1 ? "" : "s"} of filings read`,
      `${i.filingsRead} filing${i.filingsRead === 1 ? "" : "s"} from screened companies`,
      `${i.buyLines} open-market purchase${i.buyLines === 1 ? "" : "s"}`,
      `${scan.workedUp} compan${scan.workedUp === 1 ? "y" : "ies"} worked up`,
    ];
    if (i.daysFailed > 0) parts.push(`${i.daysFailed} day(s) could not be read and will be retried`);
    const noStatements = scan.outcomes.filter((o) => !o.financialsOk).length;
    if (noStatements > 0) parts.push(`${noStatements} without readable statements`);

    return { ok: true, message: `${parts.join(" · ")}.` };
  } catch (err) {
    // A raw transport message must never reach a client payload.
    return {
      ok: false,
      message:
        err instanceof Error ? `The refresh could not complete: ${err.message}` : "The refresh could not complete.",
    };
  }
}

/** Persist only what differs from the default-and-environment baseline. */
export async function saveInsiderSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const { count } = saveInsiderDiff(input);
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
