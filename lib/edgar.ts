/* ============================================================================
 * Shared SEC EDGAR client — transport layer ONLY (server-only, $0, keyless).
 *
 * Every SEC request in this codebase goes through here: the Stage-0 universe
 * screen (lib/sec.ts, XBRL frames) and the Bottleneck desk (lib/bottleneck/*).
 * One User-Agent, one rate limiter, one cache, one error vocabulary — so a
 * second HTTP style can never drift in behind the first.
 *
 * This module knows NOTHING about 13F structure, XBRL tag names, or playbooks.
 * It fetches bytes and parses envelopes; meaning lives in its callers.
 *
 * SEC fair-access rules baked in (sec.gov/os/webmaster-faq#developers):
 *  - A descriptive User-Agent is MANDATORY. Requests without one get 403.
 *  - Stay under 10 requests/second. A single shared scheduler serializes every
 *    caller with a minimum inter-request gap, so concurrency downstream cannot
 *    breach the limit no matter how many modules call at once.
 *
 * Caching is OPT-IN per call and lazily backed by SQLite. Stage 0 passes
 * `cache: false` (its frames are already cached inside the weekly snapshot and
 * run 0.1–0.9 MB each), so importing this module never touches the database on
 * the Stage-0 path — which matters, because importing lib/db.ts runs boot
 * reconciliation and would mark a live run interrupted.
 * ========================================================================== */

/** Identifying User-Agent. MAG8_EDGAR_UA wins; MAG8_SEC_UA kept for continuity. */
export const edgarUserAgent = (): string =>
  process.env.MAG8_EDGAR_UA?.trim() ||
  process.env.MAG8_SEC_UA?.trim() ||
  "Mag8/1.0 (research pipeline; +https://themag8.com)";

export class EdgarError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "EdgarError";
  }
  /** True when the resource genuinely does not exist (bad CIK / accession). */
  get notFound(): boolean {
    return this.status === 404;
  }
}

/* ----------------------------------------------------------------------------
 * Shared rate limiter — one promise chain, global to the process.
 * -------------------------------------------------------------------------- */

/** ~8 req/s against SEC's 10/s ceiling. Matches the gap lib/sec.ts used before. */
const GAP_MS = 120;

type GlobalWithGate = typeof globalThis & { __mag8_edgar_gate?: { chain: Promise<void>; last: number } };

function gate(): { chain: Promise<void>; last: number } {
  const g = globalThis as GlobalWithGate;
  if (!g.__mag8_edgar_gate) g.__mag8_edgar_gate = { chain: Promise.resolve(), last: 0 };
  return g.__mag8_edgar_gate;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serialize into the shared queue and wait out the inter-request gap. */
function takeSlot(): Promise<void> {
  const g = gate();
  const next = g.chain.then(async () => {
    const wait = g.last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    g.last = Date.now();
  });
  // Keep the chain alive even if a caller rejects downstream.
  g.chain = next.catch(() => undefined);
  return next;
}

/* ----------------------------------------------------------------------------
 * Cache — lazily bound to SQLite, never imported unless a caller opts in.
 * -------------------------------------------------------------------------- */

export interface EdgarCacheAdapter {
  get(url: string): { body: string; contentType: string | null; fetchedAt: string } | null;
  set(url: string, body: string, contentType: string | null): void;
}

let adapter: EdgarCacheAdapter | null = null;
let adapterTried = false;

/** Override the cache backend (tests inject an in-memory one; null disables it). */
export function setEdgarCacheAdapter(a: EdgarCacheAdapter | null): void {
  adapter = a;
  adapterTried = true;
}

async function cacheAdapter(): Promise<EdgarCacheAdapter | null> {
  if (adapterTried) return adapter;
  adapterTried = true;
  try {
    const db = await import("./db");
    adapter = { get: db.getEdgarCache, set: db.setEdgarCache };
  } catch {
    adapter = null; // no storage layer available (probe scripts, tests) — fetch live
  }
  return adapter;
}

/** How long a cached response stays usable. Historical filings never change. */
export type CachePolicy = false | "forever" | number;

/** Submissions and company facts change when a company files; a day is plenty. */
export const CACHE_DAILY: CachePolicy = 24 * 60 * 60 * 1000;

function fresh(fetchedAt: string, policy: CachePolicy): boolean {
  if (policy === false) return false;
  if (policy === "forever") return true;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < policy;
}

/* ----------------------------------------------------------------------------
 * Core fetch
 * -------------------------------------------------------------------------- */

export interface EdgarFetchOptions {
  timeoutMs?: number;
  /** Cache policy for this URL (default: no caching). */
  cache?: CachePolicy;
  /** Retries on 429/5xx/network errors. */
  retries?: number;
  accept?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 2;
/** Transient statuses worth a backoff rather than a hard failure. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * One EDGAR request: cache read → rate-limited fetch → explicit error mapping →
 * cache write. Returns the raw body text.
 */
export async function edgarFetch(url: string, opts: EdgarFetchOptions = {}): Promise<string> {
  const policy = opts.cache ?? false;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;

  if (policy !== false) {
    const store = await cacheAdapter();
    const hit = store?.get(url);
    if (hit && fresh(hit.fetchedAt, policy)) return hit.body;
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s, 4s
    await takeSlot();
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": edgarUserAgent(), Accept: opts.accept ?? "application/json" },
      });

      if (res.status === 403) {
        // Effectively always the User-Agent — SEC rejects anonymous traffic outright.
        throw new EdgarError(
          "SEC rejected the request with 403. This is almost always a missing or malformed " +
            `User-Agent: SEC requires a descriptive identifying header. Currently sending ` +
            `"${edgarUserAgent()}" — set MAG8_EDGAR_UA to "AppName contact@example.com".`,
          url,
          403,
        );
      }
      if (res.status === 404) {
        throw new EdgarError("SEC returned 404 — no such CIK, accession, or document.", url, 404);
      }
      if (RETRYABLE.has(res.status)) {
        lastErr = new EdgarError(`SEC returned ${res.status} (transient).`, url, res.status);
        continue;
      }
      if (!res.ok) throw new EdgarError(`SEC returned HTTP ${res.status}.`, url, res.status);

      const body = await res.text();
      if (policy !== false) {
        const store = await cacheAdapter();
        store?.set(url, body, res.headers.get("content-type"));
      }
      return body;
    } catch (err) {
      // A definitive answer (403/404/other non-retryable) must not be retried.
      if (err instanceof EdgarError && !RETRYABLE.has(err.status ?? 0)) throw err;
      lastErr = err;
    }
  }

  if (lastErr instanceof EdgarError) throw lastErr;
  throw new EdgarError(`SEC request failed after ${retries + 1} attempts: ${describeFetchError(lastErr)}`, url);
}

/**
 * Undici reports every transport failure as the same three words — "fetch
 * failed" — and puts the actual reason in `cause`. Reporting only the message
 * turns a DNS failure, a refused connection, a TLS problem and a timeout into
 * one indistinguishable string, which is how a network fault ends up looking
 * like a code fault. Unwrap the chain.
 */
export function describeFetchError(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let depth = 0; cur instanceof Error && depth < 4; depth++) {
    const code = (cur as { code?: string }).code;
    parts.push(code ? `${cur.message} (${code})` : cur.message);
    cur = (cur as { cause?: unknown }).cause;
  }
  if (parts.length === 0) return String(err);
  // Duplicated frames add nothing; undici often repeats the same text.
  return [...new Set(parts)].join(" ← ");
}

/** edgarFetch + JSON.parse, with a clear error when the envelope is not JSON. */
export async function edgarJson<T>(url: string, opts: EdgarFetchOptions = {}): Promise<T> {
  const body = await edgarFetch(url, opts);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new EdgarError(`SEC returned a non-JSON body (${body.slice(0, 80)}…).`, url);
  }
}

/* ----------------------------------------------------------------------------
 * Identifiers
 * -------------------------------------------------------------------------- */

/** data.sec.gov paths need the CIK zero-padded to 10 digits. */
export const padCik = (cik: number | string): string => String(cik).replace(/\D/g, "").padStart(10, "0");
/** Archives paths need it WITHOUT leading zeros. */
export const bareCik = (cik: number | string): string => String(Number(String(cik).replace(/\D/g, "")));
/** Archives paths need the accession number with its dashes stripped. */
export const bareAccession = (accession: string): string => accession.replace(/-/g, "");

/* ----------------------------------------------------------------------------
 * Ticker → CIK
 * -------------------------------------------------------------------------- */

const CIK_MAP_URL = "https://www.sec.gov/files/company_tickers_exchange.json";

type GlobalWithCikMap = typeof globalThis & { __mag8_cik_map?: { at: number; map: Map<string, number> } };

/**
 * Ticker → CIK for every SEC registrant. Process-memoized for an hour and
 * disk-cached for a day: it is ~800 KB and barely changes.
 *
 * Ordering note: the FIRST cik seen for a ticker wins, exactly as the Stage-0
 * screen has always done — later duplicate rows are ignored, not overwritten.
 */
export async function getTickerCikMap(opts: { timeoutMs?: number } = {}): Promise<Map<string, number>> {
  const g = globalThis as GlobalWithCikMap;
  if (g.__mag8_cik_map && Date.now() - g.__mag8_cik_map.at < 60 * 60 * 1000) return g.__mag8_cik_map.map;

  const body = await edgarJson<{ fields: string[]; data: (string | number)[][] }>(CIK_MAP_URL, {
    timeoutMs: opts.timeoutMs,
    cache: CACHE_DAILY,
  });
  const ti = body.fields.indexOf("ticker");
  const ci = body.fields.indexOf("cik");
  if (ti < 0 || ci < 0) throw new EdgarError("cik map: unrecognized shape", CIK_MAP_URL);

  const map = new Map<string, number>();
  for (const row of body.data) {
    const ticker = String(row[ti]).toUpperCase();
    const cik = Number(row[ci]);
    if (ticker && Number.isFinite(cik) && !map.has(ticker)) map.set(ticker, cik);
  }
  g.__mag8_cik_map = { at: Date.now(), map };
  return map;
}

/** One ticker's CIK, or null when SEC does not list it. */
export async function resolveTickerToCik(ticker: string, opts: { timeoutMs?: number } = {}): Promise<number | null> {
  const map = await getTickerCikMap(opts);
  return map.get(ticker.trim().toUpperCase()) ?? null;
}

/* ----------------------------------------------------------------------------
 * Submissions
 * -------------------------------------------------------------------------- */

export interface EdgarFiling {
  form: string;
  /** Date the filing was accepted by SEC (YYYY-MM-DD). */
  filingDate: string;
  /** Period the filing REPORTS ON (YYYY-MM-DD). Empty when SEC omits it. */
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
}

export interface EdgarSubmissions {
  cik: number;
  name: string;
  filings: EdgarFiling[];
}

/**
 * A company or fund's filing history, newest first.
 *
 * The submissions envelope is COLUMNAR — `filings.recent` holds parallel arrays
 * where index i across every array describes one filing. Verified 2026-08-29:
 * the period field is `reportDate` (NOT `periodOfReport`, which does not exist
 * in this payload). `filings.recent` covers roughly the last year or 1,000
 * filings; older history hangs off `filings.files`, which this does not follow.
 */
export async function getSubmissions(
  cik: number | string,
  opts: { timeoutMs?: number; cache?: CachePolicy } = {},
): Promise<EdgarSubmissions> {
  const url = `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`;
  const body = await edgarJson<{
    cik?: string | number;
    name?: string;
    filings?: { recent?: Record<string, unknown[]> };
  }>(url, { timeoutMs: opts.timeoutMs, cache: opts.cache ?? CACHE_DAILY });

  const recent = body.filings?.recent;
  const col = (k: string): unknown[] => (Array.isArray(recent?.[k]) ? (recent?.[k] as unknown[]) : []);
  const forms = col("form");
  const filingDates = col("filingDate");
  const reportDates = col("reportDate");
  const accessions = col("accessionNumber");
  const primaries = col("primaryDocument");

  const str = (xs: unknown[], i: number): string => (typeof xs[i] === "string" ? (xs[i] as string) : "");
  const filings: EdgarFiling[] = [];
  for (let i = 0; i < forms.length; i++) {
    const accessionNumber = str(accessions, i);
    if (!accessionNumber) continue;
    filings.push({
      form: str(forms, i),
      filingDate: str(filingDates, i),
      reportDate: str(reportDates, i),
      accessionNumber,
      primaryDocument: str(primaries, i),
    });
  }
  filings.sort((a, b) => b.filingDate.localeCompare(a.filingDate));

  return {
    cik: Number(bareCik(body.cik ?? cik)),
    name: typeof body.name === "string" ? body.name : "",
    filings,
  };
}

/* ----------------------------------------------------------------------------
 * XBRL company facts
 * -------------------------------------------------------------------------- */

export interface ConceptFact {
  /** Period start (absent on instant concepts). */
  start?: string;
  end: string;
  val: number;
  /** Fiscal year / period the value was reported under. */
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
  accn?: string;
}

/** One structured metric across every filing that reported it. Null when the filer never tagged it. */
export async function getCompanyConcept(
  cik: number | string,
  tag: string,
  opts: { taxonomy?: string; unit?: string; timeoutMs?: number; cache?: CachePolicy } = {},
): Promise<ConceptFact[] | null> {
  const taxonomy = opts.taxonomy ?? "us-gaap";
  const unit = opts.unit ?? "USD";
  const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${padCik(cik)}/${taxonomy}/${tag}.json`;
  try {
    const body = await edgarJson<{ units?: Record<string, ConceptFact[]> }>(url, {
      timeoutMs: opts.timeoutMs,
      cache: opts.cache ?? CACHE_DAILY,
    });
    const facts = body.units?.[unit];
    return Array.isArray(facts) ? facts : null;
  } catch (err) {
    // A filer that never tagged this concept 404s — that is data, not failure.
    if (err instanceof EdgarError && err.notFound) return null;
    throw err;
  }
}

/** Every structured fact a company has filed. Large (multi-MB for big filers). */
export async function getCompanyFacts(
  cik: number | string,
  opts: { timeoutMs?: number; cache?: CachePolicy } = {},
): Promise<{ cik: number; entityName: string; facts: Record<string, Record<string, unknown>> } | null> {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
  try {
    const body = await edgarJson<{
      cik?: number;
      entityName?: string;
      facts?: Record<string, Record<string, unknown>>;
    }>(url, { timeoutMs: opts.timeoutMs, cache: opts.cache ?? CACHE_DAILY });
    return { cik: Number(body.cik ?? bareCik(cik)), entityName: body.entityName ?? "", facts: body.facts ?? {} };
  } catch (err) {
    if (err instanceof EdgarError && err.notFound) return null;
    throw err;
  }
}

/* ----------------------------------------------------------------------------
 * Full-text search (all filings since 2001)
 * -------------------------------------------------------------------------- */

export interface FullTextHit {
  accessionNumber: string;
  /** The document inside that filing which matched. */
  fileName: string;
  cik: number;
  /** Filer name as EDGAR displays it, with the "(CIK …)" suffix stripped. */
  entityName: string;
  form: string;
  filingDate: string;
  reportDate: string;
}

export interface FullTextResult {
  total: number;
  hits: FullTextHit[];
}

/** `"Situational Awareness LP  (CIK 0002045724)"` → name + cik. */
function splitDisplayName(display: string): { name: string; cik: number | null } {
  const m = /^(.*?)\s*\(CIK\s*(\d+)\)\s*$/.exec(display);
  if (!m) return { name: display.trim(), cik: null };
  return { name: m[1].trim(), cik: Number(m[2]) };
}

/**
 * Search the full text of every EDGAR filing since 2001. Free, keyless.
 * Used two ways here: finding a filer by name, and finding filings that mention
 * a phrase (a disclosed backlog, a capacity commitment).
 */
export async function fullTextSearch(
  query: string,
  opts: {
    forms?: string[];
    startDate?: string;
    endDate?: string;
    entityName?: string;
    from?: number;
    timeoutMs?: number;
    cache?: CachePolicy;
  } = {},
): Promise<FullTextResult> {
  const params = new URLSearchParams({ q: query });
  if (opts.forms?.length) params.set("forms", opts.forms.join(","));
  if (opts.startDate && opts.endDate) {
    params.set("dateRange", "custom");
    params.set("startdt", opts.startDate);
    params.set("enddt", opts.endDate);
  }
  if (opts.entityName) params.set("entityName", opts.entityName);
  if (opts.from) params.set("from", String(opts.from));

  const url = `https://efts.sec.gov/LATEST/search-index?${params.toString()}`;
  const body = await edgarJson<{
    hits?: { total?: { value?: number }; hits?: { _id?: string; _source?: Record<string, unknown> }[] };
  }>(url, { timeoutMs: opts.timeoutMs, cache: opts.cache ?? false });

  const raw = body.hits?.hits ?? [];
  const hits: FullTextHit[] = [];
  for (const h of raw) {
    const s = h._source ?? {};
    const ciks = Array.isArray(s.ciks) ? (s.ciks as string[]) : [];
    const displays = Array.isArray(s.display_names) ? (s.display_names as string[]) : [];
    const parsed = displays[0] ? splitDisplayName(displays[0]) : { name: "", cik: null };
    // "_id" is "{accession}:{filename}" — the only place the matched filename appears.
    const [, fileName = ""] = (h._id ?? "").split(":");
    hits.push({
      accessionNumber: typeof s.adsh === "string" ? s.adsh : "",
      fileName,
      cik: parsed.cik ?? Number(ciks[0] ?? 0),
      entityName: parsed.name,
      form: typeof s.form === "string" ? s.form : "",
      filingDate: typeof s.file_date === "string" ? s.file_date : "",
      reportDate: typeof s.period_ending === "string" ? s.period_ending : "",
    });
  }
  return { total: body.hits?.total?.value ?? hits.length, hits };
}

/* ----------------------------------------------------------------------------
 * Filing contents
 * -------------------------------------------------------------------------- */

export interface FilingFile {
  name: string;
  size: number;
}

/**
 * Every filename inside one filing. Load-bearing: exhibit filenames vary by
 * filer and filing agent (a 13F information table has been seen as
 * `form13fInfoTable.xml`, `informationtable.xml`, and others), so callers must
 * pattern-match this list rather than guess a filename.
 */
export async function getFilingIndex(
  cik: number | string,
  accessionNumber: string,
  opts: { timeoutMs?: number; cache?: CachePolicy } = {},
): Promise<FilingFile[]> {
  const url = `https://www.sec.gov/Archives/edgar/data/${bareCik(cik)}/${bareAccession(accessionNumber)}/index.json`;
  const body = await edgarJson<{ directory?: { item?: { name?: string; size?: string | number }[] } }>(url, {
    timeoutMs: opts.timeoutMs,
    // A filing's contents are immutable once accepted.
    cache: opts.cache ?? "forever",
  });
  return (body.directory?.item ?? [])
    .filter((i): i is { name: string; size?: string | number } => typeof i.name === "string")
    .map((i) => ({ name: i.name, size: Number(i.size ?? 0) || 0 }));
}

/** One document out of a filing, raw. Handles XML and HTML alike — callers parse. */
export async function fetchFilingDocument(
  cik: number | string,
  accessionNumber: string,
  fileName: string,
  opts: { timeoutMs?: number; cache?: CachePolicy } = {},
): Promise<string> {
  const url = `https://www.sec.gov/Archives/edgar/data/${bareCik(cik)}/${bareAccession(accessionNumber)}/${fileName}`;
  return edgarFetch(url, {
    timeoutMs: opts.timeoutMs,
    cache: opts.cache ?? "forever", // immutable once filed
    accept: "application/xml,text/html,*/*",
  });
}
