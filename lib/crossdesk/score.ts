import type { DeskClaim, DeskKey, SectorContext } from "./claims";

/* ============================================================================
 * Ranking the ledger — pure. Claims in, ordered rows out.
 *
 * The ordering rule, and why it is this way round:
 *
 *   1. How many desks MEASURED the company. A desk that computed a figure
 *      about this specific name has said more than a desk that found it on a
 *      list, so measured agreement leads.
 *   2. How many desks named it at all.
 *   3. The strongest measured figure, as a tie-break only.
 *
 * A company named by one desk is not a rejection and is never rendered as one.
 * It is simply not crossed, and the page says exactly that. The whole point of
 * this ledger is that agreement between independent readings is interesting;
 * the absence of agreement is mostly just the absence of overlap between four
 * desks that were built to look at different things.
 * ========================================================================== */

export type CrossReason = "desks" | "themes";

export interface LedgerRow {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  marketCapUsd: number | null;
  /** True when the weekly screen currently lets this company through. */
  eligible: boolean;
  claims: DeskClaim[];
  /** Distinct desks with a measured claim about this company. */
  measuredDesks: number;
  /** Distinct desks naming it at all, measured or curated. */
  desks: number;
  deskKeys: DeskKey[];
  /**
   * Distinct sub-sources within a single desk — in practice, bottleneck themes.
   * A second axis on which a company can cross, and a deliberately weaker one:
   * two themes are one desk's method applied twice, not two opinions.
   */
  groups: string[];
  /** Distinct constrained inputs behind those themes, where there are any. */
  constraints: string[];
  /**
   * Why this row is listed. Both can be true; an empty array means it is not a
   * crossing at all.
   */
  crossedBy: CrossReason[];
  /** Highest measured strength across desks; a tie-break, never a score. */
  topStrength: number | null;
  /** Cautions raised by the weekly screen. Never counted as agreement. */
  flags: string[];
  /** The company's neighbourhood, if its sector maps to a fund. */
  context: SectorContext | null;
}

export interface LedgerInputs {
  claims: DeskClaim[];
  facts: Map<string, { name: string; sector: string; cap: number }>;
  eligible: Set<string>;
  flags: Map<string, string[]>;
  contexts: Map<string, SectorContext>;
}

/**
 * The desks that can name a company.
 *
 * The rotation board is deliberately absent: it trades funds, so it never
 * produces a claim about a single name and can never be part of an agreement.
 * It appears on a row as neighbourhood context and nowhere else.
 */
const DESK_ORDER: DeskKey[] = ["pipeline", "insider", "bottleneck"];

export function buildLedger(inputs: LedgerInputs): LedgerRow[] {
  const byTicker = new Map<string, DeskClaim[]>();
  for (const claim of inputs.claims) {
    // Tickers arrive from four independently maintained sources; casing is the
    // one thing that could silently split a company into two rows.
    const key = claim.ticker.trim().toUpperCase();
    if (key.length === 0) continue;
    byTicker.set(key, [...(byTicker.get(key) ?? []), { ...claim, ticker: key }]);
  }

  const rows: LedgerRow[] = [];
  for (const [ticker, claims] of byTicker) {
    const measuredDesks = new Set(
      claims.filter((c) => c.kind === "measured").map((c) => c.desk),
    ).size;
    const deskKeys = DESK_ORDER.filter((d) => claims.some((c) => c.desk === d));
    const strengths = claims
      .map((c) => c.strength)
      .filter((s): s is number => s !== null && Number.isFinite(s));
    const fact = inputs.facts.get(ticker) ?? null;
    const context = fact ? (inputs.contexts.get(fact.sector) ?? null) : null;

    rows.push({
      ticker,
      // The weekly screen is the ONE source of a company name here. A company
      // it does not list shows its ticker rather than a name lifted from
      // whichever desk happened to carry one.
      companyName: fact?.name ?? null,
      sector: fact?.sector ?? null,
      marketCapUsd: fact?.cap ?? null,
      eligible: inputs.eligible.has(ticker),
      claims: [...claims].sort(
        (a, b) => DESK_ORDER.indexOf(a.desk) - DESK_ORDER.indexOf(b.desk),
      ),
      measuredDesks,
      desks: deskKeys.length,
      deskKeys,
      groups: [...new Set(claims.map((c) => c.group).filter((g): g is string => !!g))].sort(),
      constraints: [
        ...new Set(claims.map((c) => c.constraint).filter((c): c is string => !!c)),
      ].sort(),
      // Filled by summarize(), which is where both thresholds live.
      crossedBy: [],
      topStrength: strengths.length > 0 ? Math.max(...strengths) : null,
      flags: inputs.flags.get(ticker) ?? [],
      context,
    });
  }

  return rows.sort(compareRows);
}

/**
 * Ordering, strongest evidence first.
 *
 * Themes rank BELOW desks on purpose. Two desks agreeing is two methods
 * arriving at the same company; two themes agreeing is one desk's method
 * applied twice, and a company named in five themes still has not been
 * measured by anybody else.
 */
export function compareRows(a: LedgerRow, b: LedgerRow): number {
  if (a.measuredDesks !== b.measuredDesks) return b.measuredDesks - a.measuredDesks;
  if (a.desks !== b.desks) return b.desks - a.desks;
  if (a.groups.length !== b.groups.length) return b.groups.length - a.groups.length;
  const as = a.topStrength ?? -1;
  const bs = b.topStrength ?? -1;
  if (as !== bs) return bs - as;
  return a.ticker.localeCompare(b.ticker);
}

export interface LedgerSummary {
  /** Rows where more than one desk named the company. */
  crossed: LedgerRow[];
  /** Everything else, kept and counted but not presented as a finding. */
  single: LedgerRow[];
  totalNamed: number;
  /** Pairs of desks and how many companies they share. The honest headline. */
  pairs: { a: DeskKey; b: DeskKey; shared: number }[];
  /** Companies named by more than one bottleneck theme, whatever else names them. */
  multiTheme: number;
  /** Of those, the ones where the themes are the SAME input in two industries. */
  sharedConstraint: number;
}

export function summarize(rows: LedgerRow[], minDesks: number, minThemes: number): LedgerSummary {
  const withReasons = rows.map((r) => {
    const crossedBy: CrossReason[] = [];
    if (r.desks >= minDesks) crossedBy.push("desks");
    if (r.groups.length >= minThemes) crossedBy.push("themes");
    return { ...r, crossedBy };
  });

  const crossed = withReasons.filter((r) => r.crossedBy.length > 0).sort(compareRows);
  const single = withReasons.filter((r) => r.crossedBy.length === 0).sort(compareRows);
  const multi = withReasons.filter((r) => r.groups.length >= 2);

  const pairs: { a: DeskKey; b: DeskKey; shared: number }[] = [];
  for (let i = 0; i < DESK_ORDER.length; i++) {
    for (let j = i + 1; j < DESK_ORDER.length; j++) {
      const a = DESK_ORDER[i];
      const b = DESK_ORDER[j];
      const shared = rows.filter(
        (r) => r.deskKeys.includes(a) && r.deskKeys.includes(b),
      ).length;
      // Reported even at zero. A pair of desks that never agree is the most
      // useful thing this page can tell a reader about its own limits.
      pairs.push({ a, b, shared });
    }
  }

  return {
    crossed,
    single,
    totalNamed: rows.length,
    pairs,
    multiTheme: multi.length,
    // Two themes over ONE input is one constraint showing up in two
    // industries, not two constraints — a weaker fact, and the page says so.
    sharedConstraint: multi.filter((r) => r.constraints.length < r.groups.length).length,
  };
}
