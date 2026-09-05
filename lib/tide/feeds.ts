import { fetchTicker, toPriceBars } from "../rotation/bars";
import type { TideFrequency, TideSeries } from "./catalog";

/* ============================================================================
 * Where the numbers come from.
 *
 * One interface, four sources. Every connector is FAIL-OPEN: it returns an
 * empty list and a reason, and never throws. A source that is down degrades one
 * reading, is disclosed on the page, and never overwrites what is stored.
 *
 * The three lessons this file exists to encode, each of which produced a
 * confident wrong number during the build:
 *
 * 1. A STATUS CODE VALIDATES NOTHING. The economic-data host answers a request
 *    for a series that does not exist with HTTP 200 and an HTML error page. A
 *    connector that trusts `res.ok` stores the words "<!DOCTYPE html>" as a
 *    series and reports zero observations without ever raising an error. Every
 *    response here is checked for the shape it claims to have.
 *
 * 2. REACHABLE IS NOT ALIVE. The obvious free leading-economic-index series
 *    answers perfectly and has published nothing since February 2020. Three
 *    more of the series this desk was first sketched around are equally dead.
 *    So a series carries a staleness budget and the desk reports a stale series
 *    as stale rather than reading a six-year-old figure as today's.
 *
 * 3. SOME SERIES ARE FORECASTS. One candidate's most recent row is dated 2036 —
 *    it is a published projection — and another is a nowcast of a quarter that
 *    has not ended. Taking the last row as "the current reading" publishes a
 *    forecast as an observation, so observations dated in the future are
 *    dropped at the boundary and counted.
 *
 * One more, on user agents: this host requires an HONEST identifying agent and
 * hangs the connection for a browser-spoofing one, which is the exact opposite
 * of the rule the price source needs. The two must not be cargo-culted into
 * each other, and they are kept in different files for that reason.
 * ========================================================================== */

export interface RawObservation {
  /** YYYY-MM-DD, as published. */
  date: string;
  value: number;
}

export interface FeedResult {
  observations: RawObservation[];
  /** Why the source could not answer, or what it declined. Present whenever the list is empty. */
  note?: string;
  /** Observations dated after today, dropped as projections rather than stored. */
  droppedFuture: number;
}

export interface FeedOptions {
  years: number;
  timeoutMs: number;
  gapMs: number;
  /** Injected so a test never depends on the wall clock. */
  now?: Date;
}

export interface TideSource {
  id: string;
  label: string;
  /**
   * MUST NOT throw: an unreachable source returns an empty list and a reason,
   * and the desk discloses the gap rather than failing the refresh.
   */
  fetch(series: TideSeries, opts: FeedOptions): Promise<FeedResult>;
}

const empty = (note: string): FeedResult => ({ observations: [], note, droppedFuture: 0 });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Drop observations dated after today. See lesson 3 above: a published
 * projection and a published observation arrive in the same column.
 */
function dropFuture(rows: RawObservation[], now: Date): { kept: RawObservation[]; dropped: number } {
  const today = now.toISOString().slice(0, 10);
  const kept = rows.filter((r) => r.date <= today);
  return { kept, dropped: rows.length - kept.length };
}

/* ---------------------------------------------------------------------------
 * Economic data
 * ------------------------------------------------------------------------- */

/**
 * An identifying agent is required, not merely polite: this host hangs the
 * connection for a browser-spoofing "Mozilla/5.0" and for the runtime's own
 * default header alike, and answers promptly for an honest one. Both failure
 * modes look exactly like a TLS problem from the client side.
 */
const FRED_UA = "Mag8/1.0 (research desk; +https://themag8.com)";

/**
 * `observation_date,SERIES\n2026-07-01,160.2637`
 *
 * A gap is marked EITHER by a "." placeholder OR by an empty field, and the two
 * are not interchangeable to a parser: `Number(".")` is NaN and gets skipped,
 * but **`Number("")` is 0**, which passes `Number.isFinite` and would be stored
 * as a real observation of zero. This host does ship empty fields — the
 * consumer price index carries one for a month that was never published — and
 * on a gauge measuring conditions a phantom zero is not a missing month, it is
 * a collapse. So the field must look like a number before it is read as one.
 *
 * Exported for the tests: the malformed cases are the whole point.
 */
export function parseFredCsv(csv: string): { rows: RawObservation[]; note?: string } {
  const lines = csv.trim().split(/\r?\n/);
  // Lesson 1: this is the check, not the status code. A request for a series
  // that does not exist returns HTTP 200 and an HTML page.
  if (lines.length < 2 || !/^observation_date,/i.test(lines[0])) {
    return { rows: [], note: "the response was not a data table — the series identifier is probably wrong" };
  }
  const rows: RawObservation[] = [];
  for (const line of lines.slice(1)) {
    const [date, raw] = line.split(",");
    if (!ISO_DATE.test(date ?? "")) continue;
    if (!/^-?\d+(\.\d+)?$/.test((raw ?? "").trim())) continue; // "." or "" = no observation
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    rows.push({ date, value });
  }
  return { rows };
}

const fredConnector: TideSource = {
  id: "fred",
  label: "Federal Reserve Economic Data",
  async fetch(series, { timeoutMs, now }) {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series.handle)}`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": FRED_UA, Accept: "text/csv" },
      });
      if (!res.ok) return empty(`the source answered ${res.status}`);
      const { rows, note } = parseFredCsv(await res.text());
      if (note) return empty(note);
      if (rows.length === 0) return empty("the source returned a table with no observations");
      const { kept, dropped } = dropFuture(rows, now ?? new Date());
      return { observations: kept, droppedFuture: dropped };
    } catch (err) {
      return empty(describeFetchError(err));
    }
  },
};

/* ---------------------------------------------------------------------------
 * Volatility indices
 * ------------------------------------------------------------------------- */

/**
 * `DATE,OPEN,HIGH,LOW,CLOSE\n09/04/2026,14.15,14.58,13.80,14.53`
 *
 * The exchange publishes these itself, in full, without a key — which makes it
 * a primary source rather than a summary of one, and it reaches back to 1990
 * where the general-purpose price host serves this symbol unreliably.
 *
 * Dates are US-ordered, so a naive `new Date(...)` reading is wrong for eleven
 * days of every month and right for the rest, which is the worst kind of wrong.
 */
export function parseCboeCsv(csv: string): { rows: RawObservation[]; note?: string } {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^DATE,/i.test(lines[0])) {
    return { rows: [], note: "the response was not the expected daily price table" };
  }
  const header = lines[0].split(",").map((h) => h.trim().toUpperCase());
  const closeAt = header.indexOf("CLOSE");
  if (closeAt < 0) return { rows: [], note: "the daily table carried no closing price column" };
  const rows: RawObservation[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((cells[0] ?? "").trim());
    if (!m) continue;
    const raw = (cells[closeAt] ?? "").trim();
    if (!/^-?\d+(\.\d+)?$/.test(raw)) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    rows.push({ date: `${m[3]}-${m[1]}-${m[2]}`, value });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { rows };
}

const cboeConnector: TideSource = {
  id: "cboe",
  label: "Cboe Global Markets",
  async fetch(series, { timeoutMs, now }) {
    if (!/^[A-Za-z0-9_]+\.csv$/.test(series.handle)) {
      return empty(`"${series.handle}" is not a usable daily price file name`);
    }
    const url = `https://cdn.cboe.com/api/global/us_indices/daily_prices/${series.handle}`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/csv" },
      });
      if (!res.ok) return empty(`the source answered ${res.status}`);
      const { rows, note } = parseCboeCsv(await res.text());
      if (note) return empty(note);
      if (rows.length === 0) return empty("the source returned a table with no prices");
      const { kept, dropped } = dropFuture(rows, now ?? new Date());
      return { observations: kept, droppedFuture: dropped };
    } catch (err) {
      return empty(describeFetchError(err));
    }
  },
};

/* ---------------------------------------------------------------------------
 * Market prices
 * ------------------------------------------------------------------------- */

/**
 * Index levels, through the price fetcher the rest of this application already
 * uses: two independent sources behind one fail-open interface, so a source
 * that stops working degrades one reading rather than the whole desk, and
 * there is one place in this codebase that knows how to ask for a price.
 *
 * Index levels are not adjusted for anything, so the mixed-basis problem that
 * governs the board's fund ratios does not arise here — but the basis is still
 * recorded, because the breadth constituents in the same table are shares.
 */
const marketConnector: TideSource = {
  id: "market",
  label: "Daily index levels",
  async fetch(series, { years, timeoutMs, gapMs, now }) {
    const out = await fetchTicker(series.handle, {
      years,
      timeoutMs,
      gapMs,
      minBars: 200,
      fallbackEnabled: true,
    });
    if (!out.series) {
      const why = out.attempts.map((a) => a.note).filter(Boolean).join("; ");
      return empty(why || "no price source could answer");
    }
    const rows = out.series.bars.map((b) => ({ date: b.date, value: b.close }));
    const { kept, dropped } = dropFuture(rows, now ?? new Date());
    return { observations: kept, droppedFuture: dropped };
  },
};

/* ---------------------------------------------------------------------------
 * Hand-entered and locally computed
 * ------------------------------------------------------------------------- */

/**
 * Reads nothing. Two kinds of series carry this connector: readings computed
 * inside this application (breadth, which no public feed sells), and readings
 * whose publisher offers them only as a spreadsheet a person has to open.
 *
 * Both are written by their own paths — the breadth module and the operator's
 * entry form — so a refresh must leave them alone. Returning an empty list
 * with a reason rather than failing is what lets a hand-entered series sit
 * beside thirty automatic ones without either interfering with the other.
 */
const manualConnector: TideSource = {
  id: "manual",
  label: "Entered by hand or computed locally",
  async fetch() {
    return empty("this reading is not fetched — it is computed locally or entered by hand");
  },
};

export const CONNECTORS: Record<string, TideSource> = {
  fred: fredConnector,
  cboe: cboeConnector,
  market: marketConnector,
  manual: manualConnector,
};

export const getConnector = (id: string): TideSource | null => CONNECTORS[id] ?? null;

/* ---------------------------------------------------------------------------
 * Freshness
 * ------------------------------------------------------------------------- */

export interface Freshness {
  latest: string | null;
  ageDays: number | null;
  stale: boolean;
  /** A sentence, ready to print. Null when the series is current. */
  reason: string | null;
}

const DAY_MS = 86_400_000;

export function daysBetween(from: string, to: Date): number | null {
  if (!ISO_DATE.test(from)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  if (!Number.isFinite(a)) return null;
  return Math.floor((to.getTime() - a) / DAY_MS);
}

/**
 * Is this series still being published?
 *
 * `budgetPct` scales every series' declared budget at once, so an operator can
 * loosen or tighten the whole desk without editing the catalogue.
 */
export function freshnessOf(
  series: TideSeries,
  latest: string | null,
  now: Date,
  budgetPct = 100,
): Freshness {
  if (!latest) {
    return { latest: null, ageDays: null, stale: true, reason: "nothing has been stored for this reading yet" };
  }
  const ageDays = daysBetween(latest, now);
  if (ageDays === null) {
    return { latest, ageDays: null, stale: true, reason: "the stored date could not be read" };
  }
  const budget = Math.round((series.staleAfterDays * budgetPct) / 100);
  if (ageDays <= budget) return { latest, ageDays, stale: false, reason: null };
  return {
    latest,
    ageDays,
    stale: true,
    reason:
      `the most recent observation is ${latest}, ${ageDays} days ago, against the ${budget} days this ` +
      `${series.frequency} series is allowed before it is treated as no longer published`,
  };
}

/* ---------------------------------------------------------------------------
 * Errors
 * ------------------------------------------------------------------------- */

/**
 * The runtime reports every network failure as the single word "fetch failed"
 * and hides the actual cause one level down, which makes a name-resolution
 * failure, a refused connection, a certificate problem and a timeout
 * indistinguishable on a page that has to explain itself.
 */
export function describeFetchError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) return `${err.message}: ${cause.message}`;
    if (cause && typeof cause === "object" && "code" in cause) {
      return `${err.message}: ${String((cause as { code: unknown }).code)}`;
    }
    if (err.name === "TimeoutError") return "the source did not answer in time";
    return err.message;
  }
  return "the source could not be reached";
}

/** Observations a year of this frequency should contain — used to size windows. */
export function perYear(frequency: TideFrequency): number {
  return frequency === "daily" ? 252 : frequency === "weekly" ? 52 : frequency === "monthly" ? 12 : 4;
}

export { toPriceBars };
