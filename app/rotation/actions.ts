"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { refreshBars } from "@/lib/rotation/board";
import { saveRotationDiff } from "@/lib/rotation-settings";

/* ============================================================================
 * Server actions for the Rotation Board.
 *
 * Two different gates, and they are not the same gate:
 *
 *   the pre-launch curtain applies to EVERY action here, and an admin token
 *   does not bypass it — flip the site to full mode to operate;
 *
 *   the admin token additionally applies to anything that spends time, writes,
 *   or changes what every visitor sees: refreshing prices and saving settings.
 *
 * Reading the board needs neither, because it is a pure function of data that
 * is already stored and the pages call it directly.
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
export async function rotationUnlockedAction(): Promise<boolean> {
  return adminAuthorized();
}

/**
 * Fetch every catalog ticker and store its closes.
 *
 * Reports the transport reason rather than a count when nothing could be read:
 * "0 of 31" reads like a market fact, and a dead network is not one. A refresh
 * in which nothing was read stores nothing, so the previous board survives it.
 */
export async function refreshRotationAction(): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const report = await refreshBars();
    if (report.disabled) {
      return { ok: false, message: "The board is switched off by MAG8_ROTATION=0." };
    }
    if (report.readNothing) {
      const why = report.tickers.find((t) => t.note)?.note ?? "no source answered";
      return {
        ok: false,
        message: `Nothing could be read, so the stored prices are unchanged. The source reported: ${why}`,
      };
    }
    const parts = [`${report.ok} of ${report.tickers.length} tickers refreshed`];
    if (report.failed > 0) parts.push(`${report.failed} unchanged after a failed fetch`);
    if (report.thin > 0) parts.push(`${report.thin} returned too little history to trust`);
    const rebased = report.tickers.filter((t) => t.rebased).length;
    if (rebased > 0) parts.push(`${rebased} rebuilt on a new price basis`);
    return { ok: true, message: `${parts.join(" · ")}.` };
  } catch (err) {
    // A raw transport message must never reach a client payload.
    return {
      ok: false,
      message: err instanceof Error ? `The refresh could not complete: ${err.message}` : "The refresh could not complete.",
    };
  }
}

/** Persist only what differs from the default-and-environment baseline. */
export async function saveRotationSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const { count } = saveRotationDiff(input);
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
