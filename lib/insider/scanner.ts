import {
  allInsiderFinancials,
  getInsiderTransactionsSince,
  latestInsiderScan,
  latestUniverseSnapshot,
  saveInsiderFinancials,
  saveInsiderScan,
  type InsiderTransactionRow,
} from "../db";
import { resolveTickerToCik } from "../edgar";
import { insiderEnabled, insiderSettings, type InsiderSettings } from "../insider-settings";
import { buildClusters, type InsiderCluster } from "./clusters";
import {
  buffettQualitySnapshot,
  computeOwnerEarnings,
  valueCompany,
  valueScore,
  type DcfResult,
  type QualitySnapshot,
} from "./dcf";
import {
  computeDrawdownProfile,
  passesTurnaroundPriceFilter,
  setupScore,
  type DrawdownProfile,
  type PriceFilterResult,
} from "./drawdown";
import {
  altmanZScore,
  financialStrengthGate,
  loadFinancials,
  piotroskiFScore,
  strengthScore,
  type AltmanResult,
  type FinancialYear,
  type FScoreResult,
  type StrengthGateResult,
} from "./fundamentals";
import { ingestFilings, type IngestReport } from "./ingest";
import { loadPrices, priceCoverage, refreshPrices } from "./prices";
import { applyProfile, profileByKey, type RiskProfile } from "./profiles";
import { composite, rankByComposite, weightsFrom, type CompositeResult } from "./score";

/* ============================================================================
 * Orchestration — two halves, deliberately separate.
 *
 *   refreshScan()  network → store. Manual, admin-triggered, or from the CLI.
 *   readScan()     store → every number the pages report. No network, ever.
 *
 * There is no scheduler and none is wanted: the research pipeline this app is
 * built around must never be restarted mid-run, and a background job is the
 * easiest way to do that by accident.
 *
 * The split is what makes the reader's risk tolerance free. Nothing derived is
 * stored — no candidates table, no scores, no ranking — so changing the
 * drawdown band, the required cushion or the discount rate re-derives the whole
 * list, including the reason each rejected company failed, from bytes already on
 * disk and without a single request.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * Refresh
 * -------------------------------------------------------------------------- */

export interface WorkupOutcome {
  ticker: string;
  pricesOk: boolean;
  priceNote?: string;
  financialsOk: boolean;
  financialsNote?: string;
}

export interface ScanReport {
  takenAt: string;
  ingest: IngestReport;
  /** Companies with buying that met the house thresholds. */
  candidates: number;
  /** Companies actually taken through price and statement fetching. */
  workedUp: number;
  outcomes: WorkupOutcome[];
  readNothing: boolean;
  disabled: boolean;
  notes: string[];
}

export interface RefreshOptions {
  lookbackDays?: number;
  dryRun?: boolean;
  force?: boolean;
  /** Skip the filings walk and only work up companies already stored. */
  skipIngest?: boolean;
  onProgress?: (line: string) => void;
}

/**
 * Walk the filings, then fetch prices and statements for the companies whose
 * buying is most convincing.
 *
 * A refresh in which nothing at all could be read stores nothing and reports the
 * transport reason, never a count. "No companies" reads like a market fact, and
 * a dead network is not one — the lesson the Bottleneck desk learned by blanking
 * itself during an SEC outage.
 */
export async function refreshScan(opts: RefreshOptions = {}): Promise<ScanReport> {
  const takenAt = new Date().toISOString();
  const say = opts.onProgress ?? (() => undefined);
  const s = insiderSettings();

  const empty: ScanReport = {
    takenAt,
    ingest: {
      takenAt,
      lookbackDays: opts.lookbackDays ?? s.lookbackDays,
      eligibleIssuers: 0,
      unmappedTickers: 0,
      universeWeek: null,
      daysConsidered: 0,
      daysAlreadyOnRecord: 0,
      daysRead: 0,
      daysFailed: 0,
      daysWithoutSession: 0,
      filingsListed: 0,
      filingsMatched: 0,
      filingsRead: 0,
      filingsFailed: 0,
      linesStored: 0,
      buyLines: 0,
      readNothing: true,
      disabled: false,
      notes: [],
    },
    candidates: 0,
    workedUp: 0,
    outcomes: [],
    readNothing: true,
    disabled: false,
    notes: [],
  };

  if (!insiderEnabled()) return { ...empty, disabled: true };

  const ingest = opts.skipIngest
    ? empty.ingest
    : await ingestFilings({
        lookbackDays: opts.lookbackDays,
        dryRun: opts.dryRun,
        force: opts.force,
        onProgress: say,
      });

  if (!opts.skipIngest && ingest.readNothing) {
    return {
      ...empty,
      ingest,
      notes: [
        "The filings could not be read, so no company was worked up and nothing stored was changed.",
        ...ingest.notes,
      ],
    };
  }

  // Which companies are worth the expensive half, under the HOUSE settings.
  // A reader's own profile can only ever narrow this on read, never widen it
  // past what was fetched, and the page says so.
  const rows = getInsiderTransactionsSince(windowStart(s.lookbackDays));
  const { qualifying } = buildClusters(rows, clusterOptions(s));
  const wanted = qualifying.slice(0, s.maxCandidates);

  say(`\n ${qualifying.length} companies with qualifying buying · working up the top ${wanted.length}\n`);

  const outcomes: WorkupOutcome[] = [];
  for (const c of wanted) {
    const outcome: WorkupOutcome = { ticker: c.ticker, pricesOk: false, financialsOk: false };

    if (!opts.dryRun) {
      const price = await refreshPrices(c.ticker, {
        years: s.priceHistoryYears,
        timeoutMs: s.fetchTimeoutMs,
      });
      outcome.pricesOk = price.ok;
      outcome.priceNote = price.note;

      try {
        const cik = c.issuerCik > 0 ? c.issuerCik : await resolveTickerToCik(c.ticker);
        if (cik) {
          const fin = await loadFinancials(cik, { timeoutMs: s.fetchTimeoutMs, years: 6 });
          if (fin && fin.years.length > 0) {
            saveInsiderFinancials({
              cik,
              ticker: c.ticker,
              entityName: fin.entityName,
              years: fin.years,
              tags: fin.tags,
              flags: fin.flags,
            });
            outcome.financialsOk = true;
          } else {
            outcome.financialsNote = "SEC holds no structured statements for this company.";
          }
        } else {
          outcome.financialsNote = "This symbol is not on SEC's register.";
        }
      } catch (err) {
        outcome.financialsNote = err instanceof Error ? err.message : "the statements could not be read";
      }
    }

    outcomes.push(outcome);
    say(
      ` ${c.ticker.padEnd(7)} conviction ${String(c.conviction).padStart(5)} · ` +
        `prices ${outcome.pricesOk ? "ok" : outcome.priceNote ?? "skipped"} · ` +
        `statements ${outcome.financialsOk ? "ok" : outcome.financialsNote ?? "skipped"}`,
    );
  }

  const report: ScanReport = {
    takenAt,
    ingest,
    candidates: qualifying.length,
    workedUp: outcomes.length,
    outcomes,
    readNothing: false,
    disabled: false,
    notes: ingest.notes,
  };
  if (!opts.dryRun) saveInsiderScan(report);
  return report;
}

/* ----------------------------------------------------------------------------
 * Read
 * -------------------------------------------------------------------------- */

export type Stage = "ranked" | "price" | "strength" | "buying" | "unworked";

export interface Candidate {
  ticker: string;
  companyName: string;
  cluster: InsiderCluster;

  /** Null until the company has been worked up. */
  drawdown: DrawdownProfile | null;
  priceFilter: PriceFilterResult | null;
  priceBasisMixed: boolean;

  fScore: FScoreResult | null;
  altman: AltmanResult | null;
  gate: StrengthGateResult | null;
  years: FinancialYear[];

  dcf: DcfResult | null;
  quality: QualitySnapshot | null;

  marketCapUsd: number | null;
  price: number | null;

  composite: CompositeResult;
  /** How far through the funnel this company got. */
  stage: Stage;
  /** Why it stopped, in the reader's own terms. Empty when it is ranked. */
  stopped: string[];
  flags: string[];
}

export interface ScanView {
  asOf: string | null;
  lastRefresh: string | null;
  profile: RiskProfile;
  settings: InsiderSettings;
  /** Companies that cleared every filter, best first. */
  ranked: Candidate[];
  /** Companies that did not, with the reason, grouped by where they stopped. */
  rejected: Candidate[];
  /** Buying that did not meet the reader's own thresholds. */
  belowThreshold: { ticker: string; conviction: number; totalBoughtUsd: number; reasons: string[] }[];
  funnel: { key: string; label: string; count: number }[];
  universeWeek: string | null;
  disabled: boolean;
  stale: boolean;
  flags: string[];
}

const windowStart = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

function clusterOptions(s: InsiderSettings) {
  return {
    lookbackDays: s.lookbackDays,
    minDollarValue: s.minDollarValue,
    minClusterInsiders: s.minClusterInsiders,
    requireOfficerOrDirector: s.requireOfficerOrDirector,
    discountPlannedPct: s.discountPlannedPct,
  };
}

/** Market caps from the weekly screen, so one scan values every company as of one moment. */
function marketCaps(): Map<string, number> {
  const snap = latestUniverseSnapshot();
  if (!snap) return new Map();
  return new Map(snap.rows.map((r) => [r.t.toUpperCase(), r.c]));
}

/**
 * Everything the pages report, computed from stored bytes under one risk
 * tolerance. No network and no writes.
 */
export function readScan(opts: { profile?: string | null; now?: Date } = {}): ScanView {
  const profile = profileByKey(opts.profile);
  const house = insiderSettings();
  const settings = applyProfile(house, profile);

  const base: ScanView = {
    asOf: null,
    lastRefresh: null,
    profile,
    settings,
    ranked: [],
    rejected: [],
    belowThreshold: [],
    funnel: [],
    universeWeek: null,
    disabled: false,
    stale: false,
    flags: [],
  };
  if (!insiderEnabled()) return { ...base, disabled: true };

  const scan = latestInsiderScan<ScanReport>();
  const lastRefresh = scan?.takenAt ?? null;
  const universeWeek = scan?.payload?.ingest?.universeWeek ?? null;

  const rows: InsiderTransactionRow[] = getInsiderTransactionsSince(windowStart(settings.lookbackDays));
  if (rows.length === 0) {
    return { ...base, lastRefresh, universeWeek };
  }

  const { qualifying, rejected: belowThreshold } = buildClusters(rows, clusterOptions(settings));
  const caps = marketCaps();
  const coverage = priceCoverage();
  const financials = allInsiderFinancials<FinancialYear[]>();

  // Closes are loaded once here rather than inside the assessment, which keeps
  // the assessment a pure function of its inputs.
  const closes = new Map(
    qualifying.map((c) => {
      const p = loadPrices(c.ticker, coverage);
      return [c.ticker, { closes: p.closes, mixedBasis: p.mixedBasis }] as const;
    }),
  );

  const candidates: Candidate[] = qualifying.map((cluster) =>
    assessCandidate(cluster, settings, { caps, coverage, financials, closes }),
  );

  const ranked = rankByComposite(candidates.filter((c) => c.stage === "ranked"));
  const rejectedRows = candidates.filter((c) => c.stage !== "ranked");

  const asOf = candidates
    .map((c) => c.drawdown?.asOf ?? null)
    .filter((d): d is string => d !== null)
    .sort()
    .pop() ?? null;

  const flags: string[] = [];
  const mixed = candidates.filter((c) => c.priceBasisMixed);
  if (mixed.length > 0) {
    flags.push(
      `${mixed.length} compan${mixed.length === 1 ? "y has" : "ies have"} price history from more than one ` +
        "source, which do not agree on whether closes are adjusted for distributions, so their drawdown " +
        "figures are not comparable with their own history.",
    );
  }
  const unworked = candidates.filter((c) => c.stage === "unworked").length;
  if (unworked > 0) {
    flags.push(
      `${unworked} compan${unworked === 1 ? "y has" : "ies have"} qualifying insider buying but have not yet ` +
        "had their prices and statements fetched. They are listed as not worked up rather than as failing " +
        "anything.",
    );
  }

  const stale =
    lastRefresh !== null &&
    (opts.now ?? new Date()).getTime() - Date.parse(lastRefresh) > 8 * 86_400_000;

  return {
    ...base,
    asOf,
    lastRefresh,
    ranked,
    rejected: rejectedRows,
    belowThreshold: belowThreshold.map((r) => ({
      ticker: r.cluster.ticker,
      conviction: r.cluster.conviction,
      totalBoughtUsd: r.cluster.totalBoughtUsd,
      reasons: r.reasons,
    })),
    funnel: [
      { key: "buying", label: "Companies with open-market insider buying in the window", count: qualifying.length + belowThreshold.length },
      { key: "threshold", label: "Buying that meets your conviction thresholds", count: qualifying.length },
      { key: "worked", label: "Worked up with prices and statements", count: candidates.filter((c) => c.stage !== "unworked").length },
      { key: "price", label: "Inside your drawdown band, recent and steadied", count: candidates.filter((c) => c.stage !== "unworked" && c.stage !== "price").length },
      { key: "strength", label: "Through the financial-strength gate", count: candidates.filter((c) => c.stage === "ranked").length },
    ],
    universeWeek,
    stale,
    flags,
  };
}

export interface AssessContext {
  /** Market capitalisation by ticker, from the weekly screen's frozen snapshot. */
  caps: Map<string, number>;
  coverage: Map<string, { mixed: boolean; bars: number; latest: string }>;
  financials: Map<string, { years: FinancialYear[]; entityName: string; flags: string[] }>;
  /** Stored closes by ticker. Supplied by the caller so this stays testable and pure. */
  closes: Map<string, { closes: { date: string; close: number }[]; mixedBasis: boolean }>;
}

/**
 * One company, all the way through the funnel under one set of thresholds.
 *
 * Pure: everything it reads is passed in. That is what lets the whole funnel be
 * exercised against known inputs, and it is also why a reader switching risk
 * profile costs nothing — this is the only thing that has to run again.
 */
export function assessCandidate(
  cluster: InsiderCluster,
  s: InsiderSettings,
  ctx: AssessContext,
): Candidate {
  const stored = ctx.closes.get(cluster.ticker) ?? { closes: [], mixedBasis: false };
  const fin = ctx.financials.get(cluster.ticker);
  const years = Array.isArray(fin?.years) ? fin!.years : [];
  const marketCapUsd = ctx.caps.get(cluster.ticker) ?? null;

  const shell: Candidate = {
    ticker: cluster.ticker,
    companyName: fin?.entityName || cluster.issuerName,
    cluster,
    drawdown: null,
    priceFilter: null,
    priceBasisMixed: stored.mixedBasis,
    fScore: null,
    altman: null,
    gate: null,
    years,
    dcf: null,
    quality: null,
    marketCapUsd,
    price: null,
    composite: composite({ insider: null, setup: null, strength: null, value: null }, weightsFrom(s)),
    stage: "unworked",
    stopped: [],
    flags: [...cluster.flags, ...(fin?.flags ?? [])],
  };

  if (stored.closes.length === 0) {
    return {
      ...shell,
      stopped: ["No price history has been fetched for this company yet."],
    };
  }

  const drawdown = computeDrawdownProfile(stored.closes);
  if (!drawdown) {
    return { ...shell, stopped: ["The stored price history could not be measured."] };
  }

  const priceFilter = passesTurnaroundPriceFilter(drawdown, s);
  const flags = [...shell.flags, ...drawdown.flags];
  if (stored.mixedBasis) {
    flags.push(
      "This company's stored closes come from more than one source, and the two do not agree on whether " +
        "prices are adjusted for distributions, so the percentages below are not comparable with their own " +
        "history.",
    );
  }

  if (!priceFilter.pass) {
    return {
      ...shell,
      drawdown,
      priceFilter,
      price: drawdown.price,
      stage: "price",
      stopped: priceFilter.checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`),
      flags,
    };
  }

  // Financial strength.
  let fScore: FScoreResult | null = null;
  let altman: AltmanResult | null = null;
  if (years.length >= 2) {
    fScore = piotroskiFScore(years[years.length - 1], years[years.length - 2], years[years.length - 3]);
    altman = altmanZScore(years[years.length - 1], marketCapUsd);
    flags.push(...fScore.flags, ...altman.flags);
  } else {
    flags.push(
      "Fewer than two fiscal years of statements could be read, so neither published financial filter could " +
        "run for this company.",
    );
  }
  const gate = financialStrengthGate(fScore, altman, s);

  if (!gate.pass) {
    return {
      ...shell,
      drawdown,
      priceFilter,
      price: drawdown.price,
      fScore,
      altman,
      gate,
      stage: "strength",
      stopped: gate.reasons,
      flags,
    };
  }

  // Valuation.
  const latest = years[years.length - 1];
  const dcf =
    years.length >= 2
      ? valueCompany(years, drawdown.price, latest?.shares ?? null, {
          years: s.projectionYears,
          growthHaircut: s.growthHaircutPct / 100,
          maxGrowthRate: s.maxGrowthRatePct / 100,
          discountRate: s.discountRatePct / 100,
          terminalGrowth: s.terminalGrowthPct / 100,
        })
      : null;
  const quality = dcf ? buffettQualitySnapshot(years, computeOwnerEarnings(years, "total")) : null;
  if (dcf) flags.push(...dcf.flags);

  const comp = composite(
    {
      insider: cluster.conviction,
      setup: setupScore(drawdown, s),
      strength: strengthScore(fScore, altman),
      value: valueScore(dcf?.marginOfSafetyLow ?? null, s.minMarginOfSafetyPct / 100),
    },
    weightsFrom(s),
  );

  return {
    ...shell,
    drawdown,
    priceFilter,
    price: drawdown.price,
    fScore,
    altman,
    gate,
    dcf,
    quality,
    composite: comp,
    stage: "ranked",
    stopped: [],
    flags: gate.flaggedOnly ? [...flags, ...gate.reasons] : flags,
  };
}

/** One company by ticker, for the detail page. Null when it has no buying in the window. */
export function readCandidate(
  ticker: string,
  opts: { profile?: string | null } = {},
): { candidate: Candidate; view: ScanView } | null {
  const view = readScan(opts);
  const wanted = ticker.toUpperCase();
  const candidate =
    view.ranked.find((c) => c.ticker === wanted) ?? view.rejected.find((c) => c.ticker === wanted);
  return candidate ? { candidate, view } : null;
}
