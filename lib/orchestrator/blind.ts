import { CONFIG } from "../config";
import type { CoverageEntry } from "../db";
import { fmtMarketCap, type UniversePool, type UniverseRow } from "../universe";
import type { UniverseSettings } from "../universe-settings";
import {
  BlindSelectionSchema,
  DiscoveryResultSchema,
  DISCOVERY_SKILL,
  type DiscoveryCandidate,
  type DiscoveryResult,
} from "../schemas";
import { ContractError, runAgentWithContract } from "./agent";
import {
  blindResearchPrompt,
  blindSelectPrompt,
  runDateLine,
  type BlindCardView,
  type BlindShortlistRow,
} from "./prompts";
import { emitProgress, nowIso } from "./progress";
import { runDiscovery } from "./discovery";

/* ============================================================================
 * Blind-selection discovery (HANDOFF-2026-07-16 §6 D) — a knob-gated,
 * lab-only experiment in reducing name-bias.
 *
 * Phase 1a: the scout sees the ranked-head names as ANONYMIZED data cards
 * (sector + size bucket + filings digest, NO ticker or company name) and picks
 * a shortlist from the numbers alone. Phase 1b: the shortlist is deterministically
 * un-blinded and researched with identities revealed, narrowing to the final
 * cohort on research quality, not familiarity.
 *
 * The point is measurement: because the SELECTION happened without names, the
 * salience overlap of a blind cohort vs a sighted one on the same snapshot
 * (npm run audit:salience) is the cleanest read on how much name familiarity
 * drives normal discovery. It reduces name-bias; it does not eliminate it
 * (a distinctive data profile can still fingerprint a name) — disclosed as such.
 *
 * Fail-open: with no ranked pool (SEC data unavailable or ranking off) there
 * are no data cards to show, so the run falls back to normal sighted discovery,
 * disclosed on the activity feed. Same return shape as runDiscovery.
 * ========================================================================== */

/** How many ranked-head names become anonymized cards (prompt economy vs. genuine choice). */
const BLIND_DECK_MAX = 60;

/** Anonymized size bucket — coarser than the exact cap, to blunt fingerprinting. */
function capBucket(c: number): string {
  if (c < 1e9) return "<$1B";
  if (c < 3e9) return "$1–3B";
  if (c < 10e9) return "$3–10B";
  if (c < 25e9) return "$10–25B";
  if (c < 50e9) return "$25–50B";
  return "$50B+";
}

/** Tiny deterministic PRNG (xmur3 seed + mulberry32) — card order is stable within a week and hides rank. */
function seeded(key: string): () => number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the shuffled, anonymized deck + the id → row unblind map. */
function buildDeck(pool: UniversePool): { cards: BlindCardView[]; byId: Map<string, UniverseRow> } {
  const headRows = pool.shown.slice(0, Math.min(pool.rankedCount, BLIND_DECK_MAX));
  const order = headRows.map((_, i) => i);
  const rand = seeded(`blind:${pool.weekKey}`);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const cards: BlindCardView[] = [];
  const byId = new Map<string, UniverseRow>();
  order.forEach((rowIdx, pos) => {
    const row = headRows[rowIdx];
    const id = `C${String(pos + 1).padStart(2, "0")}`;
    cards.push({ id, sector: row.s, capBucket: capBucket(row.c), digest: pool.digests[row.t] || "" });
    byId.set(id, row);
  });
  return { cards, byId };
}

function shortlistRow(row: UniverseRow, pool: UniversePool): BlindShortlistRow {
  return {
    ticker: row.t,
    companyName: row.n,
    sector: row.s,
    capDisplay: fmtMarketCap(row.c),
    digest: pool.digests[row.t] || "",
  };
}

/** Synthetic candidate for a shortlist name phase 1b did not return (rare backfill). */
function candidateFromRow(row: BlindShortlistRow): DiscoveryCandidate {
  return {
    ticker: row.ticker,
    companyName: row.companyName,
    sector: row.sector,
    thesis:
      `Selected blind from its filings data (identity withheld during selection). Filings snapshot: ${row.digest || "structured filings on file"}. Carried into the cohort from the blind shortlist; the independent lenses assess it from primary data on its own merits.`,
    matchedTraits: ["Blind-selected on fundamentals (no name recognition)"],
  };
}

export async function runBlindDiscovery(
  runId: string,
  count: number,
  signal: AbortSignal,
  ctx: { coverage: CoverageEntry[]; modifier?: string; pool?: UniversePool; settings?: UniverseSettings },
): Promise<{ discovery: DiscoveryResult; costUsd: number; selectionFlags: string[] }> {
  // Fail-open: no ranked pool → no cards to show → normal sighted discovery.
  if (!ctx.pool || ctx.pool.rankedCount === 0) {
    emitProgress(runId, {
      type: "discovery_activity",
      activity: "Blind-selection mode needs a fundamentals-ranked pool, which is unavailable this run — proceeding with normal discovery.",
      at: nowIso(),
    });
    return runDiscovery(runId, count, signal, ctx);
  }

  const pool = ctx.pool;
  const dateLine = runDateLine();
  const { cards, byId } = buildDeck(pool);
  const shortlistN = Math.min(cards.length, Math.max(count, Math.ceil(count * 1.75)));

  // --- Phase 1a: blind selection from anonymized cards (tool-less) ---------
  emitProgress(runId, {
    type: "discovery_activity",
    activity: `Blind selection: choosing a ${shortlistN}-name shortlist from ${cards.length} anonymized fundamentals cards (no tickers or names shown)…`,
    at: nowIso(),
  });
  const selectRes = await runAgentWithContract(BlindSelectionSchema, {
    prompt: blindSelectPrompt(cards, shortlistN, dateLine),
    model: CONFIG.models.discovery,
    allowedTools: [], // pure reasoning over the cards — no web, no files
    skills: [], // no skill: the task is fully specified in the prompt
    maxTurns: CONFIG.maxTurns.compile,
    timeoutMs: CONFIG.timeoutsMs.compile,
    effort: CONFIG.effort.discovery,
    thinking: CONFIG.thinking.discovery,
    maxBudgetUsd: CONFIG.maxBudgetUsd.compile,
    signal,
    label: "discovery:blind-select",
    onActivity: (activity) => emitProgress(runId, { type: "discovery_activity", activity, at: nowIso() }),
  });
  let totalCost = selectRes.costUsd;

  // Unblind: valid, de-duplicated selections in the scout's order, backfilled
  // from the ranked head if too few landed, so phase 1b always has >= count.
  const chosen: UniverseRow[] = [];
  const taken = new Set<string>();
  for (const s of selectRes.data.selections) {
    const row = byId.get(s.id.trim().toUpperCase()) ?? byId.get(s.id.trim());
    if (row && !taken.has(row.t)) {
      taken.add(row.t);
      chosen.push(row);
    }
    if (chosen.length >= shortlistN) break;
  }
  let backfilled = 0;
  if (chosen.length < count) {
    for (const row of pool.shown.slice(0, pool.rankedCount)) {
      if (chosen.length >= count) break;
      if (!taken.has(row.t)) {
        taken.add(row.t);
        chosen.push(row);
        backfilled++;
      }
    }
  }
  if (chosen.length === 0) {
    throw new ContractError("blind discovery: no usable card selections after unblinding");
  }
  const shortlist = chosen.map((r) => shortlistRow(r, pool));
  const shortlistSet = new Set(shortlist.map((r) => r.ticker));

  // --- Phase 1b: research the un-blinded shortlist (skill + web) ------------
  emitProgress(runId, {
    type: "discovery_activity",
    activity: `Blind selection complete: ${shortlist.length} names picked from data alone${backfilled > 0 ? ` (${backfilled} added from the ranked head to fill the shortlist)` : ""}. Researching them with identities revealed…`,
    at: nowIso(),
  });
  const researchRes = await runAgentWithContract(DiscoveryResultSchema, {
    prompt: blindResearchPrompt(count, shortlist, dateLine),
    model: CONFIG.models.discovery,
    allowedTools: ["WebSearch", "WebFetch", "Read"],
    skills: [DISCOVERY_SKILL],
    maxTurns: CONFIG.maxTurns.discovery,
    timeoutMs: CONFIG.timeoutsMs.discovery,
    effort: CONFIG.effort.discovery,
    thinking: CONFIG.thinking.discovery,
    maxBudgetUsd: CONFIG.maxBudgetUsd.discovery,
    signal,
    label: "discovery:blind-research",
    onActivity: (activity) => emitProgress(runId, { type: "discovery_activity", activity, at: nowIso() }),
  });
  totalCost += researchRes.costUsd;

  // Enforce blind integrity: keep only shortlist names (drop any drift), in the
  // scout's delivered order, then backfill from the shortlist if short.
  const seen = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];
  let dropped = 0;
  for (const c of researchRes.data.candidates) {
    const ticker = c.ticker.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    if (!shortlistSet.has(ticker)) {
      dropped++;
      continue; // off-shortlist name — would break the blind measurement
    }
    seen.add(ticker);
    candidates.push({ ...c, ticker });
    if (candidates.length >= count) break;
  }
  for (const row of shortlist) {
    if (candidates.length >= count) break;
    if (!seen.has(row.ticker)) {
      seen.add(row.ticker);
      candidates.push(candidateFromRow(row));
    }
  }
  if (candidates.length === 0) {
    throw new ContractError("blind discovery: no usable candidates after research");
  }

  const flags: string[] = [];
  if (backfilled > 0) {
    flags.push(
      `Blind selection: ${backfilled} name${backfilled === 1 ? "" : "s"} in the shortlist came from the top of the fundamentals ranking because the blind picks did not fill it — still chosen on filings data, never on name recognition.`,
    );
  }
  if (dropped > 0) {
    flags.push(
      `Blind selection: ${dropped} researched name${dropped === 1 ? " was" : "s were"} outside the blind shortlist and dropped to preserve the experiment's integrity.`,
    );
  }

  return {
    discovery: { marketContext: researchRes.data.marketContext, candidates },
    costUsd: totalCost,
    selectionFlags: flags,
  };
}
