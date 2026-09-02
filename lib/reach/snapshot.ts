import type { CompanyFilings } from "./filings";
import type { ReleaseItem } from "./feeds";
import type { EcosystemRead } from "./github";

/* ============================================================================
 * The snapshot shape and the pure merge that maintains it.
 *
 * Split out from index.ts so it can be tested without importing lib/db —
 * importing that opens the real SQLite file and runs boot reconciliation,
 * which marks a live run interrupted. Storage lives next door; the rule for
 * what a week's snapshot should CONTAIN lives here, where it can be pinned.
 * ========================================================================== */

/**
 * One company's evidence. Filings are always attempted; the ecosystem reading
 * is present only for the minority of names with a curated handle, and absent
 * (rather than empty) for everyone else — "not looked up" and "looked up and
 * found nothing" are different facts and must not collapse into one shape.
 */
export interface CompanyEntry extends CompanyFilings {
  ecosystem?: EcosystemRead | null;
}

export interface ReachSnapshot {
  weekKey: string;
  fetchedAt: string;
  companies: CompanyEntry[];
  /**
   * Dated official releases for the week. Week-level rather than per-company:
   * every candidate in a week is shown the same list, which is what makes it
   * cheap — it is fetched once and cited many times.
   */
  releases: ReleaseItem[];
  /**
   * Companies that could not be read, as "TICKER: reason". Kept separate from
   * feed failures rather than partitioned out of one list by pattern-matching
   * the text: a transport error carries arbitrary punctuation, so any sniffing
   * rule would eventually put a note in the wrong bucket and drop it.
   */
  notes: string[];
  /** Sources that could not be read, as "Publisher — Label: reason". */
  feedNotes: string[];
}

export const emptySnapshot = (weekKey: string, fetchedAt = new Date().toISOString()): ReachSnapshot => ({
  weekKey,
  fetchedAt,
  companies: [],
  releases: [],
  notes: [],
  feedNotes: [],
});

/** One company out of a snapshot. Null when this week never looked it up. */
export function companyEvidence(snap: ReachSnapshot | null, ticker: string): CompanyEntry | null {
  if (!snap) return null;
  const t = ticker.trim().toUpperCase();
  return snap.companies.find((c) => c.ticker.toUpperCase() === t) ?? null;
}

/**
 * Normalized, de-duplicated ticker list, order preserved.
 *
 * Shape-checked as well as trimmed. The week's snapshot is shared state that
 * several runs read, so one caller passing something that is not a ticker must
 * not be able to put it there — a CLI bug did exactly that, storing an entry
 * named "--FORCE" and dropping eight real companies with it.
 */
const TICKER_SHAPE = /^[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*$/;

export const normalizeTickers = (tickers: string[]): string[] => [
  ...new Set(
    tickers
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0 && t.length <= 10 && TICKER_SHAPE.test(t)),
  ),
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
  known: Map<string, CompanyEntry>;
  /** This call's releases, or null to keep the week's existing list. */
  releases?: ReleaseItem[] | null;
  /** Source-level failures from this call's feed read. */
  feedNotes?: string[];
}): ReachSnapshot {
  const { weekKey, fetchedAt, prior, wanted, known } = args;
  const asked = new Set(wanted);

  const leading = wanted.map((t) => known.get(t)).filter((c): c is CompanyEntry => c !== undefined);
  const trailing = [...known.entries()].filter(([t]) => !asked.has(t)).map(([, c]) => c);

  const companies = [...leading, ...trailing];

  // A note describes a company in the snapshot. Keep a prior note only when
  // this call did not re-read that ticker AND the ticker is still held —
  // otherwise a force that drops a company leaves its note behind for ever,
  // describing something no longer there. (Observed: a CLI bug stored a
  // company named "--FORCE"; removing it left its note permanently stuck.)
  const held = new Set(companies.map((c) => c.ticker.toUpperCase()));
  const noteSubject = (n: string) => n.split(":")[0]?.trim().toUpperCase() ?? "";
  const freshNotes = leading.filter((c) => c.unavailable).map((c) => `${c.ticker}: ${c.unavailable}`);
  const keptNotes = (prior?.notes ?? []).filter(
    (n) => !asked.has(noteSubject(n)) && held.has(noteSubject(n)),
  );

  // Releases are week-level: a call that did not read them keeps what the week
  // already had, so adding one candidate never silently empties the list every
  // other candidate's cells were shown. Their notes travel with them.
  const readFeeds = args.releases !== undefined && args.releases !== null;

  return {
    weekKey,
    fetchedAt,
    companies,
    releases: readFeeds ? args.releases! : (prior?.releases ?? []),
    notes: [...keptNotes, ...freshNotes],
    feedNotes: readFeeds ? (args.feedNotes ?? []) : (prior?.feedNotes ?? []),
  };
}
