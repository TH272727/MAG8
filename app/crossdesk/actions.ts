"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { saveCrossdeskDiff } from "@/lib/crossdesk-settings";

/* ============================================================================
 * Server actions for the Cross-Desk Ledger.
 *
 * The same two gates as every other desk, and they are not the same gate: the
 * pre-launch curtain applies to everything here and an admin token does not
 * bypass it, while the token additionally gates anything that changes what
 * every visitor sees.
 *
 * There is no refresh action and there will not be one. The ledger fetches
 * nothing and stores nothing — it is derived on read from what four other
 * desks already hold, so the only thing there is to refresh is one of them.
 * ========================================================================== */

export interface ActionState {
  ok: boolean;
  message: string;
}

async function adminAuthorized(): Promise<boolean> {
  if (launchMode()) return false;
  return tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
}

/** Persist only what differs from the default-and-environment baseline. */
export async function saveCrossdeskSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  try {
    const { count } = saveCrossdeskDiff(input);
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
