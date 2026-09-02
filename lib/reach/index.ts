import { getAppSettingJson, getReachSnapshot, isoWeekKey, latestReachSnapshot, reachSnapshotBefore, saveReachSnapshot } from "../db";
import { reachEnabled, reachSettings } from "../reach-settings";
import { feedSources } from "./catalog";
import { readFeeds, type ReleaseItem } from "./feeds";
import { readCompanyFilings } from "./filings";
import { ecosystemHandles, readEcosystem } from "./github";
import { companyEvidence, emptySnapshot, mergeSnapshot, normalizeTickers, type CompanyEntry, type ReachSnapshot } from "./snapshot";

export { companyEvidence, type CompanyEntry, type ReachSnapshot } from "./snapshot";
export type { CompanyFilings, FilingKind, FilingRef } from "./filings";
export type { ReleaseItem } from "./feeds";
export type { EcosystemRead } from "./github";

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
  /**
   * Read the official-release feeds too. Off unless the week has none, because
   * they are week-level: re-reading them mid-week would change the block every
   * already-cached cell was shown, which is the freeze this layer exists to
   * keep. `force` overrides, and so does an empty week.
   */
  withReleases?: boolean;
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

  const wanted = normalizeTickers(tickers);

  // Force re-reads the tickers you ASKED for; it never discards ones you did
  // not mention. Clearing the whole map instead made `--refresh --force` with
  // no tickers — the natural way to refresh only the feeds — delete every
  // company in the week. Caught live, twice.
  const known = new Map<string, CompanyEntry>();
  if (prior) for (const c of prior.companies) known.set(c.ticker.toUpperCase(), c);
  if (opts.force) for (const t of wanted) known.delete(t);

  const todo = wanted.filter((t) => !known.has(t));
  opts.onProgress?.(
    `${wanted.length} ticker(s): ${todo.length} to read, ${wanted.length - todo.length} already in week ${week}`,
  );

  const handles = s.ecosystemEnabled
    ? ecosystemHandles(getAppSettingJson("reach_handles") as Record<string, string> | null)
    : {};
  // The baseline a trend is measured against. Looked up ONCE, and stamped onto
  // each reading, so the trend can later be read off the snapshot alone.
  const baseline = todo.length > 0 && s.ecosystemEnabled ? reachSnapshotBefore<ReachSnapshot>(week)?.payload ?? null : null;

  for (const ticker of todo) {
    const filings = await readCompanyFilings(ticker, {
      lookbackDays: s.filingsLookbackDays,
      max: s.maxFilingsPerCandidate,
      asOf,
      timeoutMs: s.fetchTimeoutMs,
    });
    const entry: CompanyEntry = { ...filings };

    if (s.ecosystemEnabled) {
      const eco = await readEcosystem(ticker, handles[ticker], {
        minRepos: s.ecosystemMinRepos,
        asOf,
        timeoutMs: s.fetchTimeoutMs,
      });
      if (eco) {
        const was = companyEvidence(baseline, ticker)?.ecosystem;
        // Only a measured prior can be a baseline. Comparing against a week
        // that measured nothing would turn "we could not read it then" into
        // apparent growth from zero.
        if (was && !was.notMeasured && !eco.notMeasured && baseline) {
          eco.since = { weekKey: baseline.weekKey, publicRepos: was.publicRepos, orgFollowers: was.orgFollowers };
        }
        entry.ecosystem = eco;
      }
    }

    known.set(ticker, entry);
    const ecoNote = entry.ecosystem
      ? entry.ecosystem.notMeasured
        ? `, ecosystem NOT MEASURED (${entry.ecosystem.notMeasured})`
        : `, ${entry.ecosystem.publicRepos} repos / ${entry.ecosystem.orgFollowers} followers`
      : "";
    opts.onProgress?.(
      `  ${ticker.padEnd(6)} ${filings.unavailable ?? `${filings.recent.length} filing(s), ${filings.offeringCount} offering(s)${ecoNote}`}`,
    );
  }

  // Read the week's releases when it has none yet, or when told to. Otherwise
  // keep what the week already holds, so a second run adding one candidate
  // does not rewrite the macro block every earlier cell was shown.
  let releases: ReleaseItem[] | null = null;
  let feedNotes: string[] | undefined;
  if (opts.force || opts.withReleases || !prior || prior.releases.length === 0) {
    const sources = feedSources();
    opts.onProgress?.(`reading ${sources.length} official-release source(s)`);
    const read = await readFeeds(sources, {
      lookbackDays: s.feedLookbackDays,
      maxPerSource: s.maxFeedItems,
      asOf,
      timeoutMs: s.fetchTimeoutMs,
    });
    releases = read.items;
    feedNotes = read.notes;
    opts.onProgress?.(`  ${read.items.length} release(s) in the window`);
    for (const n of read.notes) opts.onProgress?.(`  not read — ${n}`);
  }

  const snapshot = mergeSnapshot({
    weekKey: week,
    fetchedAt: new Date().toISOString(),
    prior,
    wanted,
    known,
    releases,
    feedNotes,
  });

  if (!opts.dryRun) saveReachSnapshot(week, snapshot);
  return snapshot;
}
