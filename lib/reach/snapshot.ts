import type { CompanyFilings } from "./filings";

/* ============================================================================
 * The snapshot shape and the pure merge that maintains it.
 *
 * Split out from index.ts so it can be tested without importing lib/db —
 * importing that opens the real SQLite file and runs boot reconciliation,
 * which marks a live run interrupted. Storage lives next door; the rule for
 * what a week's snapshot should CONTAIN lives here, where it can be pinned.
 * ========================================================================== */

export interface ReachSnapshot {
  weekKey: string;
  fetchedAt: string;
  companies: CompanyFilings[];
  /** What could not be read, in plain language. Surfaced, never swallowed. */
  notes: string[];
}

export const emptySnapshot = (weekKey: string, fetchedAt = new Date().toISOString()): ReachSnapshot => ({
  weekKey,
  fetchedAt,
  companies: [],
  notes: [],
});

/** One company out of a snapshot. Null when this week never looked it up. */
export function companyEvidence(snap: ReachSnapshot | null, ticker: string): CompanyFilings | null {
  if (!snap) return null;
  const t = ticker.trim().toUpperCase();
  return snap.companies.find((c) => c.ticker.toUpperCase() === t) ?? null;
}

/** Normalized, de-duplicated ticker list, order preserved. */
export const normalizeTickers = (tickers: string[]): string[] => [
  ...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
];

/**
 * PURE: fold freshly-read companies into the week's existing snapshot.
 *
 * Additive by design. A week is a frozen reference for every lens cell cached
 * inside it, so a second run must be able to add its own candidates without
 * rewriting what the first run's cells were shown. Three rules:
 *
 *  - Requested tickers lead, in the order asked, so a run reads in cohort order.
 *  - Companies the week already held and this call did not ask about are kept,
 *    untouched, behind them.
 *  - A note is replaced only for a ticker this call actually re-read. Dropping
 *    every old note would quietly erase the record of a company that is still
 *    unreadable; keeping stale ones would report a failure that has since been
 *    fixed.
 */
export function mergeSnapshot(args: {
  weekKey: string;
  fetchedAt: string;
  prior: ReachSnapshot | null;
  /** Tickers this call asked about, normalized. */
  wanted: string[];
  /** Everything now known, keyed by upper-case ticker (prior entries included). */
  known: Map<string, CompanyFilings>;
}): ReachSnapshot {
  const { weekKey, fetchedAt, prior, wanted, known } = args;
  const asked = new Set(wanted);

  const leading = wanted.map((t) => known.get(t)).filter((c): c is CompanyFilings => c !== undefined);
  const trailing = [...known.entries()].filter(([t]) => !asked.has(t)).map(([, c]) => c);

  const freshNotes = leading.filter((c) => c.unavailable).map((c) => `${c.ticker}: ${c.unavailable}`);
  const keptNotes = (prior?.notes ?? []).filter((n) => !asked.has(n.split(":")[0]?.trim().toUpperCase() ?? ""));

  return { weekKey, fetchedAt, companies: [...leading, ...trailing], notes: [...keptNotes, ...freshNotes] };
}
