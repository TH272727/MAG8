/* ============================================================================
 * USAspending.gov — what the government actually obligated, and to whom.
 *
 * Keyless, free, and the customer's own record rather than a supplier's. For a
 * theme whose buyer is the federal government, this is the most direct evidence
 * available anywhere: not a budget request, not a company's characterisation of
 * its pipeline, but the obligation as recorded.
 *
 * WHAT THIS IS NOT USED FOR, and why. It was tempting to wire this in as a
 * fifth supply connector alongside FRED, and that would be wrong. The desk's
 * gap arithmetic is `demand rate − supply rate`, and a procurement obligation
 * is a DEMAND quantity: putting it in a supply slot would compare the
 * government's spending against the suppliers' spending and print the
 * difference as a physical constraint tightening or easing. Every number would
 * be real and the conclusion would be meaningless. So this reads as its own
 * evidence block beside the gap, never into it.
 *
 * TWO THINGS THE LIVE DATA SETTLED, both the hard way:
 *
 * ONE — RECIPIENTS ARE OPERATING SUBSIDIARIES. Kratos Defense & Security
 * Solutions appears in the award records as "KRATOS UNMANNED AERIAL SYSTEMS,
 * INC", so matching a parent's listed name against recipient names returns
 * nothing and would report "no federal awards" for a company holding $82.1M of
 * them. Five of six companies in one owner map failed a normalised name match.
 * Linkage is therefore CURATED — a named alias, verified against the award
 * record — and never inferred, the same rule the developer-activity layer
 * follows for its handles and the identifier resolver learned from returning a
 * Frankfurt symbol for a Nasdaq listing.
 *
 * TWO — A FISCAL YEAR IS NOT A CALENDAR YEAR. Federal years run October to
 * September and are labelled by the year they END in, so FY2026 covers Oct 2025
 * to Sep 2026. Every figure here carries that label, because a reader comparing
 * it against a company's calendar-year capital spending without being told is
 * comparing two different twelve-month periods.
 * ========================================================================== */

/** USAspending publishes no rate limit; this is a conservative one of our own. */
const GAP_MS = 250;
const UA = "Mag8/1.0 (research desk; +https://themag8.com)";
const BASE = "https://api.usaspending.gov/api/v2";

type GlobalWithGate = typeof globalThis & {
  __mag8_usaspending_gate?: { chain: Promise<void>; last: number };
};

/**
 * One promise chain every caller serialises into — its own, deliberately not
 * shared with the SEC or price queues. Different hosts, different limits, and
 * sharing one gate would make a slow award query throttle filings for no reason.
 */
function schedule<T>(work: () => Promise<T>): Promise<T> {
  const g = globalThis as GlobalWithGate;
  if (!g.__mag8_usaspending_gate) g.__mag8_usaspending_gate = { chain: Promise.resolve(), last: 0 };
  const gate = g.__mag8_usaspending_gate;
  const run = gate.chain.then(async () => {
    const wait = Math.max(0, gate.last + GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    gate.last = Date.now();
  });
  gate.chain = run.catch(() => undefined);
  return run.then(work);
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  return schedule(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": UA },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`USAspending answered ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  });
}

/* ----------------------------------------------------------------------------
 * Codes
 * -------------------------------------------------------------------------- */

/**
 * A product or service code, as the API wants it: a tier path, coarsest first.
 * "Product" / "15" / "1550" is aircraft, then unmanned aircraft specifically.
 */
export type PscPath = string[];

export interface ProcurementCode {
  /** The tier path the API filters on, coarsest tier first. */
  path: PscPath;
  /** What the code covers, in the government's own words. */
  label: string;
}

/** Federal years run Oct-Sep and are named for the year they END in. */
export const fiscalYearWindow = (year: number) => ({
  start_date: `${year - 1}-10-01`,
  end_date: `${year}-09-30`,
});

/** The fiscal year a date falls in. October starts the next one. */
export function fiscalYearOf(d: Date): number {
  return d.getUTCMonth() >= 9 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
}

/* ----------------------------------------------------------------------------
 * Obligations over time
 * -------------------------------------------------------------------------- */

export interface ObligationYear {
  fiscalYear: number;
  amountUsd: number;
  /** True when the year is still running, so the figure is not yet complete. */
  partial: boolean;
}

export interface ObligationSeries {
  years: ObligationYear[];
  /** Set when nothing could be read. Never an empty series presented as zero. */
  unavailable: string | null;
}

/**
 * Total obligations under a set of codes, by fiscal year.
 *
 * The CURRENT fiscal year is marked partial rather than dropped. Dropping it
 * throws away the most recent information; presenting it beside complete years
 * without a mark invites a reader to see a collapse where there is only a year
 * that has not finished.
 */
export async function obligationsByYear(
  codes: ProcurementCode[],
  opts: { fromYear: number; toYear: number; timeoutMs: number; now?: Date },
): Promise<ObligationSeries> {
  if (codes.length === 0) return { years: [], unavailable: "no procurement codes are declared for this theme" };
  const now = opts.now ?? new Date();
  const currentFy = fiscalYearOf(now);

  try {
    const body = {
      group: "fiscal_year",
      filters: {
        time_period: [
          {
            start_date: fiscalYearWindow(opts.fromYear).start_date,
            end_date: fiscalYearWindow(opts.toYear).end_date,
          },
        ],
        psc_codes: { require: codes.map((c) => c.path) },
      },
    };
    const json = await post<{ results?: { time_period?: { fiscal_year?: string }; aggregated_amount?: number }[] }>(
      "/search/spending_over_time/",
      body,
      opts.timeoutMs,
    );
    const years: ObligationYear[] = [];
    for (const r of json.results ?? []) {
      const fy = Number(r.time_period?.fiscal_year);
      const amount = r.aggregated_amount;
      if (!Number.isFinite(fy) || typeof amount !== "number" || !Number.isFinite(amount)) continue;
      years.push({ fiscalYear: fy, amountUsd: amount, partial: fy >= currentFy });
    }
    years.sort((a, b) => a.fiscalYear - b.fiscalYear);
    if (years.length === 0) return { years: [], unavailable: "the award records returned no years for these codes" };
    return { years, unavailable: null };
  } catch (err) {
    return { years: [], unavailable: describe(err) };
  }
}

/* ----------------------------------------------------------------------------
 * Recipients
 * -------------------------------------------------------------------------- */

export interface Recipient {
  /** The legal entity as the award record names it. Never rewritten. */
  name: string;
  amountUsd: number;
  /** Unique Entity Identifier, where the record carries one. */
  uei: string | null;
}

export interface RecipientList {
  recipients: Recipient[];
  fiscalYear: number;
  partial: boolean;
  /** Sum of the recipients listed — NOT the total for the code. */
  listedTotalUsd: number;
  unavailable: string | null;
}

/**
 * Who the money went to, largest first, for one fiscal year.
 *
 * `listedTotalUsd` is the sum of what came BACK, which is the top `limit`
 * recipients and not the whole code. It is named that way so it cannot be
 * mistaken for the total; the total comes from `obligationsByYear`, and the
 * difference between them is the long tail.
 */
export async function recipientsForYear(
  codes: ProcurementCode[],
  opts: { fiscalYear: number; limit: number; timeoutMs: number; now?: Date },
): Promise<RecipientList> {
  const currentFy = fiscalYearOf(opts.now ?? new Date());
  const base = {
    recipients: [],
    fiscalYear: opts.fiscalYear,
    partial: opts.fiscalYear >= currentFy,
    listedTotalUsd: 0,
  };
  if (codes.length === 0) {
    return { ...base, unavailable: "no procurement codes are declared for this theme" };
  }
  try {
    const json = await post<{ results?: { name?: string; amount?: number; uei?: string | null }[] }>(
      "/search/spending_by_category/recipient/",
      {
        filters: {
          time_period: [fiscalYearWindow(opts.fiscalYear)],
          psc_codes: { require: codes.map((c) => c.path) },
        },
        limit: Math.max(1, Math.min(100, opts.limit)),
      },
      opts.timeoutMs,
    );
    const recipients: Recipient[] = [];
    for (const r of json.results ?? []) {
      if (typeof r.name !== "string" || typeof r.amount !== "number" || !Number.isFinite(r.amount)) continue;
      recipients.push({ name: r.name, amountUsd: r.amount, uei: r.uei ?? null });
    }
    recipients.sort((a, b) => b.amountUsd - a.amountUsd);
    return {
      ...base,
      recipients,
      listedTotalUsd: recipients.reduce((n, r) => n + r.amountUsd, 0),
      unavailable: recipients.length === 0 ? "the award records returned no recipients for these codes" : null,
    };
  } catch (err) {
    return { ...base, unavailable: describe(err) };
  }
}

/* ----------------------------------------------------------------------------
 * Linking a recipient to a listed company — curated, never guessed
 * -------------------------------------------------------------------------- */

/**
 * One listed company and the names its awards are actually recorded under.
 *
 * Every alias here was read off a live award record. The government contracts
 * with operating subsidiaries, so this is not a formatting convenience: the
 * parent's listed name frequently appears nowhere at all.
 */
export interface RecipientAlias {
  ticker: string;
  /** Award-record names, compared case- and punctuation-insensitively. */
  awardNames: string[];
}

const normalise = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

export interface LinkedRecipient extends Recipient {
  /** The listed company this award belongs to, when one is curated for it. */
  ticker: string | null;
}

/**
 * Attach tickers to recipients through the curated aliases and nothing else.
 *
 * A recipient with no alias gets `ticker: null` and keeps its name. That is not
 * a failure and is never rendered as one — most of the money under a defence
 * product code goes to companies that are private or are divisions of primes,
 * and saying so is more informative than a blank.
 */
export function linkRecipients(recipients: Recipient[], aliases: RecipientAlias[]): LinkedRecipient[] {
  const byName = new Map<string, string>();
  for (const a of aliases) {
    for (const n of a.awardNames) byName.set(normalise(n), a.ticker.toUpperCase());
  }
  return recipients.map((r) => ({ ...r, ticker: byName.get(normalise(r.name)) ?? null }));
}

export interface CoverageReading {
  /** Dollars among the listed recipients that reach a curated ticker. */
  linkedUsd: number;
  /** Share of the LISTED recipients' dollars, not of the whole code. */
  linkedSharePct: number | null;
  /** Distinct tickers seen in the award records. */
  tickers: string[];
  /** Curated tickers with no award under these codes this year. */
  absentTickers: string[];
  /** The largest recipients with no curated ticker, by name only. */
  unlinkedLeaders: Recipient[];
}

/**
 * How much of this code's money reaches companies the theme's owner map names.
 *
 * The interesting half is usually the second one. A theme's owner map lists the
 * specialists a reader can actually buy; the award records show that most of
 * the spending under the same code goes to primes and to private companies. The
 * share is not a score and is not presented as one — it is the honest size of
 * what the owner map covers.
 */
export function coverage(linked: LinkedRecipient[], curatedTickers: string[]): CoverageReading {
  const listedTotal = linked.reduce((n, r) => n + r.amountUsd, 0);
  const withTicker = linked.filter((r) => r.ticker !== null);
  const linkedUsd = withTicker.reduce((n, r) => n + r.amountUsd, 0);
  const seen = [...new Set(withTicker.map((r) => r.ticker as string))].sort();
  const wanted = [...new Set(curatedTickers.map((t) => t.toUpperCase()))].sort();
  return {
    linkedUsd,
    linkedSharePct: listedTotal > 0 ? (100 * linkedUsd) / listedTotal : null,
    tickers: seen,
    absentTickers: wanted.filter((t) => !seen.includes(t)),
    unlinkedLeaders: linked.filter((r) => r.ticker === null).slice(0, 8),
  };
}

/* ----------------------------------------------------------------------------
 * Rate of change, in the same shape the desk's other rates use
 * -------------------------------------------------------------------------- */

export interface ObligationTrend {
  latest: ObligationYear;
  prior: ObligationYear;
  changePct: number;
  /** True when either endpoint is an unfinished fiscal year. */
  partial: boolean;
}

/**
 * Year-on-year change in obligations, computed on the two most recent COMPLETE
 * years by default.
 *
 * The current fiscal year is excluded from the comparison unless nothing else
 * is available, because a year that is eleven months old will always look like
 * a decline against a finished one. When it has to be used, `partial` says so
 * and the reader is told which years were compared.
 */
export function obligationTrend(series: ObligationSeries): ObligationTrend | null {
  const complete = series.years.filter((y) => !y.partial);
  const pool = complete.length >= 2 ? complete : series.years;
  if (pool.length < 2) return null;
  const latest = pool[pool.length - 1];
  const prior = pool[pool.length - 2];
  if (prior.amountUsd === 0) return null;
  return {
    latest,
    prior,
    changePct: (100 * (latest.amountUsd - prior.amountUsd)) / prior.amountUsd,
    partial: latest.partial || prior.partial,
  };
}

/** Unwrap undici's nested cause: "fetch failed" alone is not a diagnosis. */
function describe(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code) return `the award records could not be read (${cause.code})`;
    if (cause?.message) return `the award records could not be read: ${cause.message}`;
    return `the award records could not be read: ${err.message}`;
  }
  return "the award records could not be read";
}
