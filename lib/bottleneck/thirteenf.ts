import {
  fetchFilingDocument,
  fullTextSearch,
  getFilingIndex,
  getSubmissions,
  type EdgarFiling,
} from "../edgar";
import { getFilingSnapshot, saveFilingSnapshot } from "../db";
import { bottleneckSettings } from "../bottleneck-settings";
import { isUsListing, resolveCusips, type ResolutionSource } from "./cusip";
import { elementBlocks, elementText, tagRe } from "../xml";

/* ============================================================================
 * Module A — the institutional clone.
 *
 * Form 13F-HR is the only window the public gets into what a large manager
 * owns, and it is a narrow one: quarter-end positions, long US equity only,
 * filed up to 45 days later by rule. Everything here is built so that window's
 * limits stay visible rather than getting lost behind a clean-looking table.
 *
 * Three things about the format are load-bearing and each has bitten:
 *
 *  1. VALUES CHANGED UNITS. Filings made on or after 2023-01-03 report value in
 *     whole DOLLARS; before that date, in THOUSANDS. Reading a pre-2023 filing
 *     under the current convention understates a book by exactly 1000×.
 *
 *  2. THE XML COMES IN TWO SHAPES. The same filer ships `<infoTable>` and
 *     `<ns1:infoTable>` depending on which agent transmitted it. A prefix-blind
 *     parser returns zero holdings and no error at all.
 *
 *  3. THE INFORMATION TABLE'S FILENAME VARIES. `form13fInfoTable.xml`,
 *     `SALP13FinfotableQ3.xml`, others. The filing index has to be read and
 *     pattern-matched. `primaryDocument` is NOT a fallback: on a 13F it points
 *     at an XSL cover-page path, which parses to nothing.
 *
 * Options are parsed and kept visible. A clone that silently drops the puts and
 * calls reports a manager as differently positioned than they are.
 * ========================================================================== */

/**
 * The date Form 13F values switched from thousands of dollars to whole dollars
 * (SEC Release 34-95607). Branches on the FILING date, not the period: the
 * requirement attaches to the submission.
 */
export const DOLLAR_CONVENTION_FROM = "2023-01-03";

/** Multiplier turning a filing's `value` field into USD. */
export function valueScale(filingDate: string): 1 | 1000 {
  return filingDate >= DOLLAR_CONVENTION_FROM ? 1 : 1000;
}

/**
 * Rule 13f-1's reporting threshold. A manager files only once it exercises
 * discretion over $100M or more of section 13(f) securities, which makes it a
 * free independent check on the units above: a filed 13F whose book computes to
 * less than this has almost certainly been read under the wrong convention.
 */
export const REPORTING_THRESHOLD_USD = 100_000_000;

/* ----------------------------------------------------------------------------
 * Parsing
 * -------------------------------------------------------------------------- */

export interface RawHolding {
  nameOfIssuer: string;
  titleOfClass: string;
  cusip: string;
  /** Present only since 2023; absent from most filings. */
  figi?: string;
  /** The `value` field exactly as filed — unscaled. */
  valueAsFiled: number;
  shares: number;
  /** SH = shares, PRN = principal amount of a debt instrument. */
  shareType: string;
  /** Absent on plain stock; title case ("Put"/"Call") when present. */
  putCall: "Put" | "Call" | null;
  investmentDiscretion: string;
  otherManager: string | null;
  voting: { sole: number; shared: number; none: number };
}

/**
 * Element reading is shared (lib/xml.ts) so this parser and the Form 4 parser
 * cannot drift into two XML styles. `text` keeps its local name here: the
 * padding on `titleOfClass` and the namespace-agnostic matching are the same
 * problem the shared helper solves.
 */
const text = elementText;

function numberIn(block: string, name: string): number {
  const raw = text(block, name).replace(/,/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Split the document into `<infoTable>` blocks, whatever prefix they carry. */
function infoTableBlocks(xml: string): string[] {
  return elementBlocks(xml, "infoTable");
}

/** How many holdings rows a document contains — used to pick the right file. */
export const countInfoTableRows = (xml: string): number => infoTableBlocks(xml).length;

/**
 * Parse an information table into raw rows. Values stay exactly as filed; the
 * unit convention is applied later, where the filing date is in scope.
 */
export function parseInfoTable(xml: string): RawHolding[] {
  return infoTableBlocks(xml).map((block) => {
    const voting = tagRe("votingAuthority").exec(block)?.[1] ?? "";
    const amounts = tagRe("shrsOrPrnAmt").exec(block)?.[1] ?? block;
    const putCallRaw = text(block, "putCall");
    const figi = text(block, "figi");
    const otherManager = text(block, "otherManager");
    return {
      nameOfIssuer: text(block, "nameOfIssuer"),
      titleOfClass: text(block, "titleOfClass"),
      cusip: text(block, "cusip").toUpperCase(),
      ...(figi ? { figi } : {}),
      valueAsFiled: numberIn(block, "value"),
      shares: numberIn(amounts, "sshPrnamt"),
      shareType: text(amounts, "sshPrnamtType") || "SH",
      // Title case as filed; anything else is treated as absent rather than guessed at.
      putCall: putCallRaw === "Put" || putCallRaw === "Call" ? putCallRaw : null,
      investmentDiscretion: text(block, "investmentDiscretion"),
      // A literal "0" is how filers encode "no other manager" — as common as omitting it.
      otherManager: otherManager && otherManager !== "0" ? otherManager : null,
      voting: {
        sole: numberIn(voting, "Sole"),
        shared: numberIn(voting, "Shared"),
        none: numberIn(voting, "None"),
      },
    };
  });
}

/* ----------------------------------------------------------------------------
 * A parsed filing
 * -------------------------------------------------------------------------- */

export interface Holding extends RawHolding {
  /** Value in USD, after the thousands/dollars convention for this filing date. */
  valueUsd: number;
  ticker: string | null;
  /** How the ticker was established — a name match is weaker than an identifier match. */
  resolvedBy: ResolutionSource;
  /** Share of the filing's total long-stock value. Null on option rows. */
  pctOfLong: number | null;
}

export interface ThirteenFFiling {
  cik: number;
  filerName: string;
  /** Period of report, YYYY-MM-DD. */
  period: string;
  filedAt: string;
  accession: string;
  form: string;
  /** The information-table document actually read. */
  infoTableFile: string;
  /** 1 for dollars, 1000 for the pre-2023 thousands convention. */
  valueScale: 1 | 1000;
  /** Days between period end and filing — the disclosure lag, measured not assumed. */
  lagDays: number;
  long: Holding[];
  options: Holding[];
  totals: {
    longUsd: number;
    optionsUsd: number;
    positions: number;
    longPositions: number;
    optionPositions: number;
    unresolved: number;
    /** Rows identified only by a foreign venue symbol — named, but not buyable here. */
    foreignOnly: number;
  };
  sourceUrl: string;
}

const day = 86_400_000;

/** Attach USD values, tickers and weights to raw rows. Pure. */
export function buildHoldings(
  rows: RawHolding[],
  scale: 1 | 1000,
  tickers: Map<string, { ticker: string | null; source: ResolutionSource }>,
): { long: Holding[]; options: Holding[]; longUsd: number; optionsUsd: number } {
  const priced = rows.map((r) => {
    const hit = tickers.get(r.cusip);
    return {
      ...r,
      valueUsd: r.valueAsFiled * scale,
      ticker: hit?.ticker ?? null,
      resolvedBy: hit?.source ?? "unresolved",
      pctOfLong: null as number | null,
    };
  });

  const long = priced.filter((r) => r.putCall === null);
  const options = priced.filter((r) => r.putCall !== null);
  const longUsd = long.reduce((s, r) => s + r.valueUsd, 0);
  const optionsUsd = options.reduce((s, r) => s + r.valueUsd, 0);

  for (const r of long) r.pctOfLong = longUsd > 0 ? (r.valueUsd / longUsd) * 100 : null;
  long.sort((a, b) => b.valueUsd - a.valueUsd);
  options.sort((a, b) => b.valueUsd - a.valueUsd);
  return { long, options, longUsd, optionsUsd };
}

/* ----------------------------------------------------------------------------
 * Filing discovery
 * -------------------------------------------------------------------------- */

/** 13F-HR and its amendments. 13F-NT is a notice — it carries no holdings at all. */
const HOLDINGS_FORM = /^13F-HR(\/A)?$/i;

/**
 * One filing per period, newest submission winning — an amendment supersedes
 * the original for the same quarter. Newest period first.
 */
export function latestPerPeriod(filings: EdgarFiling[]): EdgarFiling[] {
  const byPeriod = new Map<string, EdgarFiling>();
  for (const f of filings) {
    if (!HOLDINGS_FORM.test(f.form) || !f.reportDate) continue;
    const held = byPeriod.get(f.reportDate);
    if (!held || f.filingDate > held.filingDate) byPeriod.set(f.reportDate, f);
  }
  return [...byPeriod.values()].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

/**
 * The information table inside a filing. Filenames vary by agent, so the index
 * is read and pattern-matched; `primaryDocument` is deliberately not consulted
 * (on a 13F it is an XSL cover-page path that contains no holdings).
 */
export function pickInfoTableFile(files: { name: string; size: number }[]): string | null {
  const xml = files.filter((f) => /\.xml$/i.test(f.name) && !/^xsl/i.test(f.name));
  const named = xml.filter((f) => /info.?table/i.test(f.name));
  const pool = named.length > 0 ? named : xml.filter((f) => !/primary_?doc/i.test(f.name));
  if (pool.length === 0) return null;
  // Ties go to the largest file: the information table is invariably the bulky one.
  return [...pool].sort((a, b) => b.size - a.size)[0].name;
}

/* ----------------------------------------------------------------------------
 * Loading
 * -------------------------------------------------------------------------- */

export interface LoadOptions {
  timeoutMs?: number;
  /** Skip the CUSIP mapping service (cache + universe snapshot only). */
  offline?: boolean;
  /** Ignore any stored parse of this period and re-read the filing. */
  force?: boolean;
}

export class ThirteenFError extends Error {
  constructor(
    message: string,
    readonly code: "no-filings" | "no-info-table" | "empty-table",
  ) {
    super(message);
    this.name = "ThirteenFError";
  }
}

const archiveUrl = (cik: number, accession: string, file: string) =>
  `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/${file}`;

/**
 * Read one 13F filing end to end: locate its information table, parse it,
 * resolve identifiers, compute weights, persist the result.
 *
 * A stored parse for the same (cik, period) is reused unless `force` is set —
 * a filed 13F never changes, and an amendment arrives as a new accession which
 * `latestPerPeriod` picks up.
 */
export async function loadFiling(
  cik: number,
  filerName: string,
  filing: EdgarFiling,
  opts: LoadOptions = {},
): Promise<ThirteenFFiling> {
  const timeoutMs = opts.timeoutMs ?? bottleneckSettings().edgarTimeoutMs;

  if (!opts.force) {
    const stored = getFilingSnapshot<ThirteenFFiling>(cik, filing.reportDate);
    if (stored && stored.accession === filing.accessionNumber) return stored.rows;
  }

  const files = await getFilingIndex(cik, filing.accessionNumber, { timeoutMs });
  const infoTableFile = pickInfoTableFile(files);
  if (!infoTableFile) {
    throw new ThirteenFError(
      `No information table in ${filing.accessionNumber} (files: ${files.map((f) => f.name).join(", ") || "none"}).`,
      "no-info-table",
    );
  }

  const xml = await fetchFilingDocument(cik, filing.accessionNumber, infoTableFile, { timeoutMs });
  const rows = parseInfoTable(xml);
  if (rows.length === 0) {
    throw new ThirteenFError(
      `${infoTableFile} parsed to zero holdings — the document may not be an information table.`,
      "empty-table",
    );
  }

  const resolutions = await resolveCusips(
    rows.map((r) => ({ cusip: r.cusip, issuerName: r.nameOfIssuer })),
    { timeoutMs, offline: opts.offline },
  );
  const tickers = new Map(
    [...resolutions.entries()].map(([cusip, r]) => [cusip, { ticker: r.ticker, source: r.source }]),
  );

  const scale = valueScale(filing.filingDate);
  const { long, options, longUsd, optionsUsd } = buildHoldings(rows, scale, tickers);

  const parsed: ThirteenFFiling = {
    cik,
    filerName,
    period: filing.reportDate,
    filedAt: filing.filingDate,
    accession: filing.accessionNumber,
    form: filing.form,
    infoTableFile,
    valueScale: scale,
    lagDays: Math.max(0, Math.round((Date.parse(filing.filingDate) - Date.parse(filing.reportDate)) / day)),
    long,
    options,
    totals: {
      longUsd,
      optionsUsd,
      positions: rows.length,
      longPositions: long.length,
      optionPositions: options.length,
      unresolved: [...long, ...options].filter((r) => r.ticker === null).length,
      foreignOnly: [...long, ...options].filter((r) => r.ticker !== null && !isUsListing(r.resolvedBy)).length,
    },
    sourceUrl: archiveUrl(cik, filing.accessionNumber, infoTableFile),
  };

  saveFilingSnapshot({
    cik,
    period: parsed.period,
    accession: parsed.accession,
    filerName,
    filedAt: parsed.filedAt,
    rows: parsed,
  });
  return parsed;
}

/* ----------------------------------------------------------------------------
 * Diffing
 * -------------------------------------------------------------------------- */

export type PositionChange = "new" | "increased" | "decreased" | "closed" | "unchanged";

export interface HoldingDiff {
  cusip: string;
  ticker: string | null;
  /** Carried through so a weak identification stays visible in the change list too. */
  resolvedBy: ResolutionSource;
  nameOfIssuer: string;
  change: PositionChange;
  sharesNow: number;
  sharesBefore: number;
  sharesDelta: number;
  /** Percentage change in share count. Null for a new or closed position. */
  sharesDeltaPct: number | null;
  pctOfLongNow: number | null;
  pctOfLongBefore: number | null;
  valueUsdNow: number;
  valueUsdBefore: number;
}

/** Same issuer filed twice (different share classes, or split lots) sums into one line. */
function byCusip(rows: Holding[]): Map<string, Holding & { shares: number; valueUsd: number }> {
  const out = new Map<string, Holding & { shares: number; valueUsd: number }>();
  for (const r of rows) {
    const held = out.get(r.cusip);
    if (held) {
      held.shares += r.shares;
      held.valueUsd += r.valueUsd;
      held.pctOfLong = (held.pctOfLong ?? 0) + (r.pctOfLong ?? 0);
    } else {
      out.set(r.cusip, { ...r });
    }
  }
  return out;
}

/**
 * Long-stock changes between two periods, classified by share count rather than
 * value: a position whose value moved only because the price moved has not been
 * traded, and calling that "increased" would invent activity that never happened.
 */
export function diffHoldings(current: Holding[], prior: Holding[]): HoldingDiff[] {
  const now = byCusip(current);
  const before = byCusip(prior);
  const cusips = new Set([...now.keys(), ...before.keys()]);

  const out: HoldingDiff[] = [];
  for (const cusip of cusips) {
    const a = now.get(cusip);
    const b = before.get(cusip);
    const sharesNow = a?.shares ?? 0;
    const sharesBefore = b?.shares ?? 0;
    const delta = sharesNow - sharesBefore;
    const change: PositionChange = !b
      ? "new"
      : !a
        ? "closed"
        : delta > 0
          ? "increased"
          : delta < 0
            ? "decreased"
            : "unchanged";
    out.push({
      cusip,
      ticker: a?.ticker ?? b?.ticker ?? null,
      resolvedBy: a?.resolvedBy ?? b?.resolvedBy ?? "unresolved",
      nameOfIssuer: a?.nameOfIssuer ?? b?.nameOfIssuer ?? "",
      change,
      sharesNow,
      sharesBefore,
      sharesDelta: delta,
      sharesDeltaPct: sharesBefore > 0 && sharesNow > 0 ? (delta / sharesBefore) * 100 : null,
      pctOfLongNow: a?.pctOfLong ?? null,
      pctOfLongBefore: b?.pctOfLong ?? null,
      valueUsdNow: a?.valueUsd ?? 0,
      valueUsdBefore: b?.valueUsd ?? 0,
    });
  }

  const ORDER: Record<PositionChange, number> = { new: 0, increased: 1, decreased: 2, closed: 3, unchanged: 4 };
  return out.sort(
    (x, y) => ORDER[x.change] - ORDER[y.change] || Math.max(y.valueUsdNow, y.valueUsdBefore) - Math.max(x.valueUsdNow, x.valueUsdBefore),
  );
}

/* ----------------------------------------------------------------------------
 * The clone
 * -------------------------------------------------------------------------- */

export interface ManagerMatch {
  cik: number;
  name: string;
  form: string;
  filingDate: string;
  period: string;
}

/**
 * Find 13F filers whose name matches. EDGAR's full-text search is the only free
 * name index, so this returns whatever it knows about, de-duplicated by CIK.
 */
export async function searchManagers(name: string, opts: { timeoutMs?: number } = {}): Promise<ManagerMatch[]> {
  const query = name.trim();
  if (query.length < 3) return [];
  const res = await fullTextSearch(query, {
    forms: ["13F-HR"],
    entityName: query,
    timeoutMs: opts.timeoutMs,
  });
  const byCik = new Map<number, ManagerMatch>();
  for (const hit of res.hits) {
    if (!hit.cik || byCik.has(hit.cik)) continue;
    byCik.set(hit.cik, {
      cik: hit.cik,
      name: hit.entityName,
      form: hit.form,
      filingDate: hit.filingDate,
      period: hit.reportDate,
    });
  }
  return [...byCik.values()];
}

export interface CloneResult {
  current: ThirteenFFiling;
  prior: ThirteenFFiling | null;
  diff: HoldingDiff[];
  /** Every period this filer has on file, newest first. */
  periods: { period: string; filedAt: string; form: string; accession: string }[];
  /** What a reader needs in order to read the clone correctly. */
  flags: string[];
}

/**
 * Clone one manager: the newest 13F-HR, the period before it, and the diff.
 * The prior period is best-effort — a first-time filer has none, and one
 * unreadable old filing must not cost the current one.
 */
export async function cloneManager(cik: number, opts: LoadOptions = {}): Promise<CloneResult> {
  const timeoutMs = opts.timeoutMs ?? bottleneckSettings().edgarTimeoutMs;
  const subs = await getSubmissions(cik, { timeoutMs });
  const filings = latestPerPeriod(subs.filings);
  if (filings.length === 0) {
    throw new ThirteenFError(
      `CIK ${cik} (${subs.name || "unknown filer"}) has no 13F-HR in its recent filing history.`,
      "no-filings",
    );
  }

  const current = await loadFiling(cik, subs.name, filings[0], { ...opts, timeoutMs });
  let prior: ThirteenFFiling | null = null;
  const flags: string[] = [];
  if (filings[1]) {
    try {
      prior = await loadFiling(cik, subs.name, filings[1], { ...opts, timeoutMs });
    } catch (err) {
      flags.push(
        `The prior period (${filings[1].reportDate}) could not be read, so no position changes are shown: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    flags.push(`This is the earliest 13F-HR on file for this manager, so there is no prior period to compare against.`);
  }

  return {
    current,
    prior,
    diff: prior ? diffHoldings(current.long, prior.long) : [],
    periods: filings.map((f) => ({
      period: f.reportDate,
      filedAt: f.filingDate,
      form: f.form,
      accession: f.accessionNumber,
    })),
    flags: [...flags, ...cloneFlags(current, prior)],
  };
}

/** Pure: everything about this clone a reader has to know before using it. */
export function cloneFlags(current: ThirteenFFiling, prior: ThirteenFFiling | null): string[] {
  const flags: string[] = [];

  flags.push(
    `Positions are as of ${current.period} and were filed ${current.filedAt}, ${current.lagDays} days later. ` +
      `Form 13F allows up to 45 days, so this is a picture of the past — the manager may have traded out of any ` +
      `of it since.`,
  );

  if (current.form.toUpperCase().endsWith("/A")) {
    flags.push(`This period is an amendment (${current.form}), which supersedes the original filing for ${current.period}.`);
  }

  if (current.valueScale === 1000) {
    flags.push(
      `Filed before 2023-01-03, when Form 13F reported values in thousands of dollars. Values shown are the ` +
        `filed figures multiplied by 1,000 to put them in dollars.`,
    );
  }

  // The threshold check reads the units back off the regulation itself.
  const book = current.totals.longUsd + current.totals.optionsUsd;
  if (book > 0 && book < REPORTING_THRESHOLD_USD) {
    flags.push(
      `This book totals ${Math.round(book).toLocaleString("en-US")} dollars, below the $100M threshold that ` +
        `obliges a manager to file at all. Either the manager has since fallen below it, or these values have ` +
        `been read under the wrong unit convention — treat the totals with suspicion until that is settled.`,
    );
  }

  if (current.totals.unresolved > 0) {
    flags.push(
      `${current.totals.unresolved} of ${current.totals.positions} rows could not be matched to a ticker and are ` +
        `shown by issuer name and CUSIP. They are still counted in the totals and percentages — dropping them ` +
        `would change every weight on the page.`,
    );
  }

  if (current.totals.foreignOnly > 0) {
    flags.push(
      `${current.totals.foreignOnly} row(s) resolved only to a foreign venue symbol. The identity is right and ` +
        `the symbol is shown, but it is not something to buy on a US exchange — a US line may exist under a ` +
        `different identifier, and the desk will not guess at one.`,
    );
  }

  if (current.totals.optionPositions > 0) {
    const pct = (current.totals.optionsUsd / (current.totals.longUsd + current.totals.optionsUsd)) * 100;
    flags.push(
      `Alongside the long stock, this filing reports ${current.totals.optionPositions} option position(s) worth ` +
        `${Math.round(pct * 100) / 100}% of the disclosed book. They are listed separately rather than folded in ` +
        `or discarded.`,
    );
  }

  flags.push(
    `A 13F shows long US-listed equity only. Short positions, cash, bonds, foreign listings and anything held ` +
      `outside the reporting manager are absent by rule — this is a partial view of a portfolio, not the portfolio.`,
  );

  if (prior && prior.valueScale !== current.valueScale) {
    flags.push(
      `The two periods were filed under different value conventions (thousands before 2023-01-03, dollars after). ` +
        `Both are normalized to dollars here; share counts, which never changed units, drive the position changes.`,
    );
  }

  return flags;
}

/* ----------------------------------------------------------------------------
 * Sizing — admin-only, a proposal and nothing else
 * -------------------------------------------------------------------------- */

export interface OrderProposal {
  ticker: string | null;
  nameOfIssuer: string;
  cusip: string;
  pctOfLong: number;
  suggestedUsd: number;
  /** Null when no price could be fetched — the dollar amount still stands. */
  price: number | null;
  suggestedShares: number | null;
  /** False when the row has no US-listed symbol; the dollar weight still applies. */
  usListed: boolean;
}

/**
 * Apply each holding's weight to an account balance. Pure — prices are passed
 * in, never fetched here, so the arithmetic is testable and the network stays
 * at the edge.
 *
 * A row without a US listing gets its dollar weight and no share count: a
 * foreign venue symbol is an identity, not something to enter into an order
 * ticket. This produces a list to look at either way. Nothing in this codebase
 * places an order, and no broker integration exists to place one through.
 */
export function sizeToBalance(
  long: Holding[],
  balanceUsd: number,
  prices: Map<string, number>,
  minPct = 0,
): OrderProposal[] {
  return long
    .filter((h) => (h.pctOfLong ?? 0) >= minPct)
    .map((h) => {
      const pct = h.pctOfLong ?? 0;
      const suggestedUsd = (pct / 100) * balanceUsd;
      const usListed = h.ticker !== null && isUsListing(h.resolvedBy);
      const price = usListed && h.ticker ? (prices.get(h.ticker) ?? null) : null;
      return {
        ticker: h.ticker,
        nameOfIssuer: h.nameOfIssuer,
        cusip: h.cusip,
        pctOfLong: pct,
        suggestedUsd,
        price,
        suggestedShares: price && price > 0 ? Math.floor(suggestedUsd / price) : null,
        usListed,
      };
    });
}
