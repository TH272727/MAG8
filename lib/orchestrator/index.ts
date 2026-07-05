import { CONFIG } from "../config";
import { finishRun, getRecentCoverage, insertCandidates, insertRankings, setRunStage } from "../db";
import { LENS_SKILLS, type RunParams } from "../schemas";
import { runAnalysisMatrix } from "./analysis";
import { runCompiler } from "./compiler";
import { runDiscovery } from "./discovery";
import { executeMockRun } from "./mock";
import { emitProgress, nowIso } from "./progress";

const round2 = (x: number) => Math.round(x * 100) / 100;

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
    const { report, costUsd: compileCost } = await runCompiler(runId, discovery, cells, watchdog.signal, params.modifier);
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
