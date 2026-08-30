import { getCusipResolutions, latestUniverseSnapshot, saveCusipResolutions, type CusipResolution } from "../db";

/* ============================================================================
 * CUSIP → ticker resolution for Module A.
 *
 * A 13F identifies securities by CUSIP and issuer name, never by ticker, so a
 * clone is unreadable until those are resolved. Three sources, tried in order,
 * and a row that resolves through none of them stays VISIBLE and flagged —
 * dropping it would silently shrink the book and change every percentage.
 *
 *   1. OpenFIGI  keyless public mapping API, restricted to US listings
 *   2. the weekly universe snapshot, matched on normalized issuer name —
 *      thousands of US listings already in this database, no network at all
 *   3. OpenFIGI  again, unrestricted by exchange — and whatever comes back is
 *      labelled a FOREIGN listing unless it is genuinely a US line
 *
 * That order is not arbitrary, and getting it wrong produced a real wrong
 * answer here: CUSIP 09173B107 (Bitfarms) has no US line in OpenFIGI, and an
 * unrestricted lookup returns six German venues. Ranked above the universe
 * snapshot, that hands back "1B2" — a Frankfurt symbol — for a company that
 * trades on Nasdaq, and a proposed order list would carry it as the ticker.
 * A US-listing source therefore always outranks an unrestricted one, and a
 * non-US result is marked as such rather than presented as tradeable.
 *
 * The identifier's own shape decides which OpenFIGI id type applies, and this
 * is load-bearing rather than cosmetic. A CUSIP beginning with a LETTER is a
 * CINS — the international extension of the scheme — and OpenFIGI answers
 * "No identifier found" for one submitted as ID_CUSIP while resolving the same
 * string as ID_CINS (verified 2026-08-30: G11448100 → BTDR). Submitting a
 * domestic CUSIP as ID_CINS is rejected in the other direction, so the branch
 * has to be on the identifier, not on a retry.
 *
 * Every resolution is cached in bottleneck_cusips, including the failures: a
 * name OpenFIGI does not know does not become known by asking again, and the
 * keyless quota is small enough to matter.
 * ========================================================================== */

export type ResolutionSource = "openfigi" | "openfigi-foreign" | "universe-name" | "unresolved";

export interface ResolvedCusip {
  cusip: string;
  ticker: string | null;
  /** Issuer name as the resolving source spells it (not as the 13F spells it). */
  name: string | null;
  source: ResolutionSource;
}

/**
 * Whether a resolution names a symbol a US investor can actually trade. Only
 * the two US-listing sources qualify; a foreign venue symbol is an identity,
 * not an order.
 */
export const isUsListing = (source: ResolutionSource): boolean =>
  source === "openfigi" || source === "universe-name";

const KNOWN_SOURCES = new Set<string>(["openfigi", "openfigi-foreign", "universe-name", "unresolved"]);

/**
 * A cached row is only usable if its source is one this build understands. A
 * row written under a retired source name is treated as a cache miss and
 * re-resolved, because the meaning of the ticker beside it may have changed —
 * which is exactly what happened when unrestricted lookups stopped counting as
 * US listings.
 */
const usableCachedSource = (source: string | null | undefined): ResolutionSource | null =>
  source && KNOWN_SOURCES.has(source) ? (source as ResolutionSource) : null;

/** CUSIPs are 9 characters; the leading letter marks the international (CINS) form. */
export const normalizeCusip = (raw: string): string => raw.trim().toUpperCase().replace(/\s+/g, "");

export const isCins = (cusip: string): boolean => /^[A-Z]/.test(normalizeCusip(cusip));

export const cusipIdType = (cusip: string): "ID_CINS" | "ID_CUSIP" => (isCins(cusip) ? "ID_CINS" : "ID_CUSIP");

/* ----------------------------------------------------------------------------
 * OpenFIGI
 * -------------------------------------------------------------------------- */

const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping";
/** Keyless quota: 10 jobs per request, 25 requests per minute. */
const JOBS_PER_REQUEST = 10;
/** Ceiling per invocation, so one enormous filing cannot exhaust the quota. */
const MAX_REQUESTS = 20;
const REQUEST_GAP_MS = 300;

export interface FigiJob {
  idType: "ID_CINS" | "ID_CUSIP";
  idValue: string;
  exchCode?: string;
}

export interface FigiRow {
  ticker?: string;
  name?: string;
  exchCode?: string;
  securityType?: string;
  marketSector?: string;
}

/** One job per CUSIP, with the id type its own shape dictates. */
export function figiJobs(cusips: string[], exchCode?: string): FigiJob[] {
  return cusips.map((c) => ({
    idType: cusipIdType(c),
    idValue: normalizeCusip(c),
    ...(exchCode ? { exchCode } : {}),
  }));
}

/**
 * Pick the row a US investor would actually trade: a US-listed common equity
 * first, then any US line, then whatever came back. An unrestricted lookup can
 * return a dozen venues for one issuer (BTDR alone returns US, VL, VP, TH, EO…)
 * and taking the first would hand back a German or Vienna ticker.
 */
export function pickFigiRow(rows: FigiRow[]): FigiRow | null {
  if (rows.length === 0) return null;
  const usEquity = rows.find(
    (r) => r.exchCode === "US" && r.marketSector === "Equity" && /common stock/i.test(r.securityType ?? ""),
  );
  return usEquity ?? rows.find((r) => r.exchCode === "US") ?? rows[0];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FigiResponseItem {
  data?: FigiRow[];
  warning?: string;
  error?: string;
}

/** `answered` separates "the service says no such identifier" from "the service is down". */
interface FigiBatchResult {
  found: Map<string, FigiRow>;
  answered: boolean;
}

/**
 * One batched OpenFIGI call. Returns a map for the jobs that resolved; a job
 * that did not is simply absent. Never throws — an unreachable mapping service
 * degrades the clone to unresolved rows, which the desk shows plainly.
 */
async function figiBatch(jobs: FigiJob[], timeoutMs: number): Promise<FigiBatchResult> {
  const found = new Map<string, FigiRow>();
  if (jobs.length === 0) return { found, answered: true };
  try {
    const res = await fetch(OPENFIGI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobs),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { found, answered: false };
    const body = (await res.json()) as FigiResponseItem[];
    if (!Array.isArray(body)) return { found, answered: false };
    jobs.forEach((job, i) => {
      const picked = pickFigiRow(body[i]?.data ?? []);
      if (picked?.ticker) found.set(job.idValue, picked);
    });
    return { found, answered: true };
  } catch {
    return { found, answered: false }; // fail-open: unresolved rows stay visible
  }
}

/** Batched, paced lookups across however many CUSIPs are outstanding. */
async function figiLookup(
  cusips: string[],
  opts: { exchCode?: string; timeoutMs: number },
): Promise<FigiBatchResult> {
  const found = new Map<string, FigiRow>();
  let answered = true;
  const batches: string[][] = [];
  for (let i = 0; i < cusips.length; i += JOBS_PER_REQUEST) {
    batches.push(cusips.slice(i, i + JOBS_PER_REQUEST));
  }
  const sent = batches.slice(0, MAX_REQUESTS);
  // Truncating at the request ceiling is itself an unanswered question.
  if (sent.length < batches.length) answered = false;
  for (const [i, batch] of sent.entries()) {
    if (i > 0) await sleep(REQUEST_GAP_MS);
    const res = await figiBatch(figiJobs(batch, opts.exchCode), opts.timeoutMs);
    for (const [k, v] of res.found) found.set(k, v);
    if (!res.answered) answered = false;
  }
  return { found, answered };
}

/* ----------------------------------------------------------------------------
 * Issuer-name matching against the weekly universe snapshot
 * -------------------------------------------------------------------------- */

/**
 * Legal-form and share-class noise, stripped so "SANDISK CORP" and "SanDisk
 * Corporation" compare equal. Ordered longest-first inside each alternation so
 * "CORPORATION" cannot be half-consumed by "CORP".
 */
const NAME_NOISE =
  /\b(?:CORPORATION|CORP|INCORPORATED|INC|COMPANY|COMPANIES|CO|LIMITED|LTD|PLC|LLC|LP|NV|SA|AG|SE|HOLDINGS|HOLDING|HLDGS|HLDG|GROUP|GRP|TRUST|THE|CLASS|CL|COM|ORD|SHS|ADR|ADS|NEW|SPONSORED|REIT|PARTNERS|TECHNOLOGIES|TECHNOLOGY|TECH)\b/g;

/** Uppercase, de-punctuated, legal-form-stripped — the form both sides compare in. */
export function normalizeIssuerName(raw: string): string {
  return (
    raw
      .toUpperCase()
      .replace(/&/g, " AND ")
      .replace(/[^A-Z0-9 ]+/g, " ")
      .replace(NAME_NOISE, " ")
      .replace(/\s+/g, " ")
      .trim()
      // Whatever share class survives the pass above is noise too: "BLOOM ENERGY
      // CORP CL A" and "BLOOM ENERGY CORP- A" both have to reach "BLOOM ENERGY".
      .replace(/\s+[A-D]$/, "")
  );
}

/**
 * Exact match on the normalized name, and only when exactly one listing claims
 * it. An ambiguous name resolves to NOTHING on purpose: a wrong ticker in a
 * proposed order list is far worse than a row marked unresolved.
 */
export function matchUniverseName(
  issuerName: string,
  listings: { t: string; n: string }[],
): { ticker: string; name: string } | null {
  const key = normalizeIssuerName(issuerName);
  if (key.length < 3) return null;
  const hits = listings.filter((row) => normalizeIssuerName(row.n) === key);
  return hits.length === 1 ? { ticker: hits[0].t, name: hits[0].n } : null;
}

/* ----------------------------------------------------------------------------
 * The resolver
 * -------------------------------------------------------------------------- */

export interface ResolveOptions {
  timeoutMs?: number;
  /** Skip the network entirely (cache + universe snapshot only). */
  offline?: boolean;
  /** Skip the cache read/write (tests). */
  noCache?: boolean;
  /** Re-ask about CUSIPs cached as unresolved (a new listing may have appeared). */
  retryUnresolved?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Resolve a filing's CUSIPs to tickers. Input carries the issuer name because
 * the last fallback matches on it; output covers EVERY input CUSIP, unresolved
 * ones included.
 */
export async function resolveCusips(
  input: { cusip: string; issuerName: string }[],
  opts: ResolveOptions = {},
): Promise<Map<string, ResolvedCusip>> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const wanted = new Map<string, string>();
  for (const row of input) {
    const c = normalizeCusip(row.cusip);
    if (c && !wanted.has(c)) wanted.set(c, row.issuerName);
  }

  const out = new Map<string, ResolvedCusip>();

  // 1. Cache — including cached failures, which are answers too.
  if (!opts.noCache) {
    const cached = getCusipResolutions([...wanted.keys()]);
    for (const [cusip, row] of cached) {
      const source = usableCachedSource(row.source);
      if (!source) continue;
      if (opts.retryUnresolved && source === "unresolved") continue;
      out.set(cusip, { cusip, ticker: row.ticker, name: row.name, source });
    }
  }

  const outstanding = () => [...wanted.keys()].filter((c) => !out.has(c));
  const fresh: CusipResolution[] = [];
  const record = (cusip: string, ticker: string | null, name: string | null, source: ResolutionSource) => {
    out.set(cusip, { cusip, ticker, name, source });
    fresh.push({ cusip, ticker, name, source });
  };

  let mappingServiceAnswered = !opts.offline;

  // 2. OpenFIGI, restricted to US listings — the authoritative tradeable line.
  if (!opts.offline) {
    const us = await figiLookup(outstanding(), { exchCode: "US", timeoutMs });
    for (const [cusip, row] of us.found) record(cusip, row.ticker ?? null, row.name ?? null, "openfigi");
    mappingServiceAnswered = us.answered;
  }

  // 3. The universe snapshot already in this database — US listings by
  //    construction, so it outranks any unrestricted lookup.
  const unnamed = outstanding();
  if (unnamed.length > 0) {
    const listings = latestUniverseSnapshot()?.rows ?? [];
    if (listings.length > 0) {
      for (const cusip of unnamed) {
        const hit = matchUniverseName(wanted.get(cusip) ?? "", listings);
        if (hit) record(cusip, hit.ticker, hit.name, "universe-name");
      }
    }
  }

  // 4. OpenFIGI unrestricted — last, and its answer is labelled by venue.
  if (!opts.offline) {
    const any = await figiLookup(outstanding(), { timeoutMs });
    for (const [cusip, row] of any.found) {
      const usLine = row.exchCode === "US";
      record(cusip, row.ticker ?? null, row.name ?? null, usLine ? "openfigi" : "openfigi-foreign");
    }
    mappingServiceAnswered = mappingServiceAnswered && any.answered;
  }

  for (const cusip of outstanding()) record(cusip, null, null, "unresolved");

  // Cache resolutions, and cache an unresolved verdict ONLY when the mapping
  // service actually answered: "this identifier is unknown" is a durable fact,
  // "the service was unreachable" is not, and storing the second as the first
  // would poison every later read of a filing fetched during an outage.
  const storable = mappingServiceAnswered ? fresh : fresh.filter((r) => r.ticker !== null);
  if (!opts.noCache && storable.length > 0) saveCusipResolutions(storable);
  return out;
}
