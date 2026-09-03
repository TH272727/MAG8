"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { getAppSettingJson, setAppSettingJson } from "@/lib/db";
import { refreshReach, readReach } from "@/lib/reach";
import { validateFeedSet } from "@/lib/reach/catalog";
import { BUILTIN_HANDLES } from "@/lib/reach/github";
import { describeFetchError } from "@/lib/edgar";
import { reachEnabled, saveReachDiff } from "@/lib/reach-settings";

/* ============================================================================
 * Server actions for the evidence layer. Admin-only, and there is no public
 * page for any of this — the layer has no surface of its own; it feeds the
 * research and discloses itself on the methodology page.
 *
 * Two gates, and they are not the same gate: the pre-launch curtain applies to
 * everything here and an admin token does NOT bypass it, and the admin token
 * additionally applies because all of these write.
 * ========================================================================== */

export interface ActionState {
  ok: boolean;
  message: string;
}

async function adminAuthorized(): Promise<boolean> {
  if (launchMode()) return false;
  return tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
}

export async function saveReachSettingsAction(values: Record<string, number | boolean>): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const { count } = saveReachDiff(values);
  return {
    ok: true,
    message: count === 0 ? "Saved — every dial is at its default." : `Saved ${count} override${count === 1 ? "" : "s"}.`,
  };
}

/**
 * Re-read the official releases, and re-read the companies the week already
 * holds. Reports the transport reason rather than a count when nothing could
 * be read: "0 sources" reads like a fact about the world, and a dead network
 * is not one.
 */
export async function refreshReachAction(): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  if (!reachEnabled()) return { ok: false, message: "The evidence layer is switched off by MAG8_REACH=0." };
  try {
    const held = readReach({ allowStale: false })?.companies.map((c) => c.ticker) ?? [];
    const snap = await refreshReach(held, { force: true });
    const unread = snap.notes.length + snap.feedNotes.length;
    return {
      ok: true,
      message:
        `Read ${snap.companies.length} company(ies) and ${snap.releases.length} official release(s) for week ${snap.weekKey}.` +
        (unread > 0 ? ` ${unread} source(s) could not be read — see the notes.` : ""),
    };
  } catch (err) {
    return { ok: false, message: `Nothing was read, so the stored evidence is unchanged: ${describeFetchError(err)}` };
  }
}

/* ----------------------------------------------------------------------------
 * The two catalogues. Both validate the WHOLE set or store none of it — a
 * half-applied catalogue is harder to notice than a rejected one.
 * -------------------------------------------------------------------------- */

export async function saveFeedCatalogAction(json: string): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: "That is not valid JSON, so nothing was saved." };
  }
  const out = validateFeedSet(parsed);
  if (!out.ok) return { ok: false, message: `Rejected, nothing saved — ${out.reason}.` };
  setAppSettingJson("reach_feeds", out.sources);
  return {
    ok: true,
    message: `Saved ${out.sources.length} custom source(s). They take effect on the next read.`,
  };
}

/**
 * Ticker → organisation handles. An EMPTY handle removes a built-in, which is
 * how a wrong mapping is retired without editing code — and removing one
 * returns that ticker to "never looked up", not to a broken lookup.
 *
 * Handles are NOT verified here. A save is a claim; the read is what tests it,
 * and a handle that does not resolve comes back as "no such organisation"
 * rather than as a company that publishes nothing.
 */
export async function saveHandleMapAction(json: string): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: "That is not valid JSON, so nothing was saved." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, message: 'Expected an object of "TICKER": "handle" pairs. Nothing was saved.' };
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const ticker = k.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*$/.test(ticker) || ticker.length > 10) {
      return { ok: false, message: `"${k}" is not shaped like a ticker. Nothing was saved.` };
    }
    if (typeof v !== "string") return { ok: false, message: `The handle for ${ticker} must be text. Nothing was saved.` };
    // A handle is one path segment; anything else is a URL or a typo.
    const handle = v.trim();
    if (handle && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(handle)) {
      return { ok: false, message: `"${handle}" is not an organisation name. Nothing was saved.` };
    }
    out[ticker] = handle;
  }
  setAppSettingJson("reach_handles", out);
  const removed = Object.entries(out).filter(([t, h]) => !h && t in BUILTIN_HANDLES).length;
  return {
    ok: true,
    message:
      `Saved ${Object.keys(out).length} mapping(s)` +
      (removed > 0 ? `, ${removed} of which remove a built-in.` : ".") +
      " They take effect on the next read.",
  };
}

/** Current custom catalogues, for the editors to open with. */
export async function reachCataloguesAction(): Promise<{ feeds: string; handles: string }> {
  return {
    feeds: JSON.stringify(getAppSettingJson("reach_feeds") ?? [], null, 2),
    handles: JSON.stringify(getAppSettingJson("reach_handles") ?? {}, null, 2),
  };
}
