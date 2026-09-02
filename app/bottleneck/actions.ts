"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { bottleneckSettings, saveBottleneckDiff } from "@/lib/bottleneck-settings";
import {
  allPlaybooks,
  customPlaybooks,
  DEFAULT_PLAYBOOK_ID,
  getPlaybook,
  saveCustomPlaybooks,
  usesPlaceholderFactors,
} from "@/lib/bottleneck/playbook";
import { isUsListing, type ResolutionSource } from "@/lib/bottleneck/cusip";
import { refreshDesk, scoreFromStored } from "@/lib/bottleneck/desk";
import { countSupplyPoints, deleteSupplyPoint, getSupplySeries, saveSupplyPoints } from "@/lib/db";
import {
  auditExposure,
  clearHoldings,
  parseHoldingsCsv,
  savedHoldings,
  saveHoldings,
  type ExposureInputs,
  type ExposureReport,
  type Holding as PortfolioHolding,
  type PricedHolding,
} from "@/lib/bottleneck/exposure";
import {
  cloneManager,
  searchManagers,
  sizeToBalance,
  ThirteenFError,
  type CloneResult,
  type Holding,
  type ManagerMatch,
  type OrderProposal,
  type PositionChange,
  type ThirteenFFiling,
} from "@/lib/bottleneck/thirteenf";
import { fetchIndependentQuote } from "@/lib/price-sanity";

/* ============================================================================
 * Bottleneck desk — server actions.
 *
 * Two gates, and they are not the same gate:
 *
 *   the pre-launch curtain   applies to EVERY action here. In launch mode the
 *                            desk does not exist and an admin token does not
 *                            bypass that (flip MAG8_SITE_MODE=full to operate).
 *   the admin token          applies to configuration and to position sizing.
 *
 * Reading a manager's disclosed holdings is public, because the filing is: a
 * 13F is a public document and showing it back is not a privilege. Turning
 * those weights into dollar amounts against a stated account balance is the
 * owner's own business and stays behind the token.
 * ========================================================================== */

export interface ActionState {
  ok: boolean;
  message: string;
}

/** The curtain alone — what a visitor may reach when the site is open. */
function publicDeskOpen(): boolean {
  return !launchMode();
}

async function adminAuthorized(): Promise<boolean> {
  if (launchMode()) return false;
  return tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
}

/**
 * Persist the owner's desk overrides. The client posts the whole settings map;
 * only values differing from the default/env baseline are stored, so a value
 * typed back to its baseline reverts to default provenance. Pass {} to reset.
 */
export async function saveBottleneckSettingsAction(
  input: Record<string, number | boolean>,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const { count } = saveBottleneckDiff(input);
  return {
    ok: true,
    message:
      count === 0
        ? "All values at their default/env baseline — no overrides stored."
        : `Saved ${count} override${count === 1 ? "" : "s"}. The desk uses them on its next read.`,
  };
}

export interface PlaybookSummary {
  id: string;
  label: string;
  blurb: string;
  builtIn: boolean;
  basket: string[];
  capexTags: number;
  /** What the tag chain measures — not every theme's demand is capital spending. */
  measure: string;
  conversionVersion: string;
  conversionAsOf: string;
  factors: { key: string; unit: string; usdPer: number; source: string; asOf: string }[];
  placeholderFactors: boolean;
  supply: { seriesId: string; label: string; unit: string; connector: string; stub: boolean }[];
  owners: { category: string; label: string; tickers: string[]; foreign: string[] }[];
}

function summarize(id: string): PlaybookSummary | null {
  const pb = getPlaybook(id);
  if (!pb) return null;
  return {
    id: pb.id,
    label: pb.label,
    blurb: pb.blurb,
    builtIn: pb.builtIn,
    basket: pb.demand.basket,
    capexTags: pb.demand.capexTags.length,
    measure: pb.demand.measure,
    conversionVersion: pb.conversions.version,
    conversionAsOf: pb.conversions.asOf,
    factors: pb.conversions.factors.map((f) => ({
      key: f.key,
      unit: f.unit,
      usdPer: f.usdPer,
      source: f.source,
      asOf: f.asOf,
    })),
    placeholderFactors: usesPlaceholderFactors(pb),
    supply: pb.supply.map((s) => ({
      seriesId: s.seriesId,
      label: s.label,
      unit: s.unit,
      connector: s.connector,
      stub: Boolean(s.stub),
    })),
    owners: pb.owners.map((o) => ({
      category: o.category,
      label: o.label,
      tickers: o.tickers,
      foreign: o.foreign,
    })),
  };
}

/** Read-only inspection of a playbook, for the admin panel. */
export async function inspectPlaybookAction(
  id: string,
): Promise<{ ok: true; playbook: PlaybookSummary } | { ok: false; message: string }> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const summary = summarize(id);
  return summary ? { ok: true, playbook: summary } : { ok: false, message: `No playbook with id "${id}".` };
}

/** Ids and labels of every available playbook (built-in plus owner-defined). */
export async function listPlaybooksAction(): Promise<{ id: string; label: string; builtIn: boolean }[]> {
  if (!(await adminAuthorized())) return [];
  return allPlaybooks().map((p) => ({ id: p.id, label: p.label, builtIn: p.builtIn }));
}

/* ----------------------------------------------------------------------------
 * Defining a theme without a deploy
 *
 * A playbook is data, so pointing the desk at a new sector should not require
 * shipping code. The owner edits the definition directly against the schema
 * that validates it; every rejection comes back as the field that failed rather
 * than as "invalid", because a silent partial save would leave the desk
 * measuring something nobody chose.
 * -------------------------------------------------------------------------- */

export interface PlaybookDraft {
  /** The owner-defined set, as JSON text. */
  json: string;
  /** Ids currently stored as owner-defined (not the built-ins). */
  customIds: string[];
}

/** The owner-defined playbooks as editable JSON, plus a built-in to start from. */
export async function loadPlaybookDraftAction(
  seedFrom?: string,
): Promise<{ ok: true; draft: PlaybookDraft } | { ok: false; message: string }> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const custom = customPlaybooks();
  if (seedFrom) {
    const source = getPlaybook(seedFrom);
    if (!source) return { ok: false, message: `No playbook with id "${seedFrom}".` };
    // Seeded as a COPY with a distinct id: overwriting a built-in by accident
    // would silently replace an audited definition with an edited one.
    const copy = { ...source, id: `${source.id}-copy`, label: `${source.label} (copy)`, builtIn: false };
    return { ok: true, draft: { json: JSON.stringify([...custom, copy], null, 2), customIds: custom.map((p) => p.id) } };
  }
  return {
    ok: true,
    draft: { json: JSON.stringify(custom, null, 2), customIds: custom.map((p) => p.id) },
  };
}

/** Validate and persist the owner-defined playbook set. Replaces it wholesale. */
export async function savePlaybooksAction(json: string): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json.trim() === "" ? "[]" : json);
  } catch (err) {
    return { ok: false, message: `That is not valid JSON: ${err instanceof Error ? err.message : "parse failed"}` };
  }
  if (!Array.isArray(parsed)) return { ok: false, message: "The top level must be an array of playbooks." };

  const { saved, errors } = saveCustomPlaybooks(parsed);
  if (errors.length > 0) {
    return { ok: false, message: `Nothing was saved. ${errors.length} problem(s): ${errors.join("; ")}` };
  }
  return {
    ok: true,
    message:
      saved === 0
        ? "Cleared — only the built-in themes remain."
        : `Saved ${saved} owner-defined theme${saved === 1 ? "" : "s"}. The desk uses ${saved === 1 ? "it" : "them"} on its next read.`,
  };
}

/* ============================================================================
 * Module A — the institutional clone.
 *
 * The actions below return a trimmed VIEW rather than the parsed filing. Some
 * managers file thousands of positions, and shipping a whole book into a page
 * payload to render two hundred rows of it is waste the reader pays for. The
 * totals are always computed from the complete filing; only the rows are cut,
 * and the view says how many were left out.
 * ========================================================================== */

export interface HoldingRow {
  ticker: string | null;
  name: string;
  cusip: string;
  valueUsd: number;
  shares: number;
  /** Share of the long book. Null on option rows, which are weighted separately. */
  pctOfLong: number | null;
  putCall: "Put" | "Call" | null;
  /** How the ticker was established; "openfigi"/"universe-name" mean US-listed. */
  resolvedBy: ResolutionSource;
  usListed: boolean;
}

export interface DiffRow {
  ticker: string | null;
  name: string;
  cusip: string;
  change: PositionChange;
  sharesNow: number;
  sharesBefore: number;
  sharesDeltaPct: number | null;
  pctOfLongNow: number | null;
  usListed: boolean;
}

export interface CloneView {
  cik: number;
  filerName: string;
  period: string;
  filedAt: string;
  form: string;
  lagDays: number;
  /** The rule's allowance, from the desk settings — shown beside the measured lag. */
  lagAllowanceDays: number;
  valueScale: 1 | 1000;
  sourceUrl: string;
  totals: ThirteenFFiling["totals"];
  priorPeriod: string | null;
  long: HoldingRow[];
  options: HoldingRow[];
  diff: DiffRow[];
  periods: { period: string; filedAt: string; form: string }[];
  flags: string[];
  /** Rows omitted from each list because of the display cap. */
  omitted: { long: number; options: number; diff: number };
}

/** Rows rendered per table. Beyond this the page says how many it left out. */
const DISPLAY_ROWS = 250;

const toRow = (h: Holding): HoldingRow => ({
  ticker: h.ticker,
  name: h.nameOfIssuer,
  cusip: h.cusip,
  valueUsd: h.valueUsd,
  shares: h.shares,
  pctOfLong: h.pctOfLong,
  putCall: h.putCall,
  resolvedBy: h.resolvedBy,
  usListed: h.ticker !== null && isUsListing(h.resolvedBy),
});

function toCloneView(clone: CloneResult, minPct: number, lagAllowanceDays: number): CloneView {
  const { current, prior, diff } = clone;
  const long = current.long.filter((h) => (h.pctOfLong ?? 0) >= minPct);
  return {
    cik: current.cik,
    filerName: current.filerName,
    period: current.period,
    filedAt: current.filedAt,
    form: current.form,
    lagDays: current.lagDays,
    lagAllowanceDays,
    valueScale: current.valueScale,
    sourceUrl: current.sourceUrl,
    totals: current.totals,
    priorPeriod: prior?.period ?? null,
    long: long.slice(0, DISPLAY_ROWS).map(toRow),
    options: current.options.slice(0, DISPLAY_ROWS).map(toRow),
    diff: diff.slice(0, DISPLAY_ROWS).map((d) => ({
      ticker: d.ticker,
      name: d.nameOfIssuer,
      cusip: d.cusip,
      change: d.change,
      sharesNow: d.sharesNow,
      sharesBefore: d.sharesBefore,
      sharesDeltaPct: d.sharesDeltaPct,
      pctOfLongNow: d.pctOfLongNow,
      usListed: d.ticker !== null && isUsListing(d.resolvedBy),
    })),
    periods: clone.periods.slice(0, 12).map((p) => ({ period: p.period, filedAt: p.filedAt, form: p.form })),
    flags: clone.flags,
    omitted: {
      long: Math.max(0, long.length - DISPLAY_ROWS),
      options: Math.max(0, current.options.length - DISPLAY_ROWS),
      diff: Math.max(0, diff.length - DISPLAY_ROWS),
    },
  };
}

export type SearchResult = { ok: true; matches: ManagerMatch[] } | { ok: false; message: string };

/**
 * Find 13F filers by name. Public: this searches public filings, and every
 * result is a CIK anyone can look up on EDGAR directly.
 */
export async function searchManagersAction(name: string): Promise<SearchResult> {
  if (!publicDeskOpen()) return { ok: false, message: "Not available." };
  const query = name.trim().slice(0, 120);
  if (query.length < 3) return { ok: false, message: "Enter at least three characters of the manager's name." };
  try {
    const matches = await searchManagers(query, { timeoutMs: bottleneckSettings().edgarTimeoutMs });
    return matches.length > 0
      ? { ok: true, matches: matches.slice(0, 20) }
      : { ok: false, message: `No 13F filer on record matches "${query}".` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "The filings search could not be reached." };
  }
}

export type CloneActionResult = { ok: true; clone: CloneView } | { ok: false; message: string };

/**
 * Read one manager's latest 13F-HR, the period before it, and the changes
 * between them. Public, and cheap on repeat: a parsed period is stored, and a
 * filed 13F never changes.
 */
export async function cloneManagerAction(cik: number): Promise<CloneActionResult> {
  if (!publicDeskOpen()) return { ok: false, message: "Not available." };
  if (!Number.isInteger(cik) || cik <= 0) return { ok: false, message: "That is not a CIK." };
  const settings = bottleneckSettings();
  try {
    const clone = await cloneManager(cik);
    return { ok: true, clone: toCloneView(clone, settings.holdingsMinPct, settings.filingLagDays) };
  } catch (err) {
    if (err instanceof ThirteenFError) return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "The filing could not be read." };
  }
}

export type SizingResult =
  | { ok: true; orders: OrderProposal[]; pricedAt: string; unpriced: number }
  | { ok: false; message: string };

/**
 * Apply a manager's disclosed weights to an account balance. ADMIN ONLY — an
 * account balance is the owner's, not a visitor's, and the output reads like an
 * instruction even though it is nothing of the kind.
 *
 * It produces a list to look at. Nothing here is connected to a broker.
 */
export async function sizeCloneAction(cik: number, balanceUsd: number): Promise<SizingResult> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  if (!Number.isFinite(balanceUsd) || balanceUsd <= 0) return { ok: false, message: "Enter an account balance." };
  if (!Number.isInteger(cik) || cik <= 0) return { ok: false, message: "That is not a CIK." };

  const settings = bottleneckSettings();
  let long: Holding[];
  try {
    long = (await cloneManager(cik)).current.long;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "The filing could not be read." };
  }

  // One quote per US-listed name, all at once; a failure yields no price, and
  // the proposal falls back to dollars alone rather than to a stale number.
  const quotes = await Promise.all(
    long.map(async (h) => {
      if (!h.ticker || !isUsListing(h.resolvedBy)) return null;
      const price = await fetchIndependentQuote(h.ticker);
      return price === null ? null : ([h.ticker, price] as const);
    }),
  );
  const prices = new Map(quotes.filter((q): q is readonly [string, number] => q !== null));
  const orders = sizeToBalance(long, balanceUsd, prices, settings.holdingsMinPct).slice(0, DISPLAY_ROWS);
  return {
    ok: true,
    orders,
    pricedAt: new Date().toISOString(),
    unpriced: orders.filter((o) => o.suggestedShares === null).length,
  };
}

/** Whether the viewer's desk is unlocked — decided on the server, never inferred on the client. */
export async function deskUnlockedAction(): Promise<boolean> {
  return adminAuthorized();
}

/* ============================================================================
 * Operating the desk — refresh, and observations entered by hand.
 *
 * There is deliberately no scheduler: this codebase has none, inventing one was
 * ruled out, and the desk follows the weekly universe screen's pattern instead —
 * a stored snapshot, computed on read, refreshed by a person or by the headless
 * script. This is the "by a person" half.
 *
 * Hand entry is not a convenience. Several named supply sources have no
 * automated feed and the desk SAYS SO on its public page, in the same breath as
 * saying dated observations can be entered by hand. Without this, that sentence
 * would be false — and a stub series with no way to fill it is a constraint the
 * desk can never measure.
 * ========================================================================== */

export interface RefreshSummary {
  ok: boolean;
  message: string;
  /** Seconds the refresh took, so a slow SEC day is visible rather than mysterious. */
  seconds?: number;
  demandTakenAt?: string;
  contributing?: number;
  basketSize?: number;
  seriesFetched?: number;
}

/**
 * Re-read a theme: capital spending, every supply series, then the score.
 * Admin-only — it makes real requests to SEC and FRED and writes snapshots.
 * Costs nothing and draws no research capacity, so it can be run all day.
 */
export async function refreshDeskAction(
  playbookId: string,
  opts: { reuseDemand?: boolean } = {},
): Promise<RefreshSummary> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const pb = getPlaybook(playbookId);
  if (!pb) return { ok: false, message: `No theme with id "${playbookId}".` };

  const started = Date.now();
  try {
    const { demand, supply, published } = await refreshDesk(pb, { reuseDemand: opts.reuseDemand });
    const seconds = Math.round((Date.now() - started) / 100) / 10;

    // Nothing was read, so nothing was stored. Report the actual transport
    // reason rather than "0 of 6" — the distinction between "SEC is refusing
    // us" and "these companies stopped filing" is the whole diagnosis.
    if (!published) {
      const reason = demand.companies.find((c) => c.note)?.note ?? "no reason was reported";
      return {
        ok: false,
        message:
          `Nothing was read, so nothing was stored — the reading on the page is unchanged. Every company in the ` +
          `basket failed the same way after ${seconds}s: ${reason} If this is SEC refusing traffic, waiting a ` +
          `few minutes usually clears it.`,
        seconds,
        contributing: 0,
        basketSize: demand.aggregate.basketSize,
      };
    }

    const missing = demand.aggregate.basketSize - demand.aggregate.contributing;
    return {
      ok: true,
      message:
        `Read ${demand.aggregate.contributing} of ${demand.aggregate.basketSize} companies and ` +
        `${supply.length} supply series in ${seconds}s.` +
        (opts.reuseDemand ? " Demand was reused from the stored reading." : "") +
        (missing > 0
          ? ` ${missing} contributed nothing and ${missing === 1 ? "is" : "are"} excluded from the totals — see the disclosed gaps.`
          : ""),
      seconds,
      demandTakenAt: demand.takenAt,
      contributing: demand.aggregate.contributing,
      basketSize: demand.aggregate.basketSize,
      seriesFetched: supply.reduce((n, s) => n + s.fetched, 0),
    };
  } catch (err) {
    return {
      ok: false,
      message: `The refresh could not finish: ${err instanceof Error ? err.message : String(err)}. Any stored reading still stands.`,
    };
  }
}

export interface SeriesState {
  seriesId: string;
  label: string;
  unit: string;
  /** Which physical unit this series constrains. */
  constrains: string;
  connector: string;
  stub: boolean;
  sourceUrl: string | null;
  points: number;
  latest: string | null;
  /** The most recent hand-entered observations, newest first — the only ones deletable here. */
  manual: { date: string; value: number }[];
}

/** Every series a theme declares, with what is stored for it. */
export async function supplySeriesAction(playbookId: string): Promise<SeriesState[]> {
  if (!(await adminAuthorized())) return [];
  const pb = getPlaybook(playbookId);
  if (!pb) return [];
  return pb.supply.map((s) => {
    const points = getSupplySeries(s.seriesId);
    return {
      seriesId: s.seriesId,
      label: s.label,
      unit: s.unit,
      constrains: s.constrains,
      connector: s.connector,
      stub: Boolean(s.stub),
      sourceUrl: s.sourceUrl ?? null,
      points: countSupplyPoints(s.seriesId),
      latest: points.length > 0 ? points[points.length - 1].date : null,
      manual: points
        .filter((p) => p.origin === "manual")
        .slice(-12)
        .reverse()
        .map((p) => ({ date: p.date, value: p.value })),
    };
  });
}

/**
 * Record one dated observation by hand. The unit comes from the playbook's own
 * series definition rather than from the form, so a hand-entered point can never
 * be measured in something the series does not use.
 */
export async function addSupplyPointAction(
  playbookId: string,
  seriesId: string,
  date: string,
  value: number,
  sourceUrl?: string,
): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const pb = getPlaybook(playbookId);
  const series = pb?.supply.find((s) => s.seriesId === seriesId);
  if (!series) return { ok: false, message: `"${seriesId}" is not a series in this theme.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Give the date as YYYY-MM-DD." };
  if (!Number.isFinite(value)) return { ok: false, message: "Give a numeric value." };

  saveSupplyPoints([
    {
      seriesId,
      date,
      value,
      unit: series.unit,
      sourceUrl: sourceUrl?.trim() || series.sourceUrl || null,
      origin: "manual",
    },
  ]);
  return {
    ok: true,
    message:
      `Recorded ${value} ${series.unit} at ${date}. It counts toward this series' history like any other ` +
      `observation, and is labelled as entered by hand wherever it appears.`,
  };
}

/** Remove one observation. Only ever used to correct a hand-entered mistake. */
export async function deleteSupplyPointAction(seriesId: string, date: string): Promise<ActionState> {
  if (!(await adminAuthorized())) return { ok: false, message: "Not authorized." };
  const removed = deleteSupplyPoint(seriesId, date);
  return removed
    ? { ok: true, message: `Removed the ${date} observation from ${seriesId}.` }
    : { ok: false, message: `No observation stored for ${seriesId} at ${date}.` };
}

/* ============================================================================
 * Module D — the exposure audit. ADMIN ONLY, all of it.
 *
 * Holdings are the owner's own portfolio. They never reach a public payload,
 * they live in one app_settings key, and no part of this connects to a broker.
 * ========================================================================== */

export interface ExposureState {
  /** Null when the desk is locked — the page renders nothing rather than an empty portfolio. */
  report: ExposureReport | null;
  holdings: PortfolioHolding[];
  /** Lines from the last paste that could not be read. */
  rejected: { line: string; reason: string }[];
  /** The cloned manager the comparison ran against, when one is stored. */
  comparedTo: { cik: number; filerName: string; period: string } | null;
  message: string;
}

const EMPTY: ExposureState = { report: null, holdings: [], rejected: [], comparedTo: null, message: "Not authorized." };

/** Attach a live price to each holding. A failure yields null, never a stale or zero value. */
async function priceHoldings(holdings: PortfolioHolding[]): Promise<PricedHolding[]> {
  return Promise.all(
    holdings.map(async (h) => {
      const price = await fetchIndependentQuote(h.ticker);
      return { ...h, price, valueUsd: price === null ? null : price * h.shares };
    }),
  );
}

/** Build the report for the stored holdings, optionally against a cloned manager. */
async function buildExposure(
  holdings: PortfolioHolding[],
  rejected: { line: string; reason: string }[],
  compareCik: number | null,
  message: string,
): Promise<ExposureState> {
  const pb = getPlaybook(DEFAULT_PLAYBOOK_ID);
  if (!pb) return { report: null, holdings, rejected, comparedTo: null, message: "No playbook is configured." };

  let manager: ExposureInputs["manager"] = null;
  let comparedTo: ExposureState["comparedTo"] = null;
  if (compareCik !== null) {
    try {
      const filing = (await cloneManager(compareCik)).current;
      manager = {
        filerName: filing.filerName,
        period: filing.period,
        long: filing.long.map((h) => ({ ticker: h.ticker, pctOfLong: h.pctOfLong })),
      };
      comparedTo = { cik: filing.cik, filerName: filing.filerName, period: filing.period };
    } catch {
      // A comparison that cannot be loaded degrades to no comparison, never an error page.
    }
  }

  const report = auditExposure({
    playbook: pb,
    holdings: await priceHoldings(holdings),
    bottleneck: scoreFromStored(pb)?.snapshot ?? null,
    settings: bottleneckSettings(),
    manager,
  });
  return { report, holdings, rejected, comparedTo, message };
}

/** The stored portfolio, priced and audited. */
export async function exposureAction(compareCik?: number): Promise<ExposureState> {
  if (!(await adminAuthorized())) return EMPTY;
  const holdings = savedHoldings();
  return buildExposure(
    holdings,
    [],
    Number.isInteger(compareCik) && (compareCik ?? 0) > 0 ? (compareCik as number) : null,
    holdings.length === 0 ? "No holdings stored yet." : "",
  );
}

/** Replace the stored portfolio from a pasted list, then audit it. */
export async function saveHoldingsAction(text: string, compareCik?: number): Promise<ExposureState> {
  if (!(await adminAuthorized())) return EMPTY;
  const { holdings, rejected } = parseHoldingsCsv(text.slice(0, 200_000));
  saveHoldings(holdings);
  return buildExposure(
    holdings,
    rejected,
    Number.isInteger(compareCik) && (compareCik ?? 0) > 0 ? (compareCik as number) : null,
    holdings.length === 0
      ? "Nothing readable in that paste — see the rejected lines below."
      : `Stored ${holdings.length} position${holdings.length === 1 ? "" : "s"}.`,
  );
}

/** Forget the stored portfolio entirely. */
export async function clearHoldingsAction(): Promise<ExposureState> {
  if (!(await adminAuthorized())) return EMPTY;
  clearHoldings();
  return { report: null, holdings: [], rejected: [], comparedTo: null, message: "Holdings cleared." };
}

