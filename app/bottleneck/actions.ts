"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { saveBottleneckDiff } from "@/lib/bottleneck-settings";
import { allPlaybooks, getPlaybook, usesPlaceholderFactors } from "@/lib/bottleneck/playbook";

/* ============================================================================
 * Bottleneck desk — server actions.
 *
 * Every action here is admin-gated AND hidden behind the pre-launch curtain,
 * exactly like the run routes: in launch mode the desk does not exist, and an
 * admin token does not bypass that (flip MAG8_SITE_MODE=full to operate).
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
 * Persist the owner's desk overrides. The client posts the whole settings map;
 * only values differing from the default/env baseline are stored, so a value
 * typed back to its baseline reverts to default provenance. Pass {} to reset.
 */
export async function saveBottleneckSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const { count } = saveBottleneckDiff(input);
  return {
    ok: true,
    message:
      count === 0
        ? "All values at their default/env baseline — no overrides stored."
        : `Saved ${count} override${count === 1 ? "" : "s"}. The desk uses them on its next read.`,
  };
}

export interface PlaybookSummary {
  id: string;
  label: string;
  blurb: string;
  builtIn: boolean;
  basket: string[];
  capexTags: number;
  conversionVersion: string;
  conversionAsOf: string;
  factors: { key: string; unit: string; usdPer: number; source: string; asOf: string }[];
  placeholderFactors: boolean;
  supply: { seriesId: string; label: string; unit: string; connector: string; stub: boolean }[];
  owners: { category: string; label: string; tickers: string[]; foreign: string[] }[];
}

function summarize(id: string): PlaybookSummary | null {
  const pb = getPlaybook(id);
  if (!pb) return null;
  return {
    id: pb.id,
    label: pb.label,
    blurb: pb.blurb,
    builtIn: pb.builtIn,
    basket: pb.demand.basket,
    capexTags: pb.demand.capexTags.length,
    conversionVersion: pb.conversions.version,
    conversionAsOf: pb.conversions.asOf,
    factors: pb.conversions.factors.map((f) => ({
      key: f.key,
      unit: f.unit,
      usdPer: f.usdPer,
      source: f.source,
      asOf: f.asOf,
    })),
    placeholderFactors: usesPlaceholderFactors(pb),
    supply: pb.supply.map((s) => ({
      seriesId: s.seriesId,
      label: s.label,
      unit: s.unit,
      connector: s.connector,
      stub: Boolean(s.stub),
    })),
    owners: pb.owners.map((o) => ({
      category: o.category,
      label: o.label,
      tickers: o.tickers,
      foreign: o.foreign,
    })),
  };
}

/** Read-only inspection of a playbook, for the admin panel. */
export async function inspectPlaybookAction(
  id: string,
): Promise<{ ok: true; playbook: PlaybookSummary } | { ok: false; message: string }> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const summary = summarize(id);
  return summary ? { ok: true, playbook: summary } : { ok: false, message: `No playbook with id "${id}".` };
}

/** Ids and labels of every available playbook (built-in plus owner-defined). */
export async function listPlaybooksAction(): Promise<{ id: string; label: string; builtIn: boolean }[]> {
  if (!(await adminAuthorized())) return [];
  return allPlaybooks().map((p) => ({ id: p.id, label: p.label, builtIn: p.builtIn }));
}
