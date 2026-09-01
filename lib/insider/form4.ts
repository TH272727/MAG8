import { edgarFetch, EdgarError } from "../edgar";
import { elementBlocks, elementText, hasElement, tagRe } from "../xml";

/* ============================================================================
 * Form 4 — enumeration and parsing.
 *
 * A Form 4 is a corporate insider telling the public what they just did with
 * their own shares, within two business days, because the law requires it. That
 * makes it the one place where the people who know the most about a business
 * are compelled to show their hand — and the reason this scanner starts here
 * rather than by screening the whole market for cheap stocks.
 *
 * TWO FEEDS, VERIFIED LIVE 2026-08-31.
 *
 * 1. The daily index — one file per trading day listing every filing accepted
 *    that day. On 2026-08-28 it carried 811 Form 4 rows covering 382 distinct
 *    filings: the index emits one row PER FILER, so a filing appears once under
 *    its issuer and once under each reporting owner. 381 of those 382 filings
 *    had a row whose CIK is a listed issuer, which is what makes it possible to
 *    know the company — and therefore whether we care — BEFORE fetching a
 *    single document. Restricting to the screened universe drops roughly three
 *    quarters of the market's filings unfetched.
 *
 * 2. The filing itself, as the complete submission text file at the path the
 *    index gives. That one document carries both the SEC header and the inline
 *    ownership XML, so there is no index.json round-trip: one fetch, ~12 KB.
 *
 * Neither feed is written to the shared response cache. Parsed transactions are
 * stored permanently in the scanner's own table and the walked days are
 * recorded, so re-reading either would be pure waste — and caching sixty
 * 1.3 MB index files plus thousands of documents would put ~150 MB of
 * already-digested bytes in the database.
 *
 * THINGS THE FORMAT DOES THAT WILL PRODUCE A WRONG NUMBER IF IGNORED, each
 * observed in a single day's filings rather than imagined:
 *
 *  - Booleans arrive as `1`/`0` AND as `true`/`false`, from different filing
 *    agents, in the same day. A parser comparing against "true" silently reads
 *    every `1` as false — which would report genuinely pre-planned purchases as
 *    discretionary, i.e. as the higher-conviction kind.
 *  - `reportingOwnerRelationship` omits the flags that are false rather than
 *    setting them. Absent means absent; it does not mean stated-and-negative.
 *  - One filing can carry several `reportingOwner` blocks, and its transactions
 *    belong to the group collectively, not to each owner separately. Attributing
 *    a purchase to every owner would multiply the dollars by the number of
 *    filers.
 *  - Most values sit inside a nested `<value>` element, alongside `footnoteId`
 *    siblings — but `transactionCode` does not. Reading the wrong depth returns
 *    markup or nothing.
 *  - `transactionPricePerShare` can be present and empty. Treating that as zero
 *    would silently shrink a cluster's total instead of flagging it.
 * ========================================================================== */

/**
 * Whether the filer affirmed the trade was made under a pre-arranged plan.
 * Three states, deliberately: an absent affirmation is NOT a statement that the
 * trade was discretionary, and must never be scored as one.
 */
export type PlannedTradeState = "yes" | "no" | "not-stated";

export interface Form4Owner {
  cik: string;
  name: string;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther: boolean;
  /** As filed, e.g. "Chief Financial Officer". Null when not an officer or left blank. */
  officerTitle: string | null;
}

export interface Form4Transaction {
  /** Position within the filing's non-derivative table, 1-based. */
  line: number;
  securityTitle: string;
  /** YYYY-MM-DD. Empty only if the filing omitted it. */
  transactionDate: string;
  /** P purchase · S sale · A grant · M option exercise · F tax withholding · G gift · … */
  code: string;
  /** A acquired · D disposed. */
  acquiredDisposed: "A" | "D" | "";
  shares: number | null;
  pricePerShare: number | null;
  sharesAfter: number | null;
  /** D direct · I indirect (held through a trust, fund or family member). */
  ownership: "D" | "I" | "";
  /** Per-line parse notes, e.g. a purchase filed without a price. */
  flags: string[];
}

export interface Form4Document {
  accession: string;
  issuerCik: string;
  issuerName: string;
  /** Uppercased. Empty when the filer left it blank, which happens. */
  ticker: string;
  /** The date the transactions occurred on, as the filing reports it. */
  periodOfReport: string;
  /** The date SEC accepted the filing. Supplied by the caller from the index. */
  filedDate: string;
  owners: Form4Owner[];
  planned: PlannedTradeState;
  transactions: Form4Transaction[];
  flags: string[];
}

/* ----------------------------------------------------------------------------
 * Field readers
 * -------------------------------------------------------------------------- */

/**
 * XML booleans as SEC's filing agents actually write them.
 *
 * Returns null for absent or unrecognized, so a caller can tell "the filer said
 * no" from "the filer said nothing" — a distinction this scanner scores on.
 */
export function parseXmlBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "y" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "n" || v === "no") return false;
  return null;
}

/** The inner XML of one element, or empty. */
function block(xml: string, name: string): string {
  return tagRe(name).exec(xml)?.[1] ?? "";
}

/**
 * A value wrapped one level deep: `<transactionShares><value>756</value></…>`.
 * Returns empty for both an absent element and a present-but-empty one; callers
 * that care about the difference use `hasElement`.
 */
function wrapped(xml: string, name: string): string {
  const inner = block(xml, name);
  return inner ? elementText(inner, "value") : "";
}

/** A wrapped numeric value. Null — never zero — when absent or unreadable. */
function wrappedNumber(xml: string, name: string): number | null {
  const raw = wrapped(xml, name).replace(/,/g, "");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ----------------------------------------------------------------------------
 * The parser
 * -------------------------------------------------------------------------- */

/**
 * Parse one Form 4 (or Form 5) ownership document.
 *
 * Accepts either the bare ownership XML or the complete submission text file
 * that wraps it — the daily-index path serves the latter, and slicing the XML
 * out of it here keeps that detail from leaking into the fetch layer.
 *
 * Only NON-DERIVATIVE transactions are returned. Derivative activity is options
 * and warrants, which is a different question about a different instrument, and
 * folding it in would let an option grant read as somebody buying stock.
 */
export function parseForm4(raw: string, meta: { accession: string; filedDate: string }): Form4Document | null {
  const doc = block(raw, "ownershipDocument");
  if (!doc) return null;

  const flags: string[] = [];
  const issuer = block(doc, "issuer");
  const issuerCik = elementText(issuer, "issuerCik").replace(/\D/g, "");
  const ticker = elementText(issuer, "issuerTradingSymbol").trim().toUpperCase();
  if (!ticker) flags.push("The filing does not name a trading symbol for the issuer.");

  const owners: Form4Owner[] = elementBlocks(doc, "reportingOwner").map((o) => {
    const rel = block(o, "reportingOwnerRelationship");
    // Absent flags are absent, not false-as-stated — but for role purposes an
    // unstated role is not a claimed one, so both read as "not this role".
    const title = elementText(rel, "officerTitle").trim();
    return {
      cik: elementText(block(o, "reportingOwnerId"), "rptOwnerCik").replace(/\D/g, ""),
      name: elementText(block(o, "reportingOwnerId"), "rptOwnerName").trim(),
      isDirector: parseXmlBool(elementText(rel, "isDirector")) === true,
      isOfficer: parseXmlBool(elementText(rel, "isOfficer")) === true,
      isTenPercentOwner: parseXmlBool(elementText(rel, "isTenPercentOwner")) === true,
      isOther: parseXmlBool(elementText(rel, "isOther")) === true,
      officerTitle: title === "" ? null : title,
    };
  });
  if (owners.length === 0) flags.push("The filing names no reporting owner.");
  if (owners.length > 1) {
    // Load-bearing: the transactions below belong to this group collectively.
    flags.push(
      `Filed jointly by ${owners.length} reporting owners; the transactions below were made by them as a ` +
        "group and are counted once, not once per filer.",
    );
  }

  const plannedRaw = elementText(doc, "aff10b5One");
  let planned: PlannedTradeState = "not-stated";
  if (hasElement(doc, "aff10b5One")) {
    const b = parseXmlBool(plannedRaw);
    planned = b === true ? "yes" : b === false ? "no" : "not-stated";
  }
  if (planned === "not-stated" && /10b5-?1/i.test(block(doc, "footnotes"))) {
    flags.push(
      "A footnote refers to a pre-arranged trading plan, but the filing carries no structured affirmation " +
        "either way, so the trade is reported as unstated rather than as planned.",
    );
  }

  const table = block(doc, "nonDerivativeTable");
  const transactions: Form4Transaction[] = elementBlocks(table, "nonDerivativeTransaction").map((t, i) => {
    const coding = block(t, "transactionCoding");
    const amounts = block(t, "transactionAmounts");
    const code = elementText(coding, "transactionCode").trim().toUpperCase();
    const ad = wrapped(amounts, "transactionAcquiredDisposedCode").trim().toUpperCase();
    const shares = wrappedNumber(amounts, "transactionShares");
    const price = wrappedNumber(amounts, "transactionPricePerShare");
    const date = wrapped(t, "transactionDate").trim();
    const own = wrapped(block(t, "ownershipNature"), "directOrIndirectOwnership").trim().toUpperCase();

    const lineFlags: string[] = [];
    // A purchase with no readable price contributes no dollars. Say so rather
    // than letting it sum in as zero and quietly shrink the cluster.
    if (code === "P" && price === null) {
      lineFlags.push("This purchase was filed without a readable price, so it adds no dollars to the total.");
    }
    if (code === "P" && shares === null) {
      lineFlags.push("This purchase was filed without a readable share count.");
    }
    if (date !== "" && !ISO_DATE.test(date)) {
      lineFlags.push(`The transaction date "${date}" is not a recognizable date.`);
    }

    return {
      line: i + 1,
      securityTitle: wrapped(t, "securityTitle"),
      transactionDate: ISO_DATE.test(date) ? date : "",
      code,
      acquiredDisposed: ad === "A" || ad === "D" ? ad : "",
      shares,
      pricePerShare: price,
      sharesAfter: wrappedNumber(block(t, "postTransactionAmounts"), "sharesOwnedFollowingTransaction"),
      ownership: own === "D" || own === "I" ? own : "",
      flags: lineFlags,
    };
  });

  return {
    accession: meta.accession,
    issuerCik,
    issuerName: elementText(issuer, "issuerName").trim(),
    ticker,
    periodOfReport: elementText(doc, "periodOfReport").trim(),
    filedDate: meta.filedDate,
    owners,
    planned,
    transactions,
    flags,
  };
}

/* ----------------------------------------------------------------------------
 * What counts as a buy
 * -------------------------------------------------------------------------- */

/**
 * A genuine open-market purchase, and nothing else.
 *
 * Code P acquired is somebody choosing to spend their own money at the going
 * price. Everything else on a Form 4 is something that happened TO the insider
 * rather than something they decided: A is a grant from the company, M is an
 * option exercise, F is shares withheld to pay the tax on one, G is a gift, S
 * is a sale. Counting any of those as buying is the single easiest way to build
 * a scanner that finds insider conviction where none exists.
 */
export interface TradeLine {
  code: string;
  acquiredDisposed: string;
  shares: number | null;
}

export function isQualifyingBuy(t: TradeLine): boolean {
  return t.code === "P" && t.acquiredDisposed === "A" && (t.shares ?? 0) > 0;
}

/** A disposal for value — needed for the "insiders resumed selling" falsifier. */
export function isOpenMarketSale(t: TradeLine): boolean {
  return t.code === "S" && t.acquiredDisposed === "D" && (t.shares ?? 0) > 0;
}

/** Dollars actually spent on one line. Null when the filing did not say. */
export function transactionValueUsd(t: { shares: number | null; price: number | null }): number | null {
  if (t.shares === null || t.price === null) return null;
  return t.shares * t.price;
}

/* ----------------------------------------------------------------------------
 * The daily index
 * -------------------------------------------------------------------------- */

export interface IndexEntry {
  form: string;
  companyName: string;
  cik: number;
  /** YYYY-MM-DD. */
  filedDate: string;
  /** "0001610717-26-000393" */
  accession: string;
  /** Archives-relative path to the complete submission text file. */
  path: string;
}

/** YYYY-MM-DD → the EDGAR daily-index URL for that day. */
export function dailyIndexUrl(day: string): string {
  const [y, m] = day.split("-");
  const quarter = Math.floor((Number(m) - 1) / 3) + 1;
  return `https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${quarter}/form.${day.replace(/-/g, "")}.idx`;
}

/**
 * Rows of one daily index, filtered to a form type.
 *
 * The columns are nominally fixed-width but the widths differ between files,
 * and company names contain both spaces and commas, so the line is matched from
 * the END — where CIK, date and path are unambiguous — and whatever remains in
 * the middle is the name.
 */
export function parseDailyIndex(text: string, form = "4"): IndexEntry[] {
  const wanted = form.toUpperCase();
  const out: IndexEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\S+)\s+(.*?)\s+(\d{1,10})\s+(\d{8})\s+(edgar\/data\/\d+\/([\d-]+)\.txt)\s*$/.exec(line);
    if (!m) continue;
    if (m[1].toUpperCase() !== wanted) continue;
    const d = m[4];
    out.push({
      form: m[1].toUpperCase(),
      companyName: m[2].trim(),
      cik: Number(m[3]),
      filedDate: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      accession: m[6],
      path: m[5],
    });
  }
  return out;
}

/**
 * Collapse the index's per-filer rows into one entry per filing, keeping the
 * row whose CIK belongs to a company we care about.
 *
 * This is the whole reason the scan is affordable: it decides which filings are
 * worth fetching using bytes already in hand. A filing with no row for a wanted
 * issuer is dropped without ever being opened.
 */
export function filingsForIssuers(entries: IndexEntry[], issuerCiks: Set<number>): IndexEntry[] {
  const byAccession = new Map<string, IndexEntry>();
  for (const e of entries) {
    if (!issuerCiks.has(e.cik)) continue;
    const prev = byAccession.get(e.accession);
    // A filing can name two wanted CIKs (an issuer that is itself an insider of
    // another). Keep one; which one does not matter, the document is the same.
    if (!prev) byAccession.set(e.accession, e);
  }
  return [...byAccession.values()];
}

/* ----------------------------------------------------------------------------
 * Fetching
 * -------------------------------------------------------------------------- */

export interface FetchDayResult {
  day: string;
  ok: boolean;
  /** Form 4 filings listed for the day, before any issuer filter. */
  filings: IndexEntry[];
  /** Set when SEC has no index for this date — a weekend, a holiday, or today. */
  noSession: boolean;
  /** True when the absence was reported as 403 rather than 404. See below. */
  refused: boolean;
  note?: string;
}

/**
 * One day of the daily index.
 *
 * VERIFIED 2026-08-31, and the reason this does not simply check for 404:
 * **an index file that does not exist is answered with 403, not 404.** A
 * Saturday, a Sunday, a market holiday, today before the feed is published, and
 * an outright fabricated date all return 403 with a 230-byte body. Only a real
 * trading day answers 200.
 *
 * Read literally through the shared client — which reports 403 as "almost
 * always a missing or malformed User-Agent", and is right to, because that is
 * what it means on every OTHER SEC endpoint — a sixty-day walk would declare a
 * broken configuration seventeen times over one ordinary set of weekends, and
 * would never record those days, so it would re-ask forever.
 *
 * So an absence is reported here as an absence, and `refused` records that it
 * came back as a refusal. The caller keeps the distinction alive: one refused
 * day among many is a weekend; EVERY day refused is a transport or credential
 * problem wearing a weekend's clothes, and must not be reported as a market
 * with no filings in it.
 */
export async function fetchIndexDay(day: string, opts: { timeoutMs?: number } = {}): Promise<FetchDayResult> {
  try {
    const body = await edgarFetch(dailyIndexUrl(day), { timeoutMs: opts.timeoutMs, cache: false });
    return { day, ok: true, filings: parseDailyIndex(body, "4"), noSession: false, refused: false };
  } catch (err) {
    if (err instanceof EdgarError && (err.status === 404 || err.status === 403)) {
      return {
        day,
        ok: true,
        filings: [],
        noSession: true,
        refused: err.status === 403,
        note: "no index published for this date",
      };
    }
    return {
      day,
      ok: false,
      filings: [],
      noSession: false,
      refused: false,
      note: err instanceof Error ? err.message : "the index could not be read",
    };
  }
}

/** One filing, fetched and parsed. Null when it could not be read or understood. */
export async function fetchFiling(
  entry: IndexEntry,
  opts: { timeoutMs?: number } = {},
): Promise<{ doc: Form4Document | null; note?: string }> {
  try {
    const body = await edgarFetch(`https://www.sec.gov/Archives/${entry.path}`, {
      timeoutMs: opts.timeoutMs,
      cache: false,
      accept: "application/xml,text/plain,*/*",
    });
    const doc = parseForm4(body, { accession: entry.accession, filedDate: entry.filedDate });
    if (!doc) return { doc: null, note: "the filing carries no ownership document" };
    return { doc };
  } catch (err) {
    return { doc: null, note: err instanceof Error ? err.message : "the filing could not be read" };
  }
}

/** Calendar days, newest first, ending today. */
export function recentDays(lookbackDays: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < lookbackDays; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
