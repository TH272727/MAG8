import { CONFIG } from "../config";
import { finishRun, getRecentCoverage, insertCandidates, insertRankings, setRunStage } from "../db";
import { priceCheckEnabled, priceSanityFlags, type PriceCheckInput } from "../price-sanity";
import { LENS_SKILLS, cellKey, type CellKey, type DiscoveryCandidate, type RunParams } from "../schemas";
import { runAnalysisMatrix, type CellOutcome } from "./analysis";
import { runCompiler } from "./compiler";
import { runDiscovery } from "./discovery";
import { executeMockRun } from "./mock";
import { emitProgress, nowIso } from "./progress";

const round2 = (x: number) => Math.round(x * 100) / 100;

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
 * Executes one full run. NEVER rejects: every failure path lands in the DB and
 * the event log (an escaped rejection would kill the Node process).
 */
export async function executeRun(runId: string, params: RunParams): Promise<void> {
  if (params.mock) {
    return executeMockRun(runId, params);
  }

  const watchdog = new AbortController();
  const timer = setTimeout(
    () => watchdog.abort(new Error(`Run watchdog: exceeded ${Math.round(CONFIG.timeoutsMs.run / 60_000)} minutes`)),
    CONFIG.timeoutsMs.run,
  );
  let totalCost = 0;

  try {
    setRunStage(runId, "discovery");
    emitProgress(runId, { type: "stage_start", stage: "discovery", at: nowIso() });
    const { discovery, costUsd: discoveryCost } = await runDiscovery(runId, params.count, watchdog.signal, {
      coverage: getRecentCoverage(5),
      modifier: params.modifier,
    });
    totalCost += discoveryCost;
    insertCandidates(runId, discovery.candidates);
    emitProgress(runId, {
      type: "discovery_complete",
      marketContext: discovery.marketContext,
      candidates: discovery.candidates,
      at: nowIso(),
    });

    setRunStage(runId, "analysis");
    emitProgress(runId, { type: "stage_start", stage: "analysis", at: nowIso() });
    const { cells, costUsd: analysisCost } = await runAnalysisMatrix(runId, discovery.candidates, {
      force: params.force,
      signal: watchdog.signal,
      // Plan-limit / auth failures hit every subsequent call too — abort the run
      // instead of cascading the same error through the whole matrix + compile.
      onFatal: (reason) => {
        if (!watchdog.signal.aborted) {
          watchdog.abort(
            new Error(
              `${reason} — run aborted early. Completed lens cells are cached for this ISO week; re-running later only re-does the unfinished ones.`,
            ),
          );
        }
      },
    });
    totalCost += analysisCost;

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
    const priceFlags = await runPriceSanity(runId, discovery.candidates, cells);
    const { report, costUsd: compileCost } = await runCompiler(runId, discovery, cells, watchdog.signal, {
      modifier: params.modifier,
      extraGaps: priceFlags,
    });
    totalCost += compileCost;

    insertRankings(runId, report.rankings);
    finishRun(runId, { status: "complete", report, totalCostUsd: round2(totalCost) });
    emitProgress(runId, { type: "run_complete", report, totalCostUsd: round2(totalCost), at: nowIso() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      finishRun(runId, { status: "error", error: message, totalCostUsd: round2(totalCost) });
      emitProgress(runId, { type: "run_error", error: message, at: nowIso() });
    } catch (persistErr) {
      console.error(`[mag8] failed to persist run error for ${runId}:`, persistErr, "original:", message);
    }
  } finally {
    clearTimeout(timer);
  }
}
