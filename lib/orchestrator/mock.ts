import { CONFIG } from "../config";
import {
  finishRun,
  getCachedLens,
  insertCandidates,
  insertLensCachedCopy,
  insertLensResult,
  insertRankings,
  setRunStage,
} from "../db";
import {
  FIXTURE_DISCOVERY_ACTIVITIES,
  FIXTURE_MARKET_CONTEXT,
  FIXTURE_SEEDS,
  buildFixtureReport,
  demoWeekKey,
  fixtureCandidates,
  fixtureCellActivities,
  fixtureCellCost,
  fixtureLensAnalysis,
} from "../fixtures";
import {
  LENS_SKILLS,
  cellKey,
  lensHeadline,
  type CellKey,
  type LensSkill,
  type LensStatusEvent,
  type RunParams,
} from "../schemas";
import { createLimiter } from "./limit";
import { emitProgress, nowIso } from "./progress";

/* ============================================================================
 * Scripted mock run: realistic timed events through the SAME persist+emit path
 * as the real pipeline, zero API spend. Dev-only trigger.
 *
 * Fixture/mock lens rows are stored under demoWeekKey() (iso week + "-demo"),
 * so seeded demo data can never satisfy a REAL run's cache lookup.
 * ========================================================================== */

const jitter = (base: number) => base * (0.7 + Math.random() * 0.6);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(10, ms * CONFIG.mockSpeed)));

function emitLens(
  runId: string,
  ticker: string,
  skill: LensSkill,
  partial: Omit<LensStatusEvent, "type" | "ticker" | "skill" | "at">,
): void {
  emitProgress(runId, { type: "lens_status", ticker, skill, at: nowIso(), ...partial });
}

export async function executeMockRun(runId: string, params: RunParams): Promise<void> {
  const count = Math.min(params.count, FIXTURE_SEEDS.length);
  const week = demoWeekKey();

  try {
    // --- Stage 1: discovery -------------------------------------------------
    setRunStage(runId, "discovery");
    emitProgress(runId, { type: "stage_start", stage: "discovery", at: nowIso() });
    for (const activity of FIXTURE_DISCOVERY_ACTIVITIES) {
      await sleep(jitter(750));
      emitProgress(runId, { type: "discovery_activity", activity, at: nowIso() });
    }
    await sleep(jitter(900));
    const candidates = fixtureCandidates(count);
    insertCandidates(runId, candidates);
    emitProgress(runId, {
      type: "discovery_complete",
      marketContext: FIXTURE_MARKET_CONTEXT,
      candidates,
      at: nowIso(),
    });

    // --- Stage 2: analysis matrix -------------------------------------------
    setRunStage(runId, "analysis");
    emitProgress(runId, { type: "stage_start", stage: "analysis", at: nowIso() });
    for (const c of candidates) {
      for (const skill of LENS_SKILLS) emitLens(runId, c.ticker, skill, { status: "queued" });
    }

    // One deterministic error cell (exercises the gap path) when the cohort is big enough.
    const errorCell: CellKey | null = count >= 6 ? cellKey(FIXTURE_SEEDS[5].ticker, "gt-predictor") : null;
    const missing: CellKey[] = errorCell ? [errorCell] : [];

    const admit = createLimiter(CONFIG.maxConcurrentStocks);
    let cellIndex = 0;

    await Promise.all(
      candidates.map((candidate, ci) =>
        admit(async () => {
          await Promise.allSettled(
            LENS_SKILLS.map(async (skill, si) => {
              const seed = FIXTURE_SEEDS[ci];
              const key = cellKey(candidate.ticker, skill);
              const myIndex = cellIndex++;

              // Simulated cache hit path — real lookup against demo-week rows
              // (hits when the fixture has been seeded or a mock ran before).
              if (ci === 0 && skill === "institutional-forecast") {
                const hit = getCachedLens(candidate.ticker, skill, week);
                if (hit?.analysis) {
                  await sleep(jitter(400));
                  insertLensCachedCopy(runId, hit);
                  emitLens(runId, candidate.ticker, skill, {
                    status: "done",
                    cached: true,
                    verdict: hit.analysis.verdict,
                    confidence: hit.analysis.confidence,
                    headline: lensHeadline(skill, hit.analysis.keyMetrics),
                  });
                  return;
                }
              }

              await sleep(jitter(600 + si * 350));
              emitLens(runId, candidate.ticker, skill, { status: "running", activity: "Starting analysis…" });
              for (const activity of fixtureCellActivities(skill, candidate.ticker)) {
                await sleep(jitter(650));
                emitLens(runId, candidate.ticker, skill, { status: "running", activity });
              }
              await sleep(jitter(500));

              if (errorCell === key) {
                const message = "Mock: simulated lens timeout (demonstrates the error-cell path).";
                insertLensResult({ runId, ticker: candidate.ticker, skill, isoWeek: week, status: "error", error: message });
                emitLens(runId, candidate.ticker, skill, { status: "error", error: message });
                return;
              }

              const analysis = fixtureLensAnalysis(seed, skill);
              insertLensResult({
                runId,
                ticker: candidate.ticker,
                skill,
                isoWeek: week,
                status: "ok",
                analysis,
                costUsd: fixtureCellCost(myIndex),
              });
              emitLens(runId, candidate.ticker, skill, {
                status: "done",
                verdict: analysis.verdict,
                confidence: analysis.confidence,
                headline: lensHeadline(skill, analysis.keyMetrics),
              });
            }),
          );
        }),
      ),
    );

    // --- Stage 3: compile ----------------------------------------------------
    setRunStage(runId, "compile");
    emitProgress(runId, { type: "stage_start", stage: "compile", at: nowIso() });
    emitProgress(runId, {
      type: "compile_activity",
      activity: `Scoring ${count} candidates against the confluence rubric…`,
      at: nowIso(),
    });
    await sleep(jitter(2500));
    emitProgress(runId, { type: "compile_activity", activity: "Verifying gate and score arithmetic…", at: nowIso() });
    await sleep(jitter(1500));

    const report = buildFixtureReport({ runId, generatedAt: nowIso(), count, missing });
    const totalCostUsd = 0; // mock runs spend nothing; honest cost reporting
    insertRankings(runId, report.rankings);
    finishRun(runId, { status: "complete", report, totalCostUsd });
    emitProgress(runId, { type: "run_complete", report, totalCostUsd, at: nowIso() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      finishRun(runId, { status: "error", error: message });
      emitProgress(runId, { type: "run_error", error: message, at: nowIso() });
    } catch (persistErr) {
      console.error(`[mag8] failed to persist mock-run error for ${runId}:`, persistErr, "original:", message);
    }
  }
}
