"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { saveRiskDiff } from "@/lib/risk-settings";
import { refreshRisk } from "@/lib/risk/desk";

/* ============================================================================
 * Server actions for the Risk Desk.
 *
 * The same two gates as every other desk, and they are not the same gate: the
 * pre-launch curtain applies to everything here and an admin token does not
 * bypass it, while the token additionally gates anything that reaches the
 * network or changes what every visitor sees.
 *
 * Note what is NOT here, and will not be: nothing that places, proposes or
 * sizes a trade, and nothing that talks to a broker. This desk reports and it
 * flags. There is no action for it to take.
 * ========================================================================== */

export interface ActionState {
  ok: boolean;
  message: string;
}

async function adminAuthorized(): Promise<boolean> {
  if (launchMode()) return false;
  return tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
}

/**
 * Pull fresh closes for every company the desks have named.
 *
 * The report distinguishes what was fetched from what was already held by
 * another desk, because the second number is the interesting one: most of this
 * desk's population is priced already, and a refresh that reuses ten of
 * fourteen series did not fail to do its job.
 *
 * A refresh in which NOTHING could be read stores nothing and says so. A
 * transport outage that blanked a desk has happened here before, and "0 of 14"
 * reads like a fact about the market rather than about the network.
 */
export async function refreshRiskAction(): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const report = await refreshRisk();
    if (report.disabled) {
      return { ok: false, message: "The risk desk is switched off, so nothing was read." };
    }
    if (report.readNothing) {
      const reason = report.tickers.find((t) => t.note)?.note;
      return {
        ok: false,
        message: reason
          ? `Nothing could be read, so stored prices are untouched: ${reason}`
          : "Nothing could be read, so stored prices are untouched.",
      };
    }
    const parts = [`${report.ok} of ${report.tickers.length} priced`];
    if (report.reused > 0) parts.push(`${report.reused} already held by another desk`);
    if (report.stored > 0) parts.push(`${report.stored} closes stored`);
    if (report.failed > 0) parts.push(`${report.failed} could not be read`);
    return { ok: true, message: `${parts.join(" · ")}.` };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? `The refresh could not complete: ${err.message}` : "The refresh could not complete.",
    };
  }
}

/** Persist only what differs from the default-and-environment baseline. */
export async function saveRiskSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const { count } = saveRiskDiff(input);
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
