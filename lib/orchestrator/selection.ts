import { salienceRank } from "../salience";
import type { DiscoveryCandidate } from "../schemas";
import type { UniversePool, UniverseRow } from "../universe";
import type { UniverseSettings } from "../universe-settings";

/* ============================================================================
 * Selection discipline — the anti-familiarity floor (Stage-1 extract time).
 *
 * The ranked pool (Stage 0 / lib/universe.ts) puts filings-derived selection
 * evidence in FRONT of the scout, but it cannot make the scout use it — a
 * generative model still carries a strong training-data prior toward famous
 * "next-mega-cap" names (measured: lib/salience.ts). This module is the
 * deterministic counterweight, applied to the DELIVERED cohort after discovery:
 *
 *   - a FLOOR on how many picks must come from the fundamentals-ranked head,
 *   - a CEILING on how many picks may be widely-covered consensus names
 *     (measured against the fixed salience baseline).
 *
 * Both are OFF by default (floor 0, ceiling = cohort size). When on, a miss is
 * either disclosed only (soft) or corrected by substituting names from the
 * ranked head (hard gate) — reject-and-replace, every substitution disclosed.
 * The scout keeps every compliant pick; enforcement only touches the shortfall,
 * so the model's cross-wave synthesis stays intact (a pure factor screen would
 * be a commodity — see HANDOFF-2026-07-16 §E). Fame is capped, measured, and
 * disclosed — never zeroed, because it cannot be.
 *
 * Server-only (imports the salience baseline). Never reached by client code.
 * ========================================================================== */

export interface SelectionQuota {
  /** Minimum picks that must come from the ranked head (0 = off). */
  rankedFloor: number;
  /** Maximum picks that may be on the salience baseline (>= cohort size = off). */
  salienceCap: number;
  /** true = substitute from the ranked head on a miss; false = disclose only. */
  hardGate: boolean;
}

export interface SelectionStats {
  /** A floor or ceiling actually binds this cohort size. */
  active: boolean;
  /** The hard gate ran (on AND a ranked head existed to draw from). */
  enforced: boolean;
  rankedHits: number;
  /** Effective floor (clamped to the ranked-head size and cohort size). */
  rankedFloor: number;
  salienceHits: number;
  salienceCap: number;
  /** Picks swapped in from the ranked head. */
  replaced: number;
}

export interface SelectionResult {
  /** The (possibly corrected) cohort — same length as the input. */
  candidates: DiscoveryCandidate[];
  /** Public-safe disclosures for the compiler's known gaps and gapsNoted. */
  flags: string[];
  /** One-line narration for the activity feed (null when no quota binds). */
  activity: string | null;
  stats: SelectionStats;
}

/** Build the quota from the effective universe settings (no settings → inactive). */
export function selectionQuotaFrom(settings: UniverseSettings | undefined, count: number): SelectionQuota {
  if (!settings) return { rankedFloor: 0, salienceCap: count, hardGate: false };
  return {
    rankedFloor: settings.rankedFloor,
    salienceCap: settings.salienceCap,
    hardGate: settings.selectionHardGate,
  };
}

/** Matched-trait labels inferred from a public-safe filings digest. */
function traitsFromDigest(digest: string): string[] {
  const traits: string[] = [];
  const g = digest.match(/\(([+-]?\d+)% YoY\)/);
  if (g && Number(g[1]) >= 25) traits.push("High revenue growth (per SEC filings)");
  if (/self-funding/i.test(digest)) traits.push("Self-funding operations (positive operating cash flow)");
  else if (/\bOCF \$/i.test(digest) && !/\bOCF -\$/i.test(digest)) traits.push("Positive operating cash flow");
  if (/shares -\d+% YoY/i.test(digest)) traits.push("Share-count discipline (net buyback)");
  return traits;
}

/** Synthetic candidate for a ranked-head substitution — a data-surfaced name, honestly labeled. */
function makeReplacement(row: UniverseRow, digest: string | undefined): DiscoveryCandidate {
  const d = digest && digest.trim() ? digest.trim() : "structured filings on file";
  const traits = traitsFromDigest(d);
  return {
    ticker: row.t,
    companyName: row.n,
    sector: row.s,
    thesis:
      `Surfaced by the deterministic fundamentals ranking of the eligible universe — selected on filings data, not on narrative or name recognition. Latest filings snapshot: ${d}. Substituted into the cohort to meet the fundamentals-ranked selection floor; the independent lenses assess it from primary data on its own merits.`,
    matchedTraits: traits.length > 0 ? traits : ["Fundamentals-ranked (data-surfaced, not narrative-surfaced)"],
  };
}

/**
 * Apply the selection quota to a normalized cohort. Pure and deterministic; the
 * cohort length is preserved. Soft mode returns the scout's picks with any
 * shortfall flagged; hard mode substitutes from the ranked head first.
 */
export function applySelectionQuota(
  candidates: DiscoveryCandidate[],
  pool: UniversePool | undefined,
  quota: SelectionQuota,
): SelectionResult {
  const headRows = pool ? pool.shown.slice(0, pool.rankedCount) : [];
  const digests = pool?.digests ?? {};
  const headSet = new Set(headRows.map((r) => r.t));
  const inHead = (t: string) => headSet.has(t);
  const isFamous = (t: string) => salienceRank(t) !== null;

  const n = candidates.length;
  const effFloor = Math.min(Math.max(0, quota.rankedFloor), headRows.length, n);
  const capBinds = quota.salienceCap < n; // a ceiling at/above cohort size can never bind
  const floorBinds = effFloor > 0;

  const rankedHitsIn = (arr: DiscoveryCandidate[]) => arr.reduce((k, c) => k + (inHead(c.ticker) ? 1 : 0), 0);
  const famousHitsIn = (arr: DiscoveryCandidate[]) => arr.reduce((k, c) => k + (isFamous(c.ticker) ? 1 : 0), 0);

  const statsFor = (arr: DiscoveryCandidate[], enforced: boolean, replaced: number): SelectionStats => ({
    active: floorBinds || capBinds,
    enforced,
    rankedHits: rankedHitsIn(arr),
    rankedFloor: effFloor,
    salienceHits: famousHitsIn(arr),
    salienceCap: quota.salienceCap,
    replaced,
  });

  // Nothing binds → return untouched, no flags, no activity (the default path).
  if (!floorBinds && !capBinds) {
    return { candidates, flags: [], activity: null, stats: statsFor(candidates, false, 0) };
  }

  let cohort = candidates;
  let replaced = 0;
  const enforced = quota.hardGate && headRows.length > 0;

  if (enforced) {
    const work = candidates.map((c) => ({ ...c }));
    const used = new Set(work.map((c) => c.ticker));
    const queue = headRows.filter((r) => !used.has(r.t)); // best-first, mutable
    const takeHead = (requireNonFamous: boolean): UniverseRow | null => {
      const idx = requireNonFamous ? queue.findIndex((r) => !isFamous(r.t)) : queue.length > 0 ? 0 : -1;
      return idx >= 0 ? queue.splice(idx, 1)[0] : null;
    };
    const swap = (i: number, row: UniverseRow) => {
      used.delete(work[i].ticker);
      used.add(row.t);
      work[i] = makeReplacement(row, digests[row.t]);
      replaced++;
    };

    // Pass 1 — consensus ceiling. Retire famous picks that lack ranked-data
    // support first (lowest-conviction last), then, only if still over, famous
    // picks that do rank. Always swap in the best unused NON-famous ranked name
    // (a famous substitute would not reduce the count).
    if (capBinds) {
      for (const rankedToo of [false, true]) {
        for (let i = work.length - 1; i >= 0 && famousHitsIn(work) > quota.salienceCap; i--) {
          if (!isFamous(work[i].ticker)) continue;
          if (!rankedToo && inHead(work[i].ticker)) continue;
          const row = takeHead(true);
          if (!row) break; // no non-famous ranked name left to bring in
          swap(i, row);
        }
      }
    }

    // Pass 2 — ranked-head floor. Replace non-ranked picks (lowest-conviction
    // first) with unused ranked names, never pushing the famous count over the
    // ceiling: when at the ceiling, only a non-famous ranked name may come in.
    if (floorBinds) {
      for (let i = work.length - 1; i >= 0 && rankedHitsIn(work) < effFloor; i--) {
        if (inHead(work[i].ticker)) continue;
        const atCeiling = capBinds && famousHitsIn(work) >= quota.salienceCap && !isFamous(work[i].ticker);
        const row = takeHead(atCeiling);
        if (!row) {
          if (atCeiling) continue; // only famous names remain and they're banned here — try another slot
          break; // ranked head exhausted
        }
        swap(i, row);
      }
    }

    cohort = work;
  }

  // Disclosures on the FINAL cohort: substitutions made, plus any residual miss.
  const flags: string[] = [];
  const finalRanked = rankedHitsIn(cohort);
  const finalFamous = famousHitsIn(cohort);
  if (replaced > 0) {
    flags.push(
      `Selection discipline: ${replaced} pick${replaced === 1 ? " was" : "s were"} substituted from the fundamentals-ranked head of the universe to meet the selection floor — chosen on filings data rather than on how well known the name is.`,
    );
  }
  if (floorBinds && finalRanked < effFloor) {
    flags.push(
      `Selection discipline: only ${finalRanked} of ${n} picks come from the fundamentals-ranked head of the universe, below the configured floor of ${effFloor}.`,
    );
  }
  if (capBinds && finalFamous > quota.salienceCap) {
    flags.push(
      `Selection discipline: ${finalFamous} of ${n} picks are widely-covered consensus names, above the configured ceiling of ${quota.salienceCap}.`,
    );
  }

  // Activity-feed narration (only when a quota binds).
  const bits: string[] = [];
  if (floorBinds) bits.push(`${finalRanked}/${n} from the ranked head (floor ${effFloor})`);
  if (capBinds) bits.push(`${finalFamous} consensus name${finalFamous === 1 ? "" : "s"} (ceiling ${quota.salienceCap})`);
  const tail =
    replaced > 0
      ? ` — substituted ${replaced} from the ranked head`
      : flags.length > 0
        ? " — disclosed as a data gap"
        : " — within limits";
  const activity = bits.length > 0 ? `Selection discipline: ${bits.join(", ")}${tail}.` : null;

  return { candidates: cohort, flags, activity, stats: statsFor(cohort, enforced, replaced) };
}
