import { fetchFilingDocument, fullTextSearch, getFilingIndex } from "../edgar";
import { countSupplyPoints, getSupplySeries, saveSupplyPoints, type SupplyPoint } from "../db";
import type { Playbook, SupplySeries } from "./playbook";

/* ============================================================================
 * Module C, part 1 — supply connectors.
 *
 * One interface, many sources. Every connector returns the same shape and every
 * observation lands in the same table, so the scoring layer never learns where
 * a number came from — which is the whole point: adding a new source must not
 * require touching the scoring logic.
 *
 * Connector realism, deliberately ordered:
 *   fred            real keyless API, monthly, verified reachable
 *   filing-search   derived from SEC filings — free, and already built
 *   manual          owner-entered dated points, a first-class path
 *   stub            a named source with no automated feed yet, labelled as such
 *
 * The framework this implements reaches for scraped foreign-ministry press
 * releases. Those are the most fragile thing in it — HTML that changes without
 * notice, on hosts that may not resolve — so nothing load-bearing depends on
 * one here. Where a real capacity series exists, it is used instead: FRED
 * publishes industrial CAPACITY indices for exactly the industries in question,
 * which is a direct measure of how much the sector can produce.
 *
 * Every connector is fail-open: an unreachable source yields no observations
 * and is disclosed, never an exception.
 * ========================================================================== */

export interface SupplyObservation {
  /** YYYY-MM-DD. */
  date: string;
  value: number;
  unit: string;
  sourceUrl: string | null;
}

export interface SupplyDataSource {
  id: string;
  label: string;
  /** How the numbers reach us — shown so a reader can weigh them. */
  origin: SupplyPoint["origin"];
  /**
   * Observations for one series, oldest first. MUST NOT throw: an unreachable
   * source returns an empty array and the desk discloses the gap.
   */
  fetch(series: SupplySeries, opts: { timeoutMs: number }): Promise<SupplyObservation[]>;
}

/* ----------------------------------------------------------------------------
 * FRED — keyless CSV, monthly
 * -------------------------------------------------------------------------- */

/** `observation_date,SERIES\n2026-07-01,160.2637` — the "." placeholder marks a gap. */
export function parseFredCsv(csv: string, unit: string, sourceUrl: string | null): SupplyObservation[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^observation_date,/i.test(lines[0])) return [];
  const out: SupplyObservation[] = [];
  for (const line of lines.slice(1)) {
    const [date, raw] = line.split(",");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue; // "." = no observation that month
    out.push({ date, value, unit, sourceUrl });
  }
  return out;
}

/** FRED rejects spoofed browser agents and undici's default; identify honestly. */
const FRED_UA = "Mag8/1.0 (research desk; +https://themag8.com)";

const fredConnector: SupplyDataSource = {
  id: "fred",
  label: "Federal Reserve Economic Data",
  origin: "api",
  async fetch(series, { timeoutMs }) {
    if (!series.handle) return [];
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(series.handle)}`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        // An identifying User-Agent is required, not merely polite: FRED hangs
        // the connection for a browser-spoofing "Mozilla/5.0" and for undici's
        // default header alike, and returns promptly for an honest one. Both
        // failure modes look exactly like a TLS problem from the client side.
        headers: { "User-Agent": FRED_UA, Accept: "text/csv" },
      });
      if (!res.ok) return [];
      return parseFredCsv(await res.text(), series.unit, series.sourceUrl ?? url);
    } catch {
      return [];
    }
  },
};

/* ----------------------------------------------------------------------------
 * Filing search — a disclosed backlog is supply evidence with no time series
 * -------------------------------------------------------------------------- */

/**
 * Pull a capacity quantity out of filing prose.
 *
 * Deliberately narrow: the number must sit within a short span of the word
 * "backlog" and carry an explicit unit. Filings are full of unrelated figures,
 * and a loose pattern would confidently return the wrong one — which is worse
 * than returning nothing, because nothing is visibly a gap.
 */
export function extractQuantity(text: string, unitPattern: RegExp): { value: number; context: string } | null {
  const re = new RegExp(
    String.raw`backlog[^.]{0,160}?(\d[\d,]*(?:\.\d+)?)\s*(` + unitPattern.source + String.raw`)` +
      String.raw`|(\d[\d,]*(?:\.\d+)?)\s*(` + unitPattern.source + String.raw`)[^.]{0,80}?backlog`,
    "i",
  );
  const m = re.exec(text);
  if (!m) return null;
  const raw = m[1] ?? m[3];
  const value = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, context: m[0].slice(0, 240) };
}

const GIGAWATT = /GW|gigawatts?/i;
/** Filings run to megabytes; scan the head only. */
const FILING_SCAN_BYTES = 3_000_000;
/** How many matching filings to open per refresh — each is a real fetch. */
const MAX_FILINGS = 6;

const filingSearchConnector: SupplyDataSource = {
  id: "filing-search",
  label: "Disclosed in SEC filings",
  origin: "filing",
  async fetch(series, { timeoutMs }) {
    if (!series.handle) return [];
    try {
      const hits = await fullTextSearch(series.handle, {
        forms: ["8-K", "10-Q", "10-K"],
        timeoutMs,
      });
      const out: SupplyObservation[] = [];
      for (const hit of hits.hits.slice(0, MAX_FILINGS)) {
        if (!hit.cik || !hit.accessionNumber) continue;
        try {
          const files = await getFilingIndex(hit.cik, hit.accessionNumber, { timeoutMs });
          const doc =
            files.find((f) => f.name === hit.fileName) ??
            files.find((f) => /\.htm?l?$/i.test(f.name) && f.size > 5000);
          if (!doc) continue;
          const raw = await fetchFilingDocument(hit.cik, hit.accessionNumber, doc.name, { timeoutMs });
          const text = raw.slice(0, FILING_SCAN_BYTES).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
          const found = extractQuantity(text, GIGAWATT);
          if (!found) continue;
          const acc = hit.accessionNumber.replace(/-/g, "");
          out.push({
            // The reporting period, not the filing date — a backlog is as of a period end.
            date: hit.reportDate || hit.filingDate,
            value: found.value,
            unit: series.unit,
            sourceUrl: `https://www.sec.gov/Archives/edgar/data/${hit.cik}/${acc}/${doc.name}`,
          });
        } catch {
          // One unreadable filing must not end the sweep.
        }
      }
      return out.sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  },
};

/* ----------------------------------------------------------------------------
 * Manual and stub
 * -------------------------------------------------------------------------- */

/** Owner-entered points already live in the database; there is nothing to fetch. */
const manualConnector: SupplyDataSource = {
  id: "manual",
  label: "Entered by hand",
  origin: "manual",
  async fetch() {
    return [];
  },
};

/**
 * A source that is named and real but has no automated feed yet. Returning
 * nothing is the honest behaviour — the desk shows the series with its source
 * so the gap is visible, rather than quietly omitting a constraint that matters.
 */
const stubConnector: SupplyDataSource = {
  id: "stub",
  label: "No automated feed yet",
  origin: "manual",
  async fetch() {
    return [];
  },
};

export const CONNECTORS: Record<string, SupplyDataSource> = {
  fred: fredConnector,
  "filing-search": filingSearchConnector,
  manual: manualConnector,
  stub: stubConnector,
};

export const getConnector = (id: string): SupplyDataSource | null => CONNECTORS[id] ?? null;

/* ----------------------------------------------------------------------------
 * Refresh
 * -------------------------------------------------------------------------- */

export interface SeriesRefresh {
  seriesId: string;
  label: string;
  connector: string;
  /** Observations written this pass (0 for manual/stub, and for a dead feed). */
  fetched: number;
  /** Total observations now stored, including previously entered ones. */
  stored: number;
  /** Observations inside the scoring read window. */
  window: number;
  latest: string | null;
  stub: boolean;
  note?: string;
}

/**
 * Refresh every series a playbook declares. Never throws; a source that cannot
 * be reached simply contributes no new observations and says so.
 */
export async function refreshSupply(pb: Playbook, opts: { timeoutMs: number }): Promise<SeriesRefresh[]> {
  const out: SeriesRefresh[] = [];
  for (const series of pb.supply) {
    const connector = getConnector(series.connector);
    let fetched = 0;
    let note: string | undefined;

    if (!connector) {
      note = `No connector registered for "${series.connector}".`;
    } else {
      const observations = await connector.fetch(series, opts);
      if (observations.length > 0) {
        fetched = saveSupplyPoints(
          observations.map((o) => ({
            seriesId: series.seriesId,
            date: o.date,
            value: o.value,
            unit: o.unit,
            sourceUrl: o.sourceUrl,
            origin: connector.origin,
          })),
        );
      } else if (series.stub) {
        note = `Source named but not yet automated: ${series.sourceUrl ?? "see playbook"}. Points can be entered by hand.`;
      } else if (connector.id !== "manual") {
        note = "Source returned no observations this refresh; any stored history still stands.";
      }
    }

    const recent = getSupplySeries(series.seriesId);
    out.push({
      seriesId: series.seriesId,
      label: series.label,
      connector: series.connector,
      fetched,
      stored: countSupplyPoints(series.seriesId),
      window: recent.length,
      latest: recent.length > 0 ? recent[recent.length - 1].date : null,
      stub: Boolean(series.stub),
      ...(note ? { note } : {}),
    });
  }
  return out;
}
