import {
  getUniverseSnapshot,
  isoWeekKey,
  latestUniverseSnapshot,
  saveUniverseSnapshot,
  type UniverseSnapshotRow,
} from "./db";
import { fetchSecEnrichment, liquidAssets, runwayYears, type SecEnrichment, type SecFundamentals } from "./sec";
import { universeSettings, type UniverseSettings } from "./universe-settings";

/* ============================================================================
 * Stage 0 — deterministic universe screen (server-only, $0, no model).
 *
 * Before discovery runs, the whole US primary-exchange universe (~7,100
 * listings across NYSE, Nasdaq, and NYSE American) is pulled and filtered
 * mechanically, then enriched with structured SEC filings data (lib/sec.ts):
 * market-cap band, liquidity and price floors, pooled-vehicle and listing-age
 * hygiene, and solvency screens (cash runway, shell signature, optional
 * share-issuance cap) — every threshold owner-tunable via
 * lib/universe-settings.ts (defaults → env → /admin overrides), nothing
 * hard-coded. A sector-stratified, week-seeded rotation of the eligible set
 * is injected into the discovery prompt as the scout's long-list, and the
 * same snapshot data (a) deterministically checks delivered picks, turning
 * breaches into disclosed gap notes, and (b) hands each lens a verified
 * per-ticker reference block so grounding starts from filings, not from
 * model recall.
 *
 * Caching: one RAW snapshot (listings + SEC fundamentals) per ISO week in
 * SQLite; the screen itself is recomputed on read from the snapshot plus the
 * CURRENT settings, so tuning applies instantly without refetching and re-runs
 * within a week stay deterministic.
 *
 * Fail-open by design, at every layer: AMEX missing → proceed without it
 * (NYSE+Nasdaq stay all-or-nothing); SEC unreachable → fundamentals screens
 * skip, disclosed; full fetch failure → most recent cached week (disclosed as
 * stale); no snapshot at all → discovery runs unscreened, exactly as it did
 * before Stage 0 existed. A flaky third party must never fail a run.
 * Kill switch: MAG8_UNIVERSE=0.
 * ========================================================================== */

/** Kill switch: MAG8_UNIVERSE=0 disables the screen entirely (env-only, supreme). */
export function universeEnabled(): boolean {
  return process.env.MAG8_UNIVERSE !== "0";
}

/** One listed name, normalized. Keys are short — thousands of rows persist per weekly snapshot. */
export interface UniverseRow {
  /** Ticker symbol. */
  t: string;
  /** Company name, trailing instrument descriptors stripped. */
  n: string;
  /** Screener sector, "Other" when blank. */
  s: string;
  /** Market cap, USD. */
  c: number;
  /** Day share volume. */
  v: number;
  /** Last sale price, USD. */
  p: number;
  /** Exchange code (absent on pre-v2 snapshot rows). */
  x?: string;
  /** Screener industry (absent when blank / pre-v2). */
  i?: string;
  /** IPO calendar year (absent when unknown / pre-v2). */
  y?: number;
}

/** Snapshot enrichment: which exchanges actually landed + SEC fundamentals (null = SEC unavailable that week). */
export interface UniverseExtras {
  exchanges: string[];
  sec: SecEnrichment | null;
}

/** One screening step's outcome, in application order. */
export interface FunnelStep {
  key: string;
  label: string;
  removed: number;
  /** For data-dependent screens: how many names had the data to be evaluated (the rest pass open). */
  evaluated?: number;
}

/** What the discovery prompt receives. */
export interface UniversePool {
  weekKey: string;
  fetchedAt: string;
  /** True when the snapshot is from an earlier week (this week's refresh failed). */
  stale: boolean;
  /** Raw listings fetched across exchanges, pre-normalization. */
  totalListed: number;
  eligibleCount: number;
  /** Human-readable restatement of the hard criteria — single source: the effective settings. */
  criteria: string;
  /** Screening funnel, in order (admin preview + activity feed). */
  funnel: FunnelStep[];
  /** SEC fundamentals coverage across the band-eligible set. */
  secCoverage: { withData: number; total: number } | null;
  /** The sector-stratified, week-seeded slice shown to the scout. */
  shown: UniverseRow[];
}

export interface UniverseResult {
  pool: UniversePool;
  /** Full normalized snapshot (every cap, band-unfiltered) — checks delivered picks. */
  rows: UniverseRow[];
  extras: UniverseExtras | null;
  /** The settings the screen ran with — flags reuse them so one run is internally consistent. */
  settings: UniverseSettings;
}

export function fmtMarketCap(c: number): string {
  return c >= 1e9 ? `$${(c / 1e9).toFixed(1).replace(/\.0$/, "")}B` : `$${Math.round(c / 1e6)}M`;
}

const fmtQuarters = (years: number) => {
  const q = Math.round(years * 4 * 10) / 10;
  return `${q} quarter${q === 1 ? "" : "s"}`;
};

/** Public-safe restatement of every ENABLED screen — reaches the discovery prompt and marketContext. */
function criteriaText(u: UniverseSettings, secAvailable: boolean, now: Date): string {
  const parts = [
    `${u.includeAmex ? "NYSE/Nasdaq/NYSE American" : "NYSE/Nasdaq"} common stock or ADR`,
    `market cap ${fmtMarketCap(u.mcapMinUsd)}–${fmtMarketCap(u.mcapMaxUsd)}`,
    `day traded value ≥ ${fmtMarketCap(u.minDollarVolumeUsd)}`,
  ];
  if (u.priceMinUsd > 0) parts.push(`price ≥ $${u.priceMinUsd}`);
  if (u.minListingYears > 0) parts.push(`listed before ${now.getUTCFullYear() - u.minListingYears + 1}`);
  if (u.fundVehicleScreen) parts.push("no pooled fund vehicles");
  if (secAvailable && u.secEnrich) {
    const solvency: string[] = [];
    if (u.runwayScreen) solvency.push(`cash runway ≥ ${fmtQuarters(u.runwayMinYears)} at trailing burn`);
    if (u.zombieScreen) solvency.push("no shell signatures");
    if (u.dilutionScreen) solvency.push(`share-count growth ≤ ${u.maxDilutionPct}%/yr`);
    if (solvency.length > 0) parts.push(`solvency-screened on SEC filings (${solvency.join("; ")})`);
  }
  return parts.join(", ");
}

/* ----------------------------------------------------------------------------
 * Fetch + normalize
 * -------------------------------------------------------------------------- */

interface RawScreenerRow {
  symbol?: string;
  name?: string;
  lastsale?: string;
  marketCap?: string;
  volume?: string;
  sector?: string;
  industry?: string;
  ipoyear?: string;
  country?: string;
}

/** NYSE+Nasdaq are all-or-nothing (a half universe would bias the screen); AMEX is additive and fail-open. */
const CORE_EXCHANGES = ["NASDAQ", "NYSE"] as const;
const OPTIONAL_EXCHANGE = "AMEX";
/** A feed suddenly returning far fewer names than the real universe is a broken feed, not a small market. */
const MIN_PLAUSIBLE_ROWS = 3000;

/** Listed instruments that are not plain common stock / ADR (units, warrants, preferreds, notes). */
const NON_COMMON_NAME =
  /\b(warrants?|rights?|units?|preferred|preference|depositary shares?,? each representing|% notes|notes due|debentures?|bonds due)\b/i;

/**
 * Pooled investment vehicles (closed-end funds and kin) hiding behind common
 * shares: fund-structure tokens next to Fund/Trust. Deliberately narrow —
 * operating REITs ("Realty/Property Trust") and banks ("Northern Trust") do
 * not match. Probe-validated 2026-07-13 against the live eligible set.
 */
const FUND_VEHICLE_NAME =
  /\b(?:closed[- ]end|term trust|equity trust|interval fund|fund of funds|(?:income|bond|municipal|allocation|dividend|total return|opportunit\w*|floating rate|senior loan|senior income|tax[- ](?:free|exempt|advantaged)|multi[- ]?sector|credit|high yield|preferred|strategies|value|global income|equity income|equity dividend)\s+(?:fund|trust))\b|\bfund,?\s+inc\b/i;

/** Trailing security-type descriptors, stripped for compact prompt tables. */
const NAME_SUFFIX =
  /\s+(?:(?:Class|Series) [A-Z0-9]+ )?(?:Common Stock|Ordinary Shares?|Common Shares?|American Depositary Shares?\b.*|Depositary Shares?\b.*|ADS\b.*|ADR\b.*)\s*$/i;

function parseNum(s: string | undefined): number | null {
  if (typeof s !== "string") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchExchange(exchange: string, timeoutMs: number): Promise<RawScreenerRow[]> {
  const url = `https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25&offset=0&exchange=${exchange}&download=true`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`universe feed ${exchange}: HTTP ${res.status}`);
  const body = (await res.json()) as {
    data?: { rows?: RawScreenerRow[]; table?: { rows?: RawScreenerRow[] } };
  };
  const rows = body.data?.rows ?? body.data?.table?.rows;
  if (!Array.isArray(rows)) throw new Error(`universe feed ${exchange}: unrecognized payload shape`);
  return rows;
}

async function fetchUniverse(
  u: UniverseSettings,
): Promise<{ totalListed: number; rows: UniverseRow[]; exchanges: string[] }> {
  const core = await Promise.all(CORE_EXCHANGES.map((ex) => fetchExchange(ex, u.fetchTimeoutMs)));
  const exchanges: string[] = [...CORE_EXCHANGES];
  const perExchange: { ex: string; rows: RawScreenerRow[] }[] = CORE_EXCHANGES.map((ex, idx) => ({
    ex,
    rows: core[idx],
  }));
  if (u.includeAmex) {
    try {
      perExchange.push({ ex: OPTIONAL_EXCHANGE, rows: await fetchExchange(OPTIONAL_EXCHANGE, u.fetchTimeoutMs) });
      exchanges.push(OPTIONAL_EXCHANGE);
    } catch {
      /* additive exchange — proceed without it; extras.exchanges discloses the omission */
    }
  }

  const seen = new Set<string>();
  const rows: UniverseRow[] = [];
  let totalListed = 0;
  for (const { ex, rows: raw } of perExchange) {
    totalListed += raw.length;
    for (const r of raw) {
      const t = (r.symbol ?? "").trim().toUpperCase();
      const rawName = (r.name ?? "").trim();
      if (!/^[A-Z]{1,5}$/.test(t) || seen.has(t)) continue;
      if (!rawName || NON_COMMON_NAME.test(rawName)) continue;
      const c = parseNum(r.marketCap);
      const p = parseNum(r.lastsale);
      if (c === null || c <= 0 || p === null || p <= 0) continue;
      seen.add(t);
      const n = rawName.replace(NAME_SUFFIX, "").trim() || rawName;
      const row: UniverseRow = { t, n, s: (r.sector ?? "").trim() || "Other", c, v: parseNum(r.volume) ?? 0, p, x: ex };
      const industry = (r.industry ?? "").trim();
      if (industry) row.i = industry;
      const y = (r.ipoyear ?? "").trim();
      if (/^\d{4}$/.test(y)) row.y = Number(y);
      rows.push(row);
    }
  }
  if (rows.length < MIN_PLAUSIBLE_ROWS) {
    throw new Error(`universe feed implausibly small: ${rows.length} normalized rows`);
  }
  return { totalListed, rows, exchanges };
}

/* ----------------------------------------------------------------------------
 * The screen — pure function of (snapshot, settings); recomputed on read
 * -------------------------------------------------------------------------- */

const secOf = (extras: UniverseExtras | null, t: string): SecFundamentals | undefined =>
  extras?.sec?.byTicker[t];

/** Shell signature: a us-gaap filer reporting burn and negative equity with essentially no revenue. A filer with OCF and equity tagged but no revenue tag has none to report — that counts as zero here, not as missing data. */
function isZombie(f: SecFundamentals, maxRevenueUsd: number): boolean {
  return f.ocf !== undefined && f.ocf < 0 && f.eqy !== undefined && f.eqy < 0 && (f.rev ?? 0) <= maxRevenueUsd;
}

export interface ScreenOutcome {
  eligible: UniverseRow[];
  funnel: FunnelStep[];
  secCoverage: { withData: number; total: number } | null;
}

export function screenUniverse(
  rows: UniverseRow[],
  extras: UniverseExtras | null,
  u: UniverseSettings,
  now: Date = new Date(),
): ScreenOutcome {
  const funnel: FunnelStep[] = [];
  const step = (key: string, label: string, keep: (r: UniverseRow) => boolean, evaluated?: number) => {
    const before = pool.length;
    pool = pool.filter(keep);
    funnel.push({ key, label, removed: before - pool.length, ...(evaluated !== undefined ? { evaluated } : {}) });
  };

  let pool = rows;
  step("band", "market-cap band", (r) => r.c >= u.mcapMinUsd && r.c <= u.mcapMaxUsd);
  step("liquidity", "day traded value floor", (r) => r.v * r.p >= u.minDollarVolumeUsd);
  if (u.priceMinUsd > 0) step("price", "minimum share price", (r) => r.p >= u.priceMinUsd);
  if (u.fundVehicleScreen) step("fund", "pooled investment vehicles", (r) => !FUND_VEHICLE_NAME.test(r.n));
  if (u.minListingYears > 0) {
    const cutoff = now.getUTCFullYear() - u.minListingYears;
    step("listingAge", "minimum listing age", (r) => r.y === undefined || r.y <= cutoff);
  }

  const sec = u.secEnrich ? extras?.sec : null;
  let secCoverage: ScreenOutcome["secCoverage"] = null;
  if (sec) {
    const withData = pool.filter((r) => {
      const f = sec.byTicker[r.t];
      return f !== undefined && (f.cash !== undefined || f.ocf !== undefined || f.eqy !== undefined);
    }).length;
    secCoverage = { withData, total: pool.length };

    if (u.runwayScreen) {
      let evaluated = 0;
      step(
        "runway",
        "cash runway",
        (r) => {
          if (u.runwayExemptFinance && r.s === "Finance") return true;
          const f = sec.byTicker[r.t];
          if (!f) return true;
          const ry = runwayYears(f);
          if (ry === null) return true; // not burning, or data missing → pass open
          evaluated++;
          return ry >= u.runwayMinYears;
        },
        // evaluated is finalized after the filter runs; patch it below
      );
      funnel[funnel.length - 1].evaluated = evaluated;
    }
    if (u.zombieScreen) {
      step("zombie", "shell signature", (r) => {
        const f = sec.byTicker[r.t];
        return !f || !isZombie(f, u.zombieMaxRevenueUsd);
      });
    }
    if (u.dilutionScreen) {
      let evaluated = 0;
      step("dilution", "share issuance", (r) => {
        const f = sec.byTicker[r.t];
        if (!f || f.shGrowthPct === undefined) return true;
        evaluated++;
        return f.shGrowthPct <= u.maxDilutionPct;
      });
      funnel[funnel.length - 1].evaluated = evaluated;
    }
  }

  return { eligible: pool, funnel, secCoverage };
}

/* ----------------------------------------------------------------------------
 * Week-seeded stratified slice
 * -------------------------------------------------------------------------- */

/** Tiny deterministic PRNG (xmur3 seed + mulberry32) — the slice must be stable within a week. */
function seededRandom(key: string): () => number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

const bySectorThenCap = (a: UniverseRow, b: UniverseRow) =>
  a.s.localeCompare(b.s) || b.c - a.c || a.t.localeCompare(b.t);

/**
 * Proportional per-sector quotas (largest-remainder rounding), seeded shuffle
 * within each sector, quota picks concatenated. Every sector appears; the
 * slice rotates deterministically with the week key.
 */
function stratifiedSlice(eligible: UniverseRow[], size: number, seedKey: string): UniverseRow[] {
  if (eligible.length <= size) return [...eligible].sort(bySectorThenCap);

  const groups = new Map<string, UniverseRow[]>();
  for (const r of eligible) {
    const g = groups.get(r.s);
    if (g) g.push(r);
    else groups.set(r.s, [r]);
  }
  const names = [...groups.keys()].sort();
  const quotas = new Map<string, number>();
  const remainders: { name: string; frac: number }[] = [];
  let assigned = 0;
  for (const name of names) {
    const exact = (size * groups.get(name)!.length) / eligible.length;
    const base = Math.floor(exact);
    quotas.set(name, base);
    assigned += base;
    remainders.push({ name, frac: exact - base });
  }
  remainders.sort((a, b) => b.frac - a.frac || a.name.localeCompare(b.name));
  for (const r of remainders) {
    if (assigned >= size) break;
    quotas.set(r.name, quotas.get(r.name)! + 1);
    assigned++;
  }

  const rand = seededRandom(seedKey);
  const picked: UniverseRow[] = [];
  for (const name of names) {
    const rows = [...groups.get(name)!].sort((a, b) => a.t.localeCompare(b.t));
    shuffleInPlace(rows, rand);
    picked.push(...rows.slice(0, quotas.get(name)!));
  }
  return picked.sort(bySectorThenCap);
}

/* ----------------------------------------------------------------------------
 * Entry points
 * -------------------------------------------------------------------------- */

function buildResult(snap: UniverseSnapshotRow, u: UniverseSettings, week: string): UniverseResult | null {
  const screened = screenUniverse(snap.rows, snap.extras, u);
  // A pool this thin means broken feed data or nonsensical knobs — run unscreened.
  if (screened.eligible.length < 10) return null;
  return {
    pool: {
      weekKey: snap.isoWeek,
      fetchedAt: snap.fetchedAt,
      stale: snap.isoWeek !== week,
      totalListed: snap.totalListed,
      eligibleCount: screened.eligible.length,
      criteria: criteriaText(u, Boolean(snap.extras?.sec), new Date()),
      funnel: screened.funnel,
      secCoverage: screened.secCoverage,
      shown: stratifiedSlice(screened.eligible, u.poolSize, snap.isoWeek),
    },
    rows: snap.rows,
    extras: snap.extras,
    settings: u,
  };
}

/**
 * This week's screened universe: cached snapshot, else live fetch (persisted),
 * else the most recent prior week (stale, disclosed), else null. The screen is
 * recomputed from the raw snapshot with the CURRENT settings on every call.
 * Never throws.
 */
export async function getWeeklyUniverse(force = false): Promise<UniverseResult | null> {
  if (!universeEnabled()) return null;
  try {
    const u = universeSettings();
    const week = isoWeekKey();
    let snap = force ? null : getUniverseSnapshot(week);
    if (!snap) {
      try {
        const fetched = await fetchUniverse(u);
        let sec: SecEnrichment | null = null;
        if (u.secEnrich) {
          try {
            sec = await fetchSecEnrichment(fetched.rows.map((r) => r.t), { timeoutMs: u.secTimeoutMs });
          } catch {
            sec = null; // SEC down ≠ screen down: fundamentals screens skip, disclosed via coverage
          }
        }
        const extras: UniverseExtras = { exchanges: fetched.exchanges, sec };
        saveUniverseSnapshot(week, fetched.totalListed, fetched.rows, extras);
        snap = { isoWeek: week, fetchedAt: new Date().toISOString(), totalListed: fetched.totalListed, rows: fetched.rows, extras };
      } catch {
        // Includes the force-refresh-failed case: any cached week beats nothing.
        snap = getUniverseSnapshot(week) ?? latestUniverseSnapshot();
      }
    }
    if (!snap) return null;
    return buildResult(snap, u, week);
  } catch {
    return null; // Stage 0 must never fail a run
  }
}

/** One-line funnel narration for the activity feed and admin preview. */
export function describeScreen(pool: UniversePool): string {
  const screens = pool.funnel.filter((f) => f.removed > 0).map((f) => `${f.label} −${f.removed}`);
  const sec = pool.secCoverage
    ? `; SEC filings data on ${pool.secCoverage.withData.toLocaleString("en-US")} of ${pool.secCoverage.total.toLocaleString("en-US")}`
    : "";
  return (
    `${pool.totalListed.toLocaleString("en-US")} US-listed names → ${pool.eligibleCount.toLocaleString("en-US")} eligible` +
    (screens.length > 0 ? ` (${screens.join(", ")})` : "") +
    sec +
    `; a ${pool.shown.length}-name slice goes to the scout` +
    (pool.stale ? " (carried forward from the last successful refresh)" : "")
  );
}

/* ----------------------------------------------------------------------------
 * Deterministic checks on delivered picks + lens ground truth
 * -------------------------------------------------------------------------- */

/**
 * Deterministic screen check on the delivered picks. Only judges names present
 * in the snapshot (a missing name may be a brand-new listing); band edges get
 * the configured slack so honest borderline picks stay unflagged. Public-safe
 * wording — these strings reach the compiler's known gaps AND the published
 * gapsNoted. Data gaps stay silent by design: absence of data is not a flag.
 */
export function universeScreenFlags(
  candidates: readonly { ticker: string }[],
  universe: UniverseResult,
): string[] {
  const u = universe.settings;
  const slack = u.bandSlackPct / 100;
  const byTicker = new Map(universe.rows.map((r) => [r.t, r]));
  const flags: string[] = [];
  for (const c of candidates) {
    const row = byTicker.get(c.ticker);
    if (!row) continue;
    if (row.c > u.mcapMaxUsd * (1 + slack)) {
      flags.push(
        `${c.ticker}: the weekly universe screen lists its market cap near ${fmtMarketCap(row.c)} — above the ${fmtMarketCap(u.mcapMaxUsd)} ceiling of the discovery band; kept as an out-of-band exception.`,
      );
    } else if (row.c < u.mcapMinUsd * (1 - slack)) {
      flags.push(
        `${c.ticker}: the weekly universe screen lists its market cap near ${fmtMarketCap(row.c)} — below the ${fmtMarketCap(u.mcapMinUsd)} floor of the discovery band; expect outsized volatility and speculative risk.`,
      );
    }
    if (u.priceMinUsd > 0 && row.p < u.priceMinUsd) {
      flags.push(
        `${c.ticker}: last sale $${row.p} sits under the screen's $${u.priceMinUsd} minimum price — very low-priced shares carry lottery-type risk.`,
      );
    }
    const f = secOf(universe.extras, c.ticker);
    if (!f) continue;
    const ry = runwayYears(f);
    if (ry !== null && ry < u.runwayMinYears && !(u.runwayExemptFinance && row.s === "Finance")) {
      flags.push(
        `${c.ticker}: latest SEC filings imply roughly ${fmtQuarters(ry)} of cash runway at the trailing-year burn rate — under the screen's ${fmtQuarters(u.runwayMinYears)} solvency bar; financing risk is live.`,
      );
    }
    if (isZombie(f, u.zombieMaxRevenueUsd)) {
      flags.push(
        `${c.ticker}: latest SEC filings show a shell signature — negligible revenue, negative operating cash flow, and negative stockholders' equity together.`,
      );
    }
    if (f.shGrowthPct !== undefined && f.shGrowthPct > u.maxDilutionPct) {
      flags.push(
        `${c.ticker}: SEC cover-page share counts grew ~${Math.round(f.shGrowthPct)}% year over year — could be issuance, a split, or stock-funded M&A; verify dilution before sizing.`,
      );
    }
  }
  return flags;
}

/** Deterministic per-ticker reference data injected into lens prompts (null when the ticker is not in the snapshot). */
export interface LensGroundTruth {
  weekKey: string;
  fetchedAt: string;
  price: number;
  marketCap: number;
  dayDollarVolume: number;
  sector: string;
  sec?: {
    cash?: number;
    sti?: number;
    ocf?: number;
    rev?: number;
    eqy?: number;
    shGrowthPct?: number;
    runwayYears?: number;
    instantLabel: string;
    fiscalLabel: string;
    sharesLabel: string;
  };
}

export function lensGroundTruth(ticker: string, universe: UniverseResult): LensGroundTruth | null {
  const row = universe.rows.find((r) => r.t === ticker);
  if (!row) return null;
  const out: LensGroundTruth = {
    weekKey: universe.pool.weekKey,
    fetchedAt: universe.pool.fetchedAt,
    price: row.p,
    marketCap: row.c,
    dayDollarVolume: Math.round(row.v * row.p),
    sector: row.s,
  };
  const f = secOf(universe.extras, ticker);
  const meta = universe.extras?.sec?.meta;
  if (f && meta) {
    const ry = runwayYears(f);
    out.sec = {
      ...(f.cash !== undefined ? { cash: f.cash } : {}),
      ...(f.sti !== undefined ? { sti: f.sti } : {}),
      ...(f.ocf !== undefined ? { ocf: f.ocf } : {}),
      ...(f.rev !== undefined ? { rev: f.rev } : {}),
      ...(f.eqy !== undefined ? { eqy: f.eqy } : {}),
      ...(f.shGrowthPct !== undefined ? { shGrowthPct: f.shGrowthPct } : {}),
      ...(ry !== null ? { runwayYears: Math.round(ry * 100) / 100 } : {}),
      instantLabel: meta.instantLabel,
      fiscalLabel: meta.fiscalLabel,
      sharesLabel: meta.sharesLabel,
    };
    if (liquidAssets(f) === null && f.ocf === undefined && f.eqy === undefined && f.rev === undefined && f.shGrowthPct === undefined) {
      delete out.sec;
    }
  }
  return out;
}
