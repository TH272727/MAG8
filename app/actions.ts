"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { insertSignup } from "@/lib/db";
import { getWeeklyUniverse, universeEnabled, type FunnelStep } from "@/lib/universe";
import { saveUniverseDiff, type UniverseSettings } from "@/lib/universe-settings";

export interface ActionState {
  ok: boolean;
  message: string;
}

export async function subscribeEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.email().max(200).safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) {
    return { ok: false, message: "That doesn't look like an email address — check it and try again." };
  }
  const isNew = insertSignup(parsed.data);
  return {
    ok: true,
    message: isNew ? "You're on the list." : "Already on the list — you're set.",
  };
}

export async function adminLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!token || !tokenMatches(token)) {
    return { ok: false, message: "Wrong token. Check ADMIN_TOKEN on the server." };
  }
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin");
}

/* ----------------------------------------------------------------------------
 * Stage-0 universe screen settings (admin-only; hidden behind the launch curtain
 * like the run APIs — flip MAG8_SITE_MODE=full to operate)
 * -------------------------------------------------------------------------- */

async function adminAuthorized(): Promise<boolean> {
  if (launchMode()) return false;
  return tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
}

/**
 * Persist the owner's Stage-0 overrides. The client sends the full settings
 * map; only values differing from the default/env baseline are stored, so a
 * value typed back to its baseline reverts to default/env provenance.
 * Pass {} to reset everything.
 */
export async function saveUniverseSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const { count } = saveUniverseDiff(input);
  return {
    ok: true,
    message:
      count === 0
        ? "All values at their default/env baseline — no overrides stored."
        : `Saved ${count} override${count === 1 ? "" : "s"}. The next run uses them.`,
  };
}

export interface UniversePreview {
  weekKey: string;
  fetchedAt: string;
  stale: boolean;
  totalListed: number;
  normalized: number;
  eligibleCount: number;
  poolSize: number;
  criteria: string;
  funnel: FunnelStep[];
  secCoverage: { withData: number; total: number } | null;
  exchanges: string[];
  sample: { t: string; n: string; s: string; capB: number }[];
  settings: UniverseSettings;
}

export type UniversePreviewState =
  | { ok: true; preview: UniversePreview }
  | { ok: false; message: string };

/**
 * Run the screen with the CURRENT effective settings and report the funnel.
 * force=true re-pulls this week's data (repersists the weekly snapshot — the
 * pool the next run sees derives from it).
 */
export async function previewUniverseAction(force: boolean): Promise<UniversePreviewState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  if (!universeEnabled()) return { ok: false, message: "Stage 0 is disabled by MAG8_UNIVERSE=0." };
  const universe = await getWeeklyUniverse(force);
  if (!universe) {
    return { ok: false, message: "Screen unavailable — feed unreachable and no cached snapshot (or the knobs left fewer than 10 eligible names)." };
  }
  const { pool } = universe;
  return {
    ok: true,
    preview: {
      weekKey: pool.weekKey,
      fetchedAt: pool.fetchedAt,
      stale: pool.stale,
      totalListed: pool.totalListed,
      normalized: universe.rows.length,
      eligibleCount: pool.eligibleCount,
      poolSize: pool.shown.length,
      criteria: pool.criteria,
      funnel: pool.funnel,
      secCoverage: pool.secCoverage,
      exchanges: universe.extras?.exchanges ?? [],
      sample: pool.shown.slice(0, 12).map((r) => ({ t: r.t, n: r.n, s: r.s, capB: Math.round(r.c / 1e8) / 10 })),
      settings: universe.settings,
    },
  };
}
