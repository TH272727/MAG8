import { getReachSnapshot, isoWeekKey, latestReachSnapshot, saveReachSnapshot } from "../db";
import { reachEnabled, reachSettings } from "../reach-settings";
import { readCompanyFilings, type CompanyFilings } from "./filings";
import { emptySnapshot, mergeSnapshot, normalizeTickers, type ReachSnapshot } from "./snapshot";

export { companyEvidence, type ReachSnapshot } from "./snapshot";
export type { CompanyFilings, FilingKind, FilingRef } from "./filings";

/* ============================================================================
 * The evidence layer — orchestration (the only module here that stores).
 *
 * Two entry points and a hard line between them, the same split the desk, the
 * board and the scanner all use:
 *
 *   refreshReach()  touches the network, and is only ever called deliberately
 *   readReach()     NEVER touches the network, and is what a run reads
 *
 * The snapshot is frozen per ISO week for one specific reason: a lens cell is
 * cached on (ticker, skill, iso_week). If the reference data a prompt carried
 * could change inside a week, a cached cell and a fresh cell would describe
 * different worlds while claiming to be the same reading. The universe screen
 * freezes its snapshot for exactly this; the merge rule next door keeps that
 * true across several runs in one week.
 * ========================================================================== */

/**
 * Read the frozen snapshot. Never fetches — a run calls this, and a run that
 * finds nothing simply carries no reference block, exactly as before this
 * layer existed.
 *
 * `allowStale` falls back to the most recent snapshot of ANY week. Off by
 * default: on the lens path a stale block would break the week-freeze contract
 * above, so a caller that genuinely wants one (an operator readout) has to ask.
 */
export function readReach(opts: { weekKey?: string; allowStale?: boolean } = {}): ReachSnapshot | null {
  if (!reachEnabled()) return null;
  const week = opts.weekKey ?? isoWeekKey();
  const row = getReachSnapshot<ReachSnapshot>(week);
  if (row) return row.payload;
  if (!opts.allowStale) return null;
  return latestReachSnapshot<ReachSnapshot>()?.payload ?? null;
}

export interface RefreshOptions {
  /** Re-read companies already present in this week's snapshot. */
  force?: boolean;
  /** Compute without persisting — the --dry path. */
  dryRun?: boolean;
  /** Fixed clock, so a test and a frozen week agree. */
  asOf?: Date;
  onProgress?: (line: string) => void;
}

/**
 * Bring this week's snapshot up to date for a set of tickers.
 *
 * Idempotent: a ticker already read this week is left alone unless forced, so
 * calling this at the start of every run costs one request per genuinely new
 * candidate and nothing at all for the rest. Per-company failures are recorded
 * ON the company and never thrown — one unreadable name must not cost the
 * other seven their evidence.
 */
export async function refreshReach(tickers: string[], opts: RefreshOptions = {}): Promise<ReachSnapshot> {
  const asOf = opts.asOf ?? new Date();
  const week = isoWeekKey(asOf);
  if (!reachEnabled()) return emptySnapshot(week, asOf.toISOString());

  const s = reachSettings();
  const prior = getReachSnapshot<ReachSnapshot>(week)?.payload ?? null;

  const known = new Map<string, CompanyFilings>();
  if (prior && !opts.force) for (const c of prior.companies) known.set(c.ticker.toUpperCase(), c);

  const wanted = normalizeTickers(tickers);
  const todo = wanted.filter((t) => !known.has(t));
  opts.onProgress?.(
    `${wanted.length} ticker(s): ${todo.length} to read, ${wanted.length - todo.length} already in week ${week}`,
  );

  for (const ticker of todo) {
    const read = await readCompanyFilings(ticker, {
      lookbackDays: s.filingsLookbackDays,
      max: s.maxFilingsPerCandidate,
      asOf,
      timeoutMs: s.fetchTimeoutMs,
    });
    known.set(ticker, read);
    opts.onProgress?.(
      `  ${ticker.padEnd(6)} ${read.unavailable ?? `${read.recent.length} filing(s), ${read.offeringCount} offering(s)`}`,
    );
  }

  const snapshot = mergeSnapshot({
    weekKey: week,
    fetchedAt: new Date().toISOString(),
    prior,
    wanted,
    known,
  });

  if (!opts.dryRun) saveReachSnapshot(week, snapshot);
  return snapshot;
}
