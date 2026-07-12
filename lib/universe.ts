import { CONFIG } from "./config";
import { getUniverseSnapshot, isoWeekKey, latestUniverseSnapshot, saveUniverseSnapshot } from "./db";

/* ============================================================================
 * Stage 0 — deterministic universe screen (server-only, $0, no model).
 *
 * Before discovery runs, the whole US primary-exchange universe (~6,800
 * listings) is pulled and filtered mechanically: NYSE/Nasdaq common stock and
 * ADRs only, market-cap band, day-dollar-volume floor. A sector-stratified,
 * week-seeded rotation of the eligible set (~2,200 names → poolSize) is
 * injected into the discovery prompt as the scout's long-list, so candidate
 * sourcing starts from the full market instead of from whatever names web
 * narrative happens to surface. The full snapshot also band-checks the
 * delivered picks — an out-of-band pick becomes a disclosed gap note
 * (2026-07 audit: real runs had delivered $56–122B names into a $1–50B
 * mandate with no enforcement).
 *
 * Data source: Nasdaq's public screener JSON (api.nasdaq.com, keyless; needs
 * a browser-ish User-Agent, ~1s per exchange). One snapshot per ISO week is
 * cached in SQLite — the same freshness window as the lens cache — and the
 * week-seeded slice is deterministic, so re-runs within a week see the same
 * pool while successive weeks sweep the whole eligible set.
 *
 * Fail-open by design: a fetch failure falls back to the most recent cached
 * week (disclosed as stale in the prompt and activity feed); no snapshot at
 * all means discovery simply runs unscreened, exactly as it did before
 * Stage 0 existed. A flaky third party must never fail a run.
 * Kill switch: MAG8_UNIVERSE=0.
 * ========================================================================== */

/** Kill switch: MAG8_UNIVERSE=0 disables the screen entirely. */
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
  /** Human-readable restatement of the hard criteria — single source: CONFIG.universe. */
  criteria: string;
  /** The sector-stratified, week-seeded slice shown to the scout. */
  shown: UniverseRow[];
}

export interface UniverseResult {
  pool: UniversePool;
  /** Full normalized snapshot (every cap, band-unfiltered) — band-checks delivered picks. */
  rows: UniverseRow[];
}

export function fmtMarketCap(c: number): string {
  return c >= 1e9 ? `$${(c / 1e9).toFixed(1).replace(/\.0$/, "")}B` : `$${Math.round(c / 1e6)}M`;
}

function criteriaText(): string {
  const u = CONFIG.universe;
  return `NYSE/Nasdaq common stock or ADR, market cap ${fmtMarketCap(u.mcapMinUsd)}–${fmtMarketCap(u.mcapMaxUsd)}, day traded value ≥ ${fmtMarketCap(u.minDollarVolumeUsd)}`;
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
}

const EXCHANGES = ["NASDAQ", "NYSE"] as const;
/** A feed suddenly returning far fewer names than the real universe is a broken feed, not a small market. */
const MIN_PLAUSIBLE_ROWS = 3000;

/** Listed instruments that are not plain common stock / ADR (units, warrants, preferreds, notes). */
const NON_COMMON_NAME =
  /\b(warrants?|rights?|units?|preferred|preference|depositary shares?,? each representing|% notes|notes due|debentures?|bonds due)\b/i;

/** Trailing security-type descriptors, stripped for compact prompt tables. */
const NAME_SUFFIX =
  /\s+(?:(?:Class|Series) [A-Z0-9]+ )?(?:Common Stock|Ordinary Shares?|Common Shares?|American Depositary Shares?\b.*|Depositary Shares?\b.*|ADS\b.*|ADR\b.*)\s*$/i;

function parseNum(s: string | undefined): number | null {
  if (typeof s !== "string") return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchExchange(exchange: (typeof EXCHANGES)[number]): Promise<RawScreenerRow[]> {
  const url = `https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25&offset=0&exchange=${exchange}&download=true`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(CONFIG.universe.fetchTimeoutMs),
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

/** Both exchanges or nothing — a partial universe would silently bias the screen. */
async function fetchUniverse(): Promise<{ totalListed: number; rows: UniverseRow[] }> {
  const perExchange = await Promise.all(EXCHANGES.map(fetchExchange));
  const raw = perExchange.flat();
  const seen = new Set<string>();
  const rows: UniverseRow[] = [];
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
    rows.push({ t, n, s: (r.sector ?? "").trim() || "Other", c, v: parseNum(r.volume) ?? 0, p });
  }
  if (rows.length < MIN_PLAUSIBLE_ROWS) {
    throw new Error(`universe feed implausibly small: ${rows.length} normalized rows`);
  }
  return { totalListed: raw.length, rows };
}

/* ----------------------------------------------------------------------------
 * Eligibility + week-seeded stratified slice
 * -------------------------------------------------------------------------- */

function filterEligible(rows: UniverseRow[]): UniverseRow[] {
  const u = CONFIG.universe;
  return rows.filter((r) => r.c >= u.mcapMinUsd && r.c <= u.mcapMaxUsd && r.v * r.p >= u.minDollarVolumeUsd);
}

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

/**
 * This week's screened universe: cached snapshot, else live fetch (persisted),
 * else the most recent prior week (stale, disclosed), else null. Never throws.
 */
export async function getWeeklyUniverse(force = false): Promise<UniverseResult | null> {
  if (!universeEnabled()) return null;
  try {
    const week = isoWeekKey();
    let snap = force ? null : getUniverseSnapshot(week);
    if (!snap) {
      try {
        const fetched = await fetchUniverse();
        saveUniverseSnapshot(week, fetched.totalListed, fetched.rows);
        snap = { isoWeek: week, fetchedAt: new Date().toISOString(), ...fetched };
      } catch {
        // Includes the force-refresh-failed case: any cached week beats nothing.
        snap = getUniverseSnapshot(week) ?? latestUniverseSnapshot();
      }
    }
    if (!snap) return null;
    const eligible = filterEligible(snap.rows);
    // A pool this thin means broken feed data or nonsensical band knobs — run unscreened.
    if (eligible.length < 10) return null;
    return {
      pool: {
        weekKey: snap.isoWeek,
        fetchedAt: snap.fetchedAt,
        stale: snap.isoWeek !== week,
        totalListed: snap.totalListed,
        eligibleCount: eligible.length,
        criteria: criteriaText(),
        shown: stratifiedSlice(eligible, CONFIG.universe.poolSize, snap.isoWeek),
      },
      rows: snap.rows,
    };
  } catch {
    return null; // Stage 0 must never fail a run
  }
}

/**
 * Deterministic band check on the delivered picks. Only judges names present
 * in the snapshot (a missing name may be a brand-new listing); 10% slack on
 * both edges keeps honest borderline picks unflagged. Public-safe wording —
 * these strings reach the compiler's known gaps AND the published gapsNoted.
 */
export function universeBandFlags(
  candidates: readonly { ticker: string }[],
  universe: UniverseResult,
): string[] {
  const { mcapMinUsd, mcapMaxUsd } = CONFIG.universe;
  const byTicker = new Map(universe.rows.map((r) => [r.t, r]));
  const flags: string[] = [];
  for (const c of candidates) {
    const row = byTicker.get(c.ticker);
    if (!row) continue;
    if (row.c > mcapMaxUsd * 1.1) {
      flags.push(
        `${c.ticker}: the weekly universe screen lists its market cap near ${fmtMarketCap(row.c)} — above the ${fmtMarketCap(mcapMaxUsd)} ceiling of the discovery band; kept as an out-of-band exception.`,
      );
    } else if (row.c < mcapMinUsd * 0.9) {
      flags.push(
        `${c.ticker}: the weekly universe screen lists its market cap near ${fmtMarketCap(row.c)} — below the ${fmtMarketCap(mcapMinUsd)} floor of the discovery band; expect outsized volatility and speculative risk.`,
      );
    }
  }
  return flags;
}
