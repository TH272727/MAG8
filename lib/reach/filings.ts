import {
  CACHE_DAILY,
  EdgarError,
  bareAccession,
  bareCik,
  describeFetchError,
  getSubmissions,
  resolveTickerToCik,
  type CachePolicy,
  type EdgarFiling,
  type EdgarSubmissions,
} from "../edgar";

/* ============================================================================
 * A company's own dated words — the highest-coverage evidence available here.
 *
 * Every US-listed name in the universe has a filing history, it is free and
 * keyless, and each entry resolves to a permanent public URL. The point is not
 * that a lens COULD find these: it is that finding them costs turns out of a
 * hard per-call budget, and the same six links can be fetched once a week,
 * deterministically, for every candidate at once.
 *
 * This module lists filings. It never opens, summarises, or interprets one —
 * reading the document is the analysis's job, and a summary generated here
 * would be exactly the "description of the artifact" the source standard says
 * to prefer the artifact over.
 *
 * Transport, rate limiting and caching all belong to lib/edgar.ts; nothing here
 * touches the network directly.
 * ========================================================================== */

export type FilingKind = "periodic" | "event" | "offering";

/**
 * Form prefixes, matched as prefixes rather than exact strings on purpose:
 * variants proliferate (424B3 / 424B5 / 424B7, and an "/A" amendment of almost
 * anything) and an exact set silently drops the ones nobody thought of.
 *
 * Two deliberate absences. S-8 registers shares for employee compensation
 * plans — routine, filed on a schedule, and reading it as a capital raise
 * would overstate dilution at every company that pays people in equity.
 * Forms 3/4/5 and 144 are insider activity, which is a separate product with
 * its own thresholds; duplicating a thin version of it here would invite the
 * two to disagree.
 */
const FORM_PREFIXES: [FilingKind, readonly string[]][] = [
  ["periodic", ["10-K", "10-Q", "20-F", "40-F"]],
  // 6-K is the foreign private issuer's 8-K; several names in this universe
  // file one (verified: the Canadian automation filer in the desk's owner map).
  ["event", ["8-K", "6-K"]],
  ["offering", ["S-1", "S-3", "S-4", "S-11", "F-1", "F-3", "F-4", "424B"]],
];

/** Which bucket a form falls in, or null when it is not evidence this layer lists. */
export function classifyForm(form: string): FilingKind | null {
  const f = form.trim().toUpperCase();
  if (!f) return null;
  for (const [kind, prefixes] of FORM_PREFIXES) {
    if (prefixes.some((p) => f.startsWith(p))) return kind;
  }
  return null;
}

export interface FilingRef {
  form: string;
  /** Date SEC accepted it (YYYY-MM-DD). */
  filed: string;
  /** Period it reports on; empty where SEC omits it, which is normal for events. */
  period: string;
  kind: FilingKind;
  /** Permanent public URL — the artifact itself. */
  url: string;
}

export interface CompanyFilings {
  ticker: string;
  cik: number | null;
  entityName: string;
  /** Newest first, capped. Empty AND `unavailable` unset means: filed nothing of interest. */
  recent: FilingRef[];
  /** Registration and prospectus filings in the whole window, not just the listed ones. */
  offeringCount: number;
  /**
   * Why there is nothing here, when the reason is a failure rather than a fact.
   * An empty list with no reason is a company that filed nothing of interest;
   * an empty list WITH one is a company we could not read. Collapsing the two
   * would report silence as evidence of quiet.
   */
  unavailable?: string;
}

/**
 * Filing URL. `primaryDocument` gives the document itself, which is what a
 * reader wants; when SEC omits it, fall back to the filing's index page rather
 * than guessing a filename — exhibit names vary by filing agent, and a guessed
 * URL that 404s is worse than a directory that works.
 */
export function filingUrl(cik: number | string, f: EdgarFiling): string {
  const base = `https://www.sec.gov/Archives/edgar/data/${bareCik(cik)}/${bareAccession(f.accessionNumber)}`;
  return f.primaryDocument ? `${base}/${f.primaryDocument}` : `${base}/${f.accessionNumber}-index.htm`;
}

export interface SelectOptions {
  lookbackDays: number;
  max: number;
  /** Fixed "now" for deterministic tests and for a week-frozen snapshot. */
  asOf?: Date;
}

/**
 * PURE: pick the filings worth listing out of a submissions envelope.
 *
 * Windowing happens before capping, and the offering count is taken over the
 * WHOLE window rather than the capped list — it is a count of what happened,
 * not a count of what fitted on screen.
 */
export function selectFilings(
  subs: EdgarSubmissions,
  opts: SelectOptions,
): { recent: FilingRef[]; offeringCount: number } {
  const asOf = opts.asOf ?? new Date();
  const cutoff = new Date(asOf.getTime() - opts.lookbackDays * 86_400_000).toISOString().slice(0, 10);

  const inWindow: FilingRef[] = [];
  for (const f of subs.filings) {
    // Dates are YYYY-MM-DD, so a string compare is a date compare.
    if (!f.filingDate || f.filingDate < cutoff) continue;
    const kind = classifyForm(f.form);
    if (!kind) continue;
    inWindow.push({ form: f.form, filed: f.filingDate, period: f.reportDate, kind, url: filingUrl(subs.cik, f) });
  }
  inWindow.sort((a, b) => b.filed.localeCompare(a.filed));

  return {
    recent: inWindow.slice(0, opts.max),
    offeringCount: inWindow.filter((f) => f.kind === "offering").length,
  };
}

export interface ReadOptions extends SelectOptions {
  timeoutMs?: number;
  cache?: CachePolicy;
}

/**
 * One company's recent primary sources. Fail-open per company: a name SEC does
 * not list, or a request that dies, yields a stated reason and never throws —
 * one unreadable candidate must not cost the other seven their snapshot.
 */
export async function readCompanyFilings(ticker: string, opts: ReadOptions): Promise<CompanyFilings> {
  const empty = (unavailable: string, cik: number | null = null): CompanyFilings => ({
    ticker,
    cik,
    entityName: "",
    recent: [],
    offeringCount: 0,
    unavailable,
  });

  let cik: number | null = null;
  try {
    cik = await resolveTickerToCik(ticker, { timeoutMs: opts.timeoutMs });
  } catch (err) {
    return empty(`filer index unavailable (${describeFetchError(err)})`);
  }
  if (cik === null) return empty("no SEC filer record for this ticker");

  try {
    const subs = await getSubmissions(cik, { timeoutMs: opts.timeoutMs, cache: opts.cache ?? CACHE_DAILY });
    const { recent, offeringCount } = selectFilings(subs, opts);
    return { ticker, cik, entityName: subs.name, recent, offeringCount };
  } catch (err) {
    const why = err instanceof EdgarError ? err.message : describeFetchError(err);
    return empty(`filing history unavailable (${why})`, cik);
  }
}
