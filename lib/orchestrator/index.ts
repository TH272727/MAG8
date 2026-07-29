import { CONFIG } from "../config";
import {
  finishRun,
  getRecentCoverage,
  getRunMarketContext,
  insertCandidates,
  insertRankings,
  isoWeekKey,
  reopenRun,
  setRunStage,
} from "../db";
import { priceCheckEnabled, priceSanityFlags, type PriceCheckInput } from "../price-sanity";
import { describeScreen, getWeeklyUniverse, universeEnabled, universeScreenFlags, type UniverseResult } from "../universe";
import {
  LENS_SKILLS,
  cellKey,
  type CellKey,
  type DiscoveryCandidate,
  type DiscoveryResult,
  type RunParams,
} from "../schemas";
import { runAnalysisMatrix, type CellOutcome } from "./analysis";
import { runBlindDiscovery } from "./blind";
import { runCompiler } from "./compiler";
import { runDiscovery } from "./discovery";
import { executeMockRun } from "./mock";
import { emitProgress, nowIso } from "./progress";
import { applySelectionQuota, selectionQuotaFrom } from "./selection";
import type { ResumePlan } from "./resume";

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Mutable spend accumulator — the catch path persists whatever was spent before the failure. */
interface CostRef {
  total: number;
}

/**
 * Stage 0: deterministic universe screen before discovery. Fail-open — any
 * failure returns null and the scout hunts unscreened exactly as before;
 * either way the outcome is disclosed on the activity feed.
 */
async function runUniverseScreen(runId: string, force: boolean): Promise<UniverseResult | null> {
  if (!universeEnabled()) return null;
  emitProgress(runId, {
    type: "discovery_activity",
    activity: "Refreshing this week's universe screen…",
    at: nowIso(),
  });
  const universe = await getWeeklyUniverse(force);
  emitProgress(runId, {
    type: "discovery_activity",
    activity: universe
      ? `Universe screen: ${describeScreen(universe.pool)}.`
      : "Universe screen unavailable this run — the scout proceeds unscreened.",
    at: nowIso(),
  });
  return universe;
}

/**
 * Deterministic price grounding between analysis and compile: each ticker whose
 * street-consensus cell reported a spot price gets one independent quote check;
 * divergences come back as gap-note flags. Fail-silent and kill-switchable
 * (MAG8_PRICE_CHECK=0) — see lib/price-sanity.ts.
 */
async function runPriceSanity(
  runId: string,
  candidates: DiscoveryCandidate[],
  cells: Map<CellKey, CellOutcome>,
): Promise<string[]> {
  if (!priceCheckEnabled()) return [];
  const inputs: PriceCheckInput[] = [];
  for (const c of candidates) {
    const cell = cells.get(cellKey(c.ticker, "institutional-forecast"));
    const price = cell?.ok && cell.analysis ? cell.analysis.keyMetrics.currentPrice : null;
    if (typeof price === "number" && price > 0) inputs.push({ ticker: c.ticker, lensPrice: price });
  }
  if (inputs.length === 0) return [];
  emitProgress(runId, {
    type: "compile_activity",
    activity: "Cross-checking lens spot prices against an independent quote source…",
    at: nowIso(),
  });
  const flags = await priceSanityFlags(inputs);
  if (flags.length > 0) {
    emitProgress(runId, {
      type: "compile_activity",
      activity: `Price check flagged ${flags.length} ticker${flags.length === 1 ? "" : "s"} — noted as data gaps.`,
      at: nowIso(),
    });
  }
  return flags;
}

/**
 * Stages 2–3, shared verbatim by a fresh run and a resume so the two can never
 * drift: analysis matrix (a resume hands in the cells it already banked),
 * deterministic grounding checks, compile, persist. Throws on abort/fatal —
 * the caller owns the error contract.
 */
async function analyzeAndCompile(
  runId: string,
  params: RunParams,
  discovery: DiscoveryResult,
  watchdog: AbortController,
  cost: CostRef,
  opts: {
    universe: UniverseResult | null;
    /** Run-level disclosures gathered before this point (selection discipline, resume notes). */
    extraGaps: string[];
    banked?: Map<CellKey, CellOutcome>;
  },
): Promise<void> {
  setRunStage(runId, "analysis");
  emitProgress(runId, { type: "stage_start", stage: "analysis", at: nowIso() });
  const { cells, costUsd: analysisCost } = await runAnalysisMatrix(runId, discovery.candidates, {
    force: params.force,
    signal: watchdog.signal,
    // Weekly-snapshot ground truth (exchange feed + SEC filings) rides into
    // every lens prompt — deterministic anchors the models verify against
    // instead of re-deriving from search alone.
    universe: opts.universe,
    banked: opts.banked,
    // Plan-limit / auth failures hit every subsequent call too — abort the run
    // instead of cascading the same error through the whole matrix + compile.
    onFatal: (reason) => {
      if (!watchdog.signal.aborted) {
        watchdog.abort(
          new Error(
            `${reason} — run aborted early. Completed lens cells are kept; resuming this run only re-does the unfinished ones.`,
          ),
        );
      }
    },
  });
  cost.total += analysisCost;

  if (watchdog.signal.aborted) {
    const reason = watchdog.signal.reason;
    throw reason instanceof Error ? reason : new Error(String(reason));
  }

  const okCells = [...cells.values()].filter((c) => c.ok).length;
  if (okCells === 0) {
    throw new Error("All lens analyses failed — aborting before compilation.");
  }
  const errored = discovery.candidates.length * LENS_SKILLS.length - okCells;
  if (errored > 0) {
    emitProgress(runId, {
      type: "compile_activity",
      activity: `${okCells} lens cells ok, ${errored} errored — errored lenses will score neutral.`,
      at: nowIso(),
    });
  }

  setRunStage(runId, "compile");
  emitProgress(runId, { type: "stage_start", stage: "compile", at: nowIso() });
  const screenFlags = opts.universe ? universeScreenFlags(discovery.candidates, opts.universe) : [];
  if (screenFlags.length > 0) {
    emitProgress(runId, {
      type: "compile_activity",
      activity: `Universe screen flagged ${screenFlags.length} pick${screenFlags.length === 1 ? "" : "s"} (band, price, or solvency) — noted as data gaps.`,
      at: nowIso(),
    });
  }
  const priceFlags = await runPriceSanity(runId, discovery.candidates, cells);
  const { report, costUsd: compileCost } = await runCompiler(runId, discovery, cells, watchdog.signal, {
    modifier: params.modifier,
    extraGaps: [...opts.extraGaps, ...screenFlags, ...priceFlags],
  });
  cost.total += compileCost;

  insertRankings(runId, report.rankings);
  finishRun(runId, { status: "complete", report, totalCostUsd: round2(cost.total) });
  emitProgress(runId, { type: "run_complete", report, totalCostUsd: round2(cost.total), at: nowIso() });
}

/** Shared failure contract: the error lands in the DB and the event log, never as a rejection. */
function persistRunFailure(runId: string, err: unknown, cost: CostRef): void {
  const message = err instanceof Error ? err.message : String(err);
  try {
    finishRun(runId, { status: "error", error: message, totalCostUsd: round2(cost.total) });
    emitProgress(runId, { type: "run_error", error: message, at: nowIso() });
  } catch (persistErr) {
    console.error(`[mag8] failed to persist run error for ${runId}:`, persistErr, "original:", message);
  }
}

function newWatchdog(): { watchdog: AbortController; timer: ReturnType<typeof setTimeout> } {
  const watchdog = new AbortController();
  const timer = setTimeout(
    () => watchdog.abort(new Error(`Run watchdog: exceeded ${Math.round(CONFIG.timeoutsMs.run / 60_000)} minutes`)),
    CONFIG.timeoutsMs.run,
  );
  return { watchdog, timer };
}

/**
 * Executes one full run. NEVER rejects: every failure path lands in the DB and
 * the event log (an escaped rejection would kill the Node process).
 */
export async function executeRun(runId: string, params: RunParams): Promise<void> {
  if (params.mock) {
    return executeMockRun(runId, params);
  }

  const { watchdog, timer } = newWatchdog();
  const cost: CostRef = { total: 0 };

  try {
    setRunStage(runId, "discovery");
    emitProgress(runId, { type: "stage_start", stage: "discovery", at: nowIso() });
    const universe = await runUniverseScreen(runId, params.force);
    const discoveryCtx = {
      coverage: getRecentCoverage(5),
      modifier: params.modifier,
      pool: universe?.pool,
      settings: universe?.settings,
    };
    const { discovery, costUsd: discoveryCost, selectionFlags } = params.blind
      ? await runBlindDiscovery(runId, params.count, watchdog.signal, discoveryCtx)
      : await runDiscovery(runId, params.count, watchdog.signal, discoveryCtx);
    cost.total += discoveryCost;
    insertCandidates(runId, discovery.candidates);
    emitProgress(runId, {
      type: "discovery_complete",
      marketContext: discovery.marketContext,
      candidates: discovery.candidates,
      at: nowIso(),
    });

    await analyzeAndCompile(runId, params, discovery, watchdog, cost, {
      universe,
      extraGaps: selectionFlags,
    });
  } catch (err) {
    persistRunFailure(runId, err, cost);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Finishes a run that stopped mid-flight, IN PLACE — same run id, same cohort,
 * same URL, cost accumulating on the existing row. Stage 1 never repeats and
 * banked cells never re-run, so the plan window pays only for the gaps plus the
 * compile. Same never-rejects contract as executeRun; a resume that dies again
 * simply leaves a smaller gap for the next one.
 *
 * The plan comes from planResume() — see lib/orchestrator/resume.ts.
 */
export async function executeResume(runId: string, plan: ResumePlan): Promise<void> {
  const { watchdog, timer } = newWatchdog();
  // The earlier attempt's spend stands; this one adds to it.
  const cost: CostRef = { total: plan.run.totalCostUsd ?? 0 };

  try {
    reopenRun(runId);
    emitProgress(runId, {
      type: "discovery_activity",
      activity:
        `Resuming this run — the cohort of ${plan.candidates.length} stands as delivered; ` +
        `${plan.banked.size} of ${plan.total} lens cells are already complete, so only the remaining ${plan.remaining} run.`,
      at: nowIso(),
    });

    // Deliberately NOT a forced refetch, whatever the run's own force flag says:
    // the resumed cells must read the same frozen weekly snapshot the first
    // attempt did, or one cohort would be judged against two ground truths.
    const universe = await runUniverseScreen(runId, false);

    // Selection-discipline disclosure, recomputed flag-only: a resume can never
    // re-pick, so the hard gate is off here by construction even when configured.
    const quota = selectionQuotaFrom(universe?.settings, plan.candidates.length);
    const selection = applySelectionQuota(plan.candidates, universe?.pool, { ...quota, hardGate: false });

    const extraGaps = [...selection.flags];
    if (plan.staleWeeks.length > 0) {
      extraGaps.push(
        `This run was resumed after the week it started: ${plan.banked.size} of its ${plan.total} lens cells date from ${plan.staleWeeks.join(", ")}, while the rest were run in ${isoWeekKey()}. Figures across the cohort are not all as of the same date.`,
      );
    }

    const discovery: DiscoveryResult = {
      marketContext:
        getRunMarketContext(runId) ??
        "This run was resumed after an interruption; the market framing from its discovery stage is unavailable, so judge the cohort on the lens evidence alone.",
      candidates: plan.candidates,
    };

    await analyzeAndCompile(runId, plan.run.params, discovery, watchdog, cost, {
      universe,
      extraGaps,
      banked: plan.banked,
    });
  } catch (err) {
    persistRunFailure(runId, err, cost);
  } finally {
    clearTimeout(timer);
  }
}
