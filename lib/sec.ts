/* ============================================================================
 * SEC EDGAR enrichment for the Stage-0 universe screen (server-only, $0).
 *
 * Two keyless official sources, both fail-open:
 *  - company_tickers_exchange.json — ticker → CIK for every SEC registrant
 *    (probe 2026-07-13: covers 2,118 of 2,120 band-eligible listings).
 *  - XBRL "frames" API — ONE request returns a concept for EVERY filer in a
 *    period (~0.1–0.9 MB each), so ~15–25 requests fundamentally screen the
 *    whole universe: cash & short-term investments, operating cash flow,
 *    revenue, stockholders' equity, cover-page share counts. Annual concepts
 *    also fetch the fiscal year immediately prior (same tag), which is what
 *    the pool ranking's growth and trajectory math runs on.
 *
 * Frames quirks handled here (all probe-verified):
 *  - Tag drift: revenue lives under 2–3 tags, cash under 2, current
 *    securities under 3 — each concept merges a fallback chain.
 *  - Filing lag: the just-ended quarter's frame is near-empty until 10-Qs
 *    land; instant concepts probe the previous quarter and fall back one
 *    more, using the dei share-count frame as the coverage oracle.
 *  - Same-quarter YoY: share growth compares identical fiscal quarters a
 *    year apart, never mixed windows.
 *  - Coverage is ~75–85% of eligible names (foreign private issuers file
 *    under IFRS and are absent) — callers must treat missing data as PASS.
 *
 * SEC fair-access: ≤10 req/s with an identifying User-Agent. We run
 * sequentially with a gap, far under the limit. MAG8_SEC_UA overrides.
 * ========================================================================== */

/** Per-ticker fundamentals derived from the latest structured filings. All optional — never guessed. */
export interface SecFundamentals {
  cik: number;
  /** Cash & cash equivalents (USD, latest instant). */
  cash?: number;
  /** Short-term / current marketable securities (USD, latest instant; max of the tag variants — never summed). */
  sti?: number;
  /** Net operating cash flow, latest full fiscal year (USD; negative = burn). */
  ocf?: number;
  /** Operating cash flow, the fiscal year immediately before `ocf` (same tag; only set when `ocf` is). */
  ocf0?: number;
  /** Revenue, latest full fiscal year (USD). */
  rev?: number;
  /** Revenue, the fiscal year immediately before `rev` — SAME XBRL tag as `rev`, so growth math never mixes tag variants (only set when `rev` is). */
  rev0?: number;
  /** Stockholders' equity (USD, latest instant). */
  eqy?: number;
  /** Cover-page share count growth, same quarter YoY (percent). */
  shGrowthPct?: number;
}

export interface SecEnrichment {
  byTicker: Record<string, SecFundamentals>;
  meta: {
    fetchedAt: string;
    mapEntries: number;
    /** Tickers with at least one fundamental datum. */
    withData: number;
    /** Human labels for the periods used, e.g. "Q1 2026" / "FY2025". */
    instantLabel: string;
    fiscalLabel: string;
    sharesLabel: string;
    failures: string[];
  };
}

const SEC_UA = () =>
  process.env.MAG8_SEC_UA?.trim() || "Mag8/1.0 (research pipeline; +https://themag8.com)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GAP_MS = 120;

async function secJson<T>(url: string, timeoutMs: number): Promise<T> {
  await sleep(GAP_MS);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": SEC_UA(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/* ----------------------------------------------------------------------------
 * Ticker → CIK map
 * -------------------------------------------------------------------------- */

async function fetchCikMap(timeoutMs: number): Promise<Map<string, number>> {
  const body = await secJson<{ fields: string[]; data: (string | number)[][] }>(
    "https://www.sec.gov/files/company_tickers_exchange.json",
    timeoutMs,
  );
  const ti = body.fields.indexOf("ticker");
  const ci = body.fields.indexOf("cik");
  if (ti < 0 || ci < 0) throw new Error("cik map: unrecognized shape");
  const map = new Map<string, number>();
  for (const row of body.data) {
    const ticker = String(row[ti]).toUpperCase();
    const cik = Number(row[ci]);
    if (ticker && Number.isFinite(cik) && !map.has(ticker)) map.set(ticker, cik);
  }
  return map;
}

/* ----------------------------------------------------------------------------
 * XBRL frames
 * -------------------------------------------------------------------------- */

interface Frame {
  byCik: Map<number, number>;
  count: number;
}

async function fetchFrame(path: string, timeoutMs: number): Promise<Frame> {
  const body = await secJson<{ data?: { cik: number; val: number }[] }>(
    `https://data.sec.gov/api/xbrl/frames/${path}.json`,
    timeoutMs,
  );
  const byCik = new Map<number, number>();
  for (const d of body.data ?? []) {
    if (typeof d.cik === "number" && typeof d.val === "number" && Number.isFinite(d.val) && !byCik.has(d.cik)) {
      byCik.set(d.cik, d.val);
    }
  }
  return { byCik, count: byCik.size };
}

interface Quarter {
  y: number;
  q: number;
}

/** The most recently ENDED calendar quarter as of d. */
function prevQuarter(d: Date): Quarter {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1; // current quarter
  return q === 1 ? { y: y - 1, q: 4 } : { y, q: q - 1 };
}

const backOne = (x: Quarter): Quarter => (x.q === 1 ? { y: x.y - 1, q: 4 } : { y: x.y, q: x.q - 1 });
const instPeriod = (x: Quarter) => `CY${x.y}Q${x.q}I`;
const quarterLabel = (x: Quarter) => `Q${x.q} ${x.y}`;

/** Sparse-frame floor: the just-ended quarter's frame stays near-empty until 10-Qs land. */
const MIN_INSTANT_ENTRIES = 1000;
const MIN_ANNUAL_ENTRIES = 1500;

export interface SecFetchOptions {
  timeoutMs: number;
  now?: Date;
}

/**
 * Full enrichment for the given tickers. Throws only if the CIK map itself is
 * unreachable; individual frame failures degrade to missing metrics (recorded
 * in meta.failures) — the screen fails open per metric by design.
 */
export async function fetchSecEnrichment(tickers: string[], opts: SecFetchOptions): Promise<SecEnrichment> {
  const { timeoutMs } = opts;
  const now = opts.now ?? new Date();
  const failures: string[] = [];
  const cikMap = await fetchCikMap(timeoutMs);

  const frame = async (path: string): Promise<Frame | null> => {
    try {
      return await fetchFrame(path, timeoutMs);
    } catch (e) {
      failures.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  /* Instant periods: use the dei share-count frame as the coverage oracle —
   * if the just-ended quarter is still sparse, every us-gaap instant frame is too. */
  const qNew = prevQuarter(now);
  const qOld = backOne(qNew);
  let sharesNow = await frame(`dei/EntityCommonStockSharesOutstanding/shares/${instPeriod(qNew)}`);
  let sharesQuarter = qNew;
  const newQuarterRich = (sharesNow?.count ?? 0) >= MIN_INSTANT_ENTRIES;
  if (!newQuarterRich) {
    sharesNow = await frame(`dei/EntityCommonStockSharesOutstanding/shares/${instPeriod(qOld)}`);
    sharesQuarter = qOld;
  }
  const sharesPrior = sharesNow
    ? await frame(`dei/EntityCommonStockSharesOutstanding/shares/${instPeriod({ y: sharesQuarter.y - 1, q: sharesQuarter.q })}`)
    : null;

  /** Instant concept: newest usable quarter, backfilled from the one before (newest value wins per CIK). */
  const instant = async (tag: string): Promise<Map<number, number>> => {
    const periods = newQuarterRich ? [qNew, qOld] : [qOld];
    const merged = new Map<number, number>();
    for (const p of periods) {
      const f = await frame(`us-gaap/${tag}/USD/${instPeriod(p)}`);
      if (!f) continue;
      for (const [cik, val] of f.byCik) if (!merged.has(cik)) merged.set(cik, val);
    }
    return merged;
  };

  /**
   * Annual concept: latest full calendar year per CIK, PLUS the year
   * immediately before it on the same tag (the growth/trajectory base — a
   * skipped year or a tag switch would corrupt YoY math, so `prior` is only
   * set when the consecutive same-tag year exists). One extra year of
   * backfill applies while the newest 10-Ks are still landing, exactly as
   * before.
   */
  const annual = async (
    tag: string,
  ): Promise<{ latest: Map<number, number>; prior: Map<number, number>; label: string }> => {
    const y1 = now.getUTCFullYear() - 1;
    const f1 = await frame(`us-gaap/${tag}/USD/CY${y1}`);
    const f0 = await frame(`us-gaap/${tag}/USD/CY${y1 - 1}`);
    const y1Sparse = (f1?.count ?? 0) < MIN_ANNUAL_ENTRIES;
    const fm1 = y1Sparse ? await frame(`us-gaap/${tag}/USD/CY${y1 - 2}`) : null;
    const latest = new Map<number, number>();
    const prior = new Map<number, number>();
    for (const [cik, val] of f1?.byCik ?? []) {
      latest.set(cik, val);
      const p = f0?.byCik.get(cik);
      if (p !== undefined) prior.set(cik, p);
    }
    if (y1Sparse && f0) {
      for (const [cik, val] of f0.byCik) {
        if (latest.has(cik)) continue;
        latest.set(cik, val);
        const p = fm1?.byCik.get(cik);
        if (p !== undefined) prior.set(cik, p);
      }
    }
    return { latest, prior, label: y1Sparse && f0 ? `FY${y1 - 1}–${y1}` : `FY${y1}` };
  };

  const cashPrimary = await instant("CashAndCashEquivalentsAtCarryingValue");
  const cashWithRestricted = await instant("CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents");
  const sti1 = await instant("ShortTermInvestments");
  const sti2 = await instant("MarketableSecuritiesCurrent");
  const sti3 = await instant("AvailableForSaleSecuritiesDebtSecuritiesCurrent");
  const equity = await instant("StockholdersEquity");
  const ocf = await annual("NetCashProvidedByUsedInOperatingActivities");
  const revContract = await annual("RevenueFromContractWithCustomerExcludingAssessedTax");
  const revPlain = await annual("Revenues");

  const byTicker: Record<string, SecFundamentals> = {};
  let withData = 0;
  for (const raw of tickers) {
    const ticker = raw.toUpperCase();
    const cik = cikMap.get(ticker);
    if (cik === undefined) continue;
    const f: SecFundamentals = { cik };
    const cash = cashPrimary.get(cik) ?? cashWithRestricted.get(cik);
    if (cash !== undefined) f.cash = cash;
    const stis = [sti1.get(cik), sti2.get(cik), sti3.get(cik)].filter((x): x is number => x !== undefined);
    if (stis.length > 0) f.sti = Math.max(...stis);
    const o = ocf.latest.get(cik);
    if (o !== undefined) {
      f.ocf = o;
      const o0 = ocf.prior.get(cik);
      if (o0 !== undefined) f.ocf0 = o0;
    }
    // Revenue chains stay tag-consistent: the prior year must come from the SAME tag as the latest.
    const rc = revContract.latest.get(cik);
    const rp = rc === undefined ? revPlain.latest.get(cik) : undefined;
    if (rc !== undefined) {
      f.rev = rc;
      const r0 = revContract.prior.get(cik);
      if (r0 !== undefined) f.rev0 = r0;
    } else if (rp !== undefined) {
      f.rev = rp;
      const r0 = revPlain.prior.get(cik);
      if (r0 !== undefined) f.rev0 = r0;
    }
    const e = equity.get(cik);
    if (e !== undefined) f.eqy = e;
    const sNow = sharesNow?.byCik.get(cik);
    const sPrior = sharesPrior?.byCik.get(cik);
    if (sNow !== undefined && sPrior !== undefined && sPrior > 100_000 && sNow > 0) {
      f.shGrowthPct = Math.round(((sNow - sPrior) / sPrior) * 1000) / 10;
    }
    if (
      f.cash !== undefined || f.sti !== undefined || f.ocf !== undefined ||
      f.rev !== undefined || f.eqy !== undefined || f.shGrowthPct !== undefined
    ) {
      withData++;
    }
    byTicker[ticker] = f;
  }

  return {
    byTicker,
    meta: {
      fetchedAt: new Date().toISOString(),
      mapEntries: cikMap.size,
      withData,
      instantLabel: quarterLabel(newQuarterRich ? qNew : qOld),
      fiscalLabel: ocf.label,
      sharesLabel: `${quarterLabel(sharesQuarter)} vs ${quarterLabel({ y: sharesQuarter.y - 1, q: sharesQuarter.q })}`,
      failures,
    },
  };
}

/** Liquid assets for runway math: cash plus current securities (either may be absent). */
export function liquidAssets(f: SecFundamentals): number | null {
  if (f.cash === undefined && f.sti === undefined) return null;
  return (f.cash ?? 0) + (f.sti ?? 0);
}

/** Cash runway in years against latest-FY burn; null when not burning or data missing. */
export function runwayYears(f: SecFundamentals): number | null {
  const liquid = liquidAssets(f);
  if (liquid === null || f.ocf === undefined || f.ocf >= 0) return null;
  return liquid / -f.ocf;
}

/** Tiny-base floor for YoY growth math: below this, percentages are reclassification noise, not signal. */
export const GROWTH_MIN_BASE_USD = 5_000_000;

/** Same-tag, consecutive-fiscal-year revenue growth (percent); null when either year is missing or the base year is tiny. */
export function revGrowthPct(f: SecFundamentals): number | null {
  if (f.rev === undefined || f.rev0 === undefined || f.rev0 < GROWTH_MIN_BASE_USD) return null;
  return ((f.rev - f.rev0) / f.rev0) * 100;
}
