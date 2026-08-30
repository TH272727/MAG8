import { getAppSettingJson, setAppSettingJson } from "../db";
import type { BottleneckSettings } from "../bottleneck-settings";
import type { Playbook } from "./playbook";
import type { BottleneckSnapshot } from "./score";

/* ============================================================================
 * Module D — the exposure audit.
 *
 * The desk has already worked out which physical input is tightest and who
 * produces it. This answers the only question that follows: given what is
 * actually held, how much of it sits with those producers.
 *
 * It reports and it flags. It does not propose a trade, rebalance anything, or
 * tell anyone what to own — the framework this implements is explicit that the
 * exposure audit is informational, and an instrument that starts recommending
 * stops being an instrument.
 *
 * Holdings live in ONE app_settings key. No accounts, no table, no brokerage
 * connection: a list of tickers and share counts is all the arithmetic needs,
 * and storing less of someone's portfolio than that is not possible.
 *
 * The honest caveat is stated wherever this renders: owning the producers of a
 * tightening input is not the same as being right about it. A constraint the
 * market has already priced pays nobody, and heavy spending has historically
 * predicted WORSE returns for the spender — so exposure to a bottleneck is a
 * position, not an edge.
 * ========================================================================== */

export interface Holding {
  ticker: string;
  shares: number;
  /** Total cost of the position, USD. Optional — nothing here requires it. */
  costBasis?: number;
}

export interface PricedHolding extends Holding {
  /** Latest price, USD. Null when no quote could be fetched. */
  price: number | null;
  /** shares × price. Null when unpriced — never silently zero. */
  valueUsd: number | null;
}

const HOLDINGS_KEY = "bottleneck_holdings";

/* ----------------------------------------------------------------------------
 * Input: CSV paste or manual entry
 * -------------------------------------------------------------------------- */

/** Column aliases people actually paste, from brokerage exports and by hand. */
const TICKER_KEYS = ["ticker", "symbol", "sym", "instrument", "security"];
const SHARE_KEYS = ["shares", "quantity", "qty", "units", "shares owned", "share count"];
const COST_KEYS = ["costbasis", "cost basis", "cost", "total cost", "book value", "basis"];

const clean = (s: string) => s.trim().replace(/^["']|["']$/g, "").trim();
const num = (s: string) => {
  const n = Number(clean(s).replace(/[$,\s]/g, "").replace(/[()]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export interface ParsedHoldings {
  holdings: Holding[];
  /** Lines that could not be read, with the reason — never silently dropped. */
  rejected: { line: string; reason: string }[];
}

/**
 * The separator this paste uses, decided ONCE from its first line and applied
 * to all of them. A tab or a semicolon is unambiguous; a comma is not, because
 * it is also how people write "1,200" — so a comma-separated paste is split
 * quote-aware and any line that comes apart into more columns than the first is
 * refused rather than silently read as one share.
 */
function detectDelimiter(sample: string): "\t" | ";" | "," {
  if (sample.includes("\t")) return "\t";
  if (sample.includes(";")) return ";";
  return ",";
}

function splitRow(line: string, delim: "\t" | ";" | ","): string[] {
  if (delim !== ",") return line.split(delim).map(clean);
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cell);
      cell = "";
    } else cell += ch;
  }
  out.push(cell);
  return out.map(clean);
}

/**
 * Parse pasted holdings. Accepts a header row with recognizable column names in
 * any order, or bare `TICKER, SHARES[, COST]` lines with no header at all.
 *
 * With no header and comma separation the format is exactly those three
 * columns, which is why `MU,1,200` reads as one share at a $200 basis rather
 * than 1,200 shares: both readings are legitimate and nothing in the line says
 * which was meant. Quote any value containing a comma, or paste tabs.
 *
 * A line that cannot be read is REPORTED, not dropped: a portfolio silently
 * missing its largest position would produce confidently wrong percentages,
 * and a wrong percentage is worse than a visible gap.
 */
export function parseHoldingsCsv(text: string): ParsedHoldings {
  const holdings: Holding[] = [];
  const rejected: { line: string; reason: string }[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { holdings, rejected };

  const delim = detectDelimiter(lines[0]);
  const split = (line: string) => splitRow(line, delim);

  // A header is only a header if it names a ticker column we recognize.
  const first = split(lines[0]).map((c) => c.toLowerCase());
  const idxOf = (keys: string[]) => first.findIndex((c) => keys.includes(c));
  const tickerIdx = idxOf(TICKER_KEYS);
  const hasHeader = tickerIdx >= 0;
  const sharesIdx = hasHeader ? idxOf(SHARE_KEYS) : 1;
  const costIdx = hasHeader ? idxOf(COST_KEYS) : 2;
  /** Headerless input is TICKER, SHARES and optionally COST — nothing wider. */
  const columns = hasHeader ? first.length : 3;

  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = split(line);
    if (delim === "," && cells.length > columns) {
      rejected.push({
        line,
        reason: `${cells.length} comma-separated values where ${columns} were expected — put quotes around any number containing a comma`,
      });
      continue;
    }
    const ticker = (cells[hasHeader ? tickerIdx : 0] ?? "").toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) {
      rejected.push({ line, reason: "no ticker in the first column" });
      continue;
    }
    const shares = sharesIdx >= 0 ? num(cells[sharesIdx] ?? "") : NaN;
    if (!Number.isFinite(shares) || shares <= 0) {
      rejected.push({ line, reason: "no positive share count" });
      continue;
    }
    const cost = costIdx >= 0 ? num(cells[costIdx] ?? "") : NaN;
    holdings.push({
      ticker,
      shares,
      ...(Number.isFinite(cost) && cost > 0 ? { costBasis: cost } : {}),
    });
  }

  return { holdings: mergeDuplicates(holdings), rejected };
}

/** One line per ticker: two lots of the same name are one position. */
export function mergeDuplicates(holdings: Holding[]): Holding[] {
  const byTicker = new Map<string, Holding>();
  for (const h of holdings) {
    const held = byTicker.get(h.ticker);
    if (!held) {
      byTicker.set(h.ticker, { ...h });
      continue;
    }
    held.shares += h.shares;
    if (h.costBasis !== undefined) held.costBasis = (held.costBasis ?? 0) + h.costBasis;
  }
  return [...byTicker.values()];
}

/* ----------------------------------------------------------------------------
 * Storage — one key, owner-only
 * -------------------------------------------------------------------------- */

export function savedHoldings(): Holding[] {
  const raw = getAppSettingJson(HOLDINGS_KEY);
  if (!Array.isArray(raw)) return [];
  const out: Holding[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { ticker, shares, costBasis } = item as Record<string, unknown>;
    if (typeof ticker !== "string" || typeof shares !== "number" || !(shares > 0)) continue;
    out.push({
      ticker: ticker.toUpperCase(),
      shares,
      ...(typeof costBasis === "number" && costBasis > 0 ? { costBasis } : {}),
    });
  }
  return mergeDuplicates(out);
}

export function saveHoldings(holdings: Holding[]): number {
  const cleaned = mergeDuplicates(
    holdings.filter((h) => typeof h.ticker === "string" && h.ticker !== "" && h.shares > 0),
  );
  setAppSettingJson(HOLDINGS_KEY, cleaned);
  return cleaned.length;
}

export function clearHoldings(): void {
  setAppSettingJson(HOLDINGS_KEY, []);
}

/* ----------------------------------------------------------------------------
 * The audit
 * -------------------------------------------------------------------------- */

export interface CategoryExposure {
  key: string;
  unit: string;
  /** The desk's verdict on this input, carried through so the flags can use it. */
  status: BottleneckSnapshot["categories"][number]["status"];
  gapPct: number | null;
  /** Rank in the bottleneck table, 1 = tightest measured constraint. */
  rank: number;
  ownerLabel: string;
  /** Producers of this input that are actually held. */
  held: { ticker: string; valueUsd: number; pctOfPortfolio: number }[];
  valueUsd: number;
  pctOfPortfolio: number;
  /** Producers on the owner map that are not held at all. */
  notHeld: string[];
}

export interface OverlapRow {
  ticker: string;
  /** Weight in the portfolio, percent. Null when the position is unpriced. */
  minePct: number | null;
  /** Weight in the manager's disclosed long book, percent. */
  theirsPct: number | null;
}

export interface ExposureReport {
  takenAt: string;
  playbookId: string;
  playbookLabel: string;
  portfolioValueUsd: number;
  positions: number;
  /** Positions with no price — excluded from every percentage, and said so. */
  unpriced: string[];
  categories: CategoryExposure[];
  /** Portfolio value in nothing the desk tracks as a constrained input. */
  unmappedUsd: number;
  unmappedPct: number;
  comparison: {
    filerName: string;
    period: string;
    both: OverlapRow[];
    theirsOnly: OverlapRow[];
    minesOnly: OverlapRow[];
  } | null;
  flags: string[];
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export interface ExposureInputs {
  playbook: Playbook;
  holdings: PricedHolding[];
  /** The desk's latest ranking; null when it has taken no reading yet. */
  bottleneck: BottleneckSnapshot | null;
  settings: Pick<BottleneckSettings, "concentrationPct">;
  /** A cloned manager's long book, for the overlap view. */
  manager?: {
    filerName: string;
    period: string;
    long: { ticker: string | null; pctOfLong: number | null }[];
  } | null;
  now?: Date;
}

/**
 * Cross-reference a portfolio against the desk's owner map. Pure — prices come
 * in already attached, so the whole report is reproducible from stored data.
 */
export function auditExposure(inputs: ExposureInputs): ExposureReport {
  const { playbook: pb, holdings, bottleneck, settings } = inputs;
  const now = inputs.now ?? new Date();

  const priced = holdings.filter((h) => h.valueUsd !== null && h.valueUsd > 0);
  const portfolioValueUsd = priced.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const valueOf = new Map(priced.map((h) => [h.ticker, h.valueUsd ?? 0]));
  const pctOf = (usd: number) => (portfolioValueUsd > 0 ? round((usd / portfolioValueUsd) * 100) : 0);

  // Rank comes from the desk's own ordering; a category it has not measured
  // still appears, because zero exposure to an unmeasured input is not safety.
  const ranked = new Map((bottleneck?.categories ?? []).map((c, i) => [c.key, { c, rank: i + 1 }]));

  const categories: CategoryExposure[] = pb.owners.map((owner) => {
    const scored = ranked.get(owner.category);
    const factor = pb.conversions.factors.find((f) => f.key === owner.category);
    const held = owner.tickers
      .filter((t) => valueOf.has(t))
      .map((t) => ({ ticker: t, valueUsd: valueOf.get(t) ?? 0, pctOfPortfolio: pctOf(valueOf.get(t) ?? 0) }))
      .sort((a, b) => b.valueUsd - a.valueUsd);
    const valueUsd = held.reduce((s, h) => s + h.valueUsd, 0);
    return {
      key: owner.category,
      unit: factor?.unit ?? owner.category,
      status: scored?.c.status ?? "insufficient-data",
      gapPct: scored?.c.gapPct ?? null,
      rank: scored?.rank ?? Number.MAX_SAFE_INTEGER,
      ownerLabel: owner.label,
      held,
      valueUsd,
      pctOfPortfolio: pctOf(valueUsd),
      notHeld: owner.tickers.filter((t) => !valueOf.has(t)),
    };
  });

  // Tightest constraint first — the same order the desk publishes, so the two
  // pages cannot tell different stories about what matters most.
  categories.sort((a, b) => a.rank - b.rank || b.valueUsd - a.valueUsd);

  const mapped = new Set(categories.flatMap((c) => c.held.map((h) => h.ticker)));
  const unmappedUsd = priced.filter((h) => !mapped.has(h.ticker)).reduce((s, h) => s + (h.valueUsd ?? 0), 0);

  return {
    takenAt: now.toISOString(),
    playbookId: pb.id,
    playbookLabel: pb.label,
    portfolioValueUsd,
    positions: holdings.length,
    unpriced: holdings.filter((h) => h.valueUsd === null).map((h) => h.ticker),
    categories,
    unmappedUsd,
    unmappedPct: pctOf(unmappedUsd),
    comparison: compareToManager(priced, portfolioValueUsd, inputs.manager ?? null),
    flags: exposureFlags(categories, holdings, settings.concentrationPct),
  };
}

/** Overlap and divergence against a cloned manager's long book. */
function compareToManager(
  priced: PricedHolding[],
  portfolioValueUsd: number,
  manager: ExposureInputs["manager"],
): ExposureReport["comparison"] {
  if (!manager) return null;
  const mine = new Map(
    priced.map((h) => [
      h.ticker,
      portfolioValueUsd > 0 ? round(((h.valueUsd ?? 0) / portfolioValueUsd) * 100) : null,
    ]),
  );
  const theirs = new Map<string, number | null>();
  for (const h of manager.long) {
    if (h.ticker) theirs.set(h.ticker, h.pctOfLong === null ? null : round(h.pctOfLong));
  }

  const both: OverlapRow[] = [];
  const minesOnly: OverlapRow[] = [];
  for (const [ticker, minePct] of mine) {
    if (theirs.has(ticker)) both.push({ ticker, minePct, theirsPct: theirs.get(ticker) ?? null });
    else minesOnly.push({ ticker, minePct, theirsPct: null });
  }
  const theirsOnly: OverlapRow[] = [...theirs.entries()]
    .filter(([ticker]) => !mine.has(ticker))
    .map(([ticker, theirsPct]) => ({ ticker, minePct: null, theirsPct }));

  const byWeight = (a: OverlapRow, b: OverlapRow) =>
    (b.theirsPct ?? b.minePct ?? 0) - (a.theirsPct ?? a.minePct ?? 0);

  return {
    filerName: manager.filerName,
    period: manager.period,
    both: both.sort(byWeight),
    theirsOnly: theirsOnly.sort(byWeight),
    minesOnly: minesOnly.sort((a, b) => (b.minePct ?? 0) - (a.minePct ?? 0)),
  };
}

/** Pure: the two flags the framework asks for, plus what would make them misleading. */
export function exposureFlags(
  categories: CategoryExposure[],
  holdings: PricedHolding[],
  concentrationPct: number,
): string[] {
  const flags: string[] = [];

  // (a) tightest constraints with essentially no exposure
  const tight = categories.filter((c) => c.status === "tightening");
  const absent = tight.filter((c) => c.pctOfPortfolio < 0.5);
  if (absent.length > 0) {
    const subject =
      absent.length === 1
        ? `the tightening constraint the desk ranks highest`
        : `${absent.length} of the tightening constraints the desk ranks highest`;
    flags.push(
      `No meaningful exposure to ${subject}: ${absent.map((c) => c.unit).join("; ")}. That is an observation about ` +
        `this portfolio, not a recommendation to change it — a constraint the market has already priced pays nobody.`,
    );
  }

  // (b) concentration in the producers of a single input
  for (const c of categories.filter((c) => c.pctOfPortfolio >= concentrationPct)) {
    flags.push(
      `${c.pctOfPortfolio}% of this portfolio sits in producers of one input — ${c.unit} ` +
        `(${c.held.map((h) => h.ticker).join(", ")}). Whether that is conviction or an accident is not something ` +
        `the desk can tell from the numbers.`,
    );
  }

  const unpriced = holdings.filter((h) => h.valueUsd === null);
  if (unpriced.length > 0) {
    flags.push(
      `${unpriced.length} position(s) could not be priced (${unpriced.map((h) => h.ticker).join(", ")}) and are ` +
        `excluded from every percentage here. The weights below describe the priced remainder.`,
    );
  }

  flags.push(
    `Owning the producers of a tightening input is a position, not an edge. The market may already price the ` +
      `constraint, and the evidence on heavy capital spending runs the other way: companies that invest most ` +
      `aggressively have historically delivered WORSE subsequent returns than those that do not.`,
  );

  return flags;
}
