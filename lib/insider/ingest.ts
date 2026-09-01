import {
  insiderWalkedDays,
  latestUniverseSnapshot,
  markInsiderDayWalked,
  saveInsiderTransactions,
  type InsiderTransactionRow,
} from "../db";
import { getTickerCikMap } from "../edgar";
import { insiderEnabled, insiderSettings } from "../insider-settings";
import { screenUniverse } from "../universe";
import { universeSettings } from "../universe-settings";
import {
  fetchFiling,
  fetchIndexDay,
  filingsForIssuers,
  isQualifyingBuy,
  recentDays,
  type Form4Document,
} from "./form4";

/* ============================================================================
 * Ingestion — the only part of the scanner that reaches the network for
 * filings, and the only part that writes them.
 *
 * The order is the whole design. Screening the market for beaten-down stocks
 * first would mean pulling years of price history for thousands of tickers
 * against free endpoints, to find that almost none of them has an insider
 * buying. Starting from the filings inverts that: insider purchases are rare,
 * so the expensive work only ever runs on names that already carry the signal.
 *
 * The universe is read STRICTLY read-only. A public product's refresh button
 * must never trigger the weekly market-wide screener fetch or persist a
 * snapshot, so this reads whatever snapshot is already on file and reports
 * plainly when there is none, rather than going and making one.
 * ========================================================================== */

export interface EligibleIssuers {
  /** CIK → ticker, for every company the weekly screen currently considers investable. */
  byCik: Map<number, string>;
  /** Eligible tickers with no CIK on SEC's register — reported, never silently dropped. */
  unmapped: string[];
  weekKey: string | null;
  note?: string;
}

/**
 * The companies worth spending filings on: whatever the Stage-0 screen last
 * found eligible, mapped to the CIKs the daily index speaks in.
 *
 * Reading the snapshot and re-screening it is a pure function over bytes
 * already stored, so this costs one database read and no network call. The one
 * request it can make is the ticker-to-CIK register, which is memoized for an
 * hour and cached for a day.
 */
export async function eligibleIssuers(opts: { timeoutMs?: number } = {}): Promise<EligibleIssuers> {
  const snapshot = latestUniverseSnapshot();
  if (!snapshot) {
    return {
      byCik: new Map(),
      unmapped: [],
      weekKey: null,
      note:
        "No weekly screen is on file, so there is no list of investable companies to match filings against. " +
        "The screen has to run once before the scanner can start.",
    };
  }

  const screened = screenUniverse(snapshot.rows, snapshot.extras, universeSettings());
  const wanted = new Map(screened.eligible.map((r) => [r.t.toUpperCase(), r]));
  const register = await getTickerCikMap({ timeoutMs: opts.timeoutMs });

  const byCik = new Map<number, string>();
  const unmapped: string[] = [];
  for (const ticker of wanted.keys()) {
    const cik = register.get(ticker);
    if (cik === undefined) {
      unmapped.push(ticker);
      continue;
    }
    // First ticker wins a shared CIK, matching the register's own convention.
    if (!byCik.has(cik)) byCik.set(cik, ticker);
  }

  return { byCik, unmapped, weekKey: snapshot.isoWeek };
}

/* ----------------------------------------------------------------------------
 * Filing → storable rows
 * -------------------------------------------------------------------------- */

/**
 * Flatten one parsed filing into rows.
 *
 * The reporting owners are attached to every line rather than multiplied out
 * into one row per owner. A jointly filed purchase was made once, by a group,
 * and duplicating it per filer would inflate both the dollar total and the
 * count of distinct insiders — the two numbers the conviction reading is built
 * from.
 *
 * The ticker comes from the index's issuer row when the filing itself left the
 * symbol blank, which does happen.
 */
export function toTransactionRows(doc: Form4Document, fallbackTicker: string): InsiderTransactionRow[] {
  const ticker = (doc.ticker || fallbackTicker).toUpperCase();
  return doc.transactions.map((t) => ({
    accession: doc.accession,
    line: t.line,
    ticker,
    issuerCik: Number(doc.issuerCik) || 0,
    issuerName: doc.issuerName,
    period: doc.periodOfReport,
    filedDate: doc.filedDate,
    // A filing missing its own transaction date falls back to the period it reports on.
    transactionDate: t.transactionDate || doc.periodOfReport,
    code: t.code,
    acquiredDisposed: t.acquiredDisposed,
    shares: t.shares,
    price: t.pricePerShare,
    sharesAfter: t.sharesAfter,
    ownership: t.ownership,
    planned: doc.planned,
    owners: doc.owners,
    flags: [...doc.flags, ...t.flags],
  }));
}

/* ----------------------------------------------------------------------------
 * The walk
 * -------------------------------------------------------------------------- */

export interface IngestReport {
  takenAt: string;
  lookbackDays: number;
  eligibleIssuers: number;
  unmappedTickers: number;
  universeWeek: string | null;
  daysConsidered: number;
  daysAlreadyOnRecord: number;
  daysRead: number;
  daysFailed: number;
  daysWithoutSession: number;
  filingsListed: number;
  filingsMatched: number;
  filingsRead: number;
  filingsFailed: number;
  linesStored: number;
  buyLines: number;
  /** True when not one day could be read — the run is then reported, not published. */
  readNothing: boolean;
  disabled: boolean;
  notes: string[];
}

export interface IngestOptions {
  /** Override the settings window (the CLI's --days). */
  lookbackDays?: number;
  /** Walk and parse without writing anything. */
  dryRun?: boolean;
  /** Re-read days already on record. */
  force?: boolean;
  now?: Date;
  onProgress?: (line: string) => void;
}

/**
 * Walk the daily index backwards, fetch every Form 4 filed by a company the
 * weekly screen considers investable, and store its transaction lines.
 *
 * Incremental by construction: a day that has been read is recorded, and a
 * filing is immutable once accepted, so a weekly re-run reads only the days
 * that have appeared since. A day whose index cannot be fetched is NOT recorded
 * and is simply retried next time — the one thing worse than a missing day is a
 * missing day the scanner believes it already has.
 */
export async function ingestFilings(opts: IngestOptions = {}): Promise<IngestReport> {
  const takenAt = new Date().toISOString();
  const s = insiderSettings();
  const lookbackDays = opts.lookbackDays ?? s.lookbackDays;
  const say = opts.onProgress ?? (() => undefined);

  const base: IngestReport = {
    takenAt,
    lookbackDays,
    eligibleIssuers: 0,
    unmappedTickers: 0,
    universeWeek: null,
    daysConsidered: 0,
    daysAlreadyOnRecord: 0,
    daysRead: 0,
    daysFailed: 0,
    daysWithoutSession: 0,
    filingsListed: 0,
    filingsMatched: 0,
    filingsRead: 0,
    filingsFailed: 0,
    linesStored: 0,
    buyLines: 0,
    readNothing: true,
    disabled: false,
    notes: [],
  };

  if (!insiderEnabled()) return { ...base, disabled: true };

  const issuers = await eligibleIssuers({ timeoutMs: s.fetchTimeoutMs });
  if (issuers.note) base.notes.push(issuers.note);
  base.eligibleIssuers = issuers.byCik.size;
  base.unmappedTickers = issuers.unmapped.length;
  base.universeWeek = issuers.weekKey;
  if (issuers.byCik.size === 0) {
    return { ...base, notes: [...base.notes, "Nothing was fetched, because there is nothing to match against."] };
  }
  if (issuers.unmapped.length > 0) {
    base.notes.push(
      `${issuers.unmapped.length} screened compan${issuers.unmapped.length === 1 ? "y is" : "ies are"} not on ` +
        "the filings register under that symbol, so their insider filings cannot be found. Foreign issuers " +
        "filing under a different identifier are the usual reason.",
    );
  }

  const wantedCiks = new Set(issuers.byCik.keys());
  const onRecord = opts.force ? new Map() : insiderWalkedDays();
  const days = recentDays(lookbackDays, opts.now);
  base.daysConsidered = days.length;

  let anyDayRead = false;
  let daysAttempted = 0;
  let daysRefused = 0;
  for (const day of days) {
    if (onRecord.has(day)) {
      base.daysAlreadyOnRecord++;
      continue;
    }
    daysAttempted++;
    const index = await fetchIndexDay(day, { timeoutMs: s.fetchTimeoutMs });
    if (!index.ok) {
      base.daysFailed++;
      base.notes.push(`${day}: ${index.note ?? "the index could not be read"}`);
      continue;
    }
    if (index.noSession) {
      base.daysWithoutSession++;
      if (index.refused) daysRefused++;
      if (!opts.dryRun) {
        markInsiderDayWalked({ day, filingsListed: 0, filingsFetched: 0, noSession: true });
      }
      continue;
    }
    anyDayRead = true;
    base.daysRead++;

    const matched = filingsForIssuers(index.filings, wantedCiks);
    base.filingsListed += index.filings.length;
    base.filingsMatched += matched.length;
    say(
      `${day}  ${String(index.filings.length).padStart(4)} filings listed · ` +
        `${String(matched.length).padStart(3)} from screened companies`,
    );

    let fetched = 0;
    const rows: InsiderTransactionRow[] = [];
    for (const entry of matched) {
      const { doc, note } = await fetchFiling(entry, { timeoutMs: s.fetchTimeoutMs });
      if (!doc) {
        base.filingsFailed++;
        if (base.notes.length < 40) base.notes.push(`${entry.accession}: ${note ?? "unreadable"}`);
        continue;
      }
      fetched++;
      base.filingsRead++;
      rows.push(...toTransactionRows(doc, issuers.byCik.get(entry.cik) ?? ""));
    }

    base.buyLines += rows.filter(isQualifyingBuy).length;

    if (!opts.dryRun) {
      base.linesStored += saveInsiderTransactions(rows);
      markInsiderDayWalked({
        day,
        filingsListed: index.filings.length,
        filingsFetched: fetched,
        noSession: false,
      });
    } else {
      base.linesStored += rows.length;
    }
  }

  /*
   * SEC reports an absent daily index as a refusal rather than as a missing
   * file, so a weekend and a rejected client look identical one day at a time.
   * They are told apart in aggregate: a handful of refusals among days that did
   * return filings is the calendar; every single day refused is the connection.
   * Reporting the second as "no filings were made" would be a market claim
   * invented out of a transport fault.
   */
  const allRefused = daysAttempted > 0 && daysRefused === daysAttempted;
  if (allRefused) {
    base.notes.push(
      `All ${daysAttempted} days in the window were refused by SEC. A refusal is also how an ordinary ` +
        "weekend looks, but a run of them this long is not a calendar — it is the connection or the " +
        "identifying header. Nothing was treated as a market observation.",
    );
  }

  base.readNothing = !anyDayRead && base.daysAlreadyOnRecord === 0;
  if (base.readNothing && !allRefused) {
    base.notes.push(
      "Not one day of filings could be read, so nothing was stored and whatever was already on record is " +
        "unchanged. This is a transport failure, not a market observation.",
    );
  }
  if (allRefused) base.readNothing = true;
  return base;
}
