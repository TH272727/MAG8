import { CONFIG } from "../config";
import { getCachedLens, insertLensCachedCopy, insertLensResult, isoWeekKey } from "../db";
import {
  LENS_SKILLS,
  cellKey,
  lensHeadline,
  lensWireSchema,
  type CellKey,
  type DiscoveryCandidate,
  type LensAnalysis,
  type LensSkill,
  type LensStatusEvent,
} from "../schemas";
import { runAgentWithContract } from "./agent";
import { createLimiter } from "./limit";
import { lensPrompt } from "./prompts";
import { emitProgress, nowIso } from "./progress";

export interface CellOutcome {
  ok: boolean;
  analysis?: LensAnalysis;
  error?: string;
  cached: boolean;
  costUsd: number;
}

export interface AnalysisMatrixResult {
  cells: Map<CellKey, CellOutcome>;
  costUsd: number;
}

function emitLens(
  runId: string,
  ticker: string,
  skill: LensSkill,
  partial: Omit<LensStatusEvent, "type" | "ticker" | "skill" | "at">,
): void {
  emitProgress(runId, { type: "lens_status", ticker, skill, at: nowIso(), ...partial });
}

/**
 * Stage 2: 3×N lens matrix. Concurrency is gated PER CANDIDATE at
 * maxConcurrentStocks; each admitted candidate fans out its 3 lens calls, so
 * at most 3×maxConcurrentStocks SDK sessions run at once by construction.
 * A cell failure never fails the run — it becomes an error cell.
 */
export async function runAnalysisMatrix(
  runId: string,
  candidates: DiscoveryCandidate[],
  opts: { force: boolean; signal: AbortSignal },
): Promise<AnalysisMatrixResult> {
  const week = isoWeekKey();
  const cells = new Map<CellKey, CellOutcome>();
  let costUsd = 0;

  for (const c of candidates) {
    for (const skill of LENS_SKILLS) {
      emitLens(runId, c.ticker, skill, { status: "queued" });
    }
  }

  const admit = createLimiter(CONFIG.maxConcurrentStocks);

  await Promise.all(
    candidates.map((candidate) =>
      admit(async () => {
        await Promise.allSettled(
          LENS_SKILLS.map(async (skill) => {
            const outcome = await runOneCell(runId, candidate, skill, week, opts);
            cells.set(cellKey(candidate.ticker, skill), outcome);
            costUsd += outcome.costUsd;
          }),
        );
      }),
    ),
  );

  return { cells, costUsd };
}

/** Runs one lens cell. Never throws — every failure becomes an error outcome. */
async function runOneCell(
  runId: string,
  candidate: DiscoveryCandidate,
  skill: LensSkill,
  week: string,
  opts: { force: boolean; signal: AbortSignal },
): Promise<CellOutcome> {
  const { ticker } = candidate;
  const label = `lens:${ticker}:${skill}`;

  try {
    if (!opts.force) {
      const hit = getCachedLens(ticker, skill, week);
      if (hit?.analysis) {
        insertLensCachedCopy(runId, hit);
        emitLens(runId, ticker, skill, {
          status: "done",
          cached: true,
          verdict: hit.analysis.verdict,
          confidence: hit.analysis.confidence,
          headline: lensHeadline(skill, hit.analysis.keyMetrics),
        });
        return { ok: true, analysis: hit.analysis, cached: true, costUsd: 0 };
      }
    }

    emitLens(runId, ticker, skill, { status: "running", activity: "Starting analysis…" });

    const { data, costUsd } = await runAgentWithContract(lensWireSchema(skill), {
      prompt: lensPrompt(skill, candidate),
      model: CONFIG.models.lens,
      allowedTools: ["WebSearch", "WebFetch", "Bash", "Read"],
      skills: [skill],
      maxTurns: CONFIG.maxTurns.lens,
      timeoutMs: CONFIG.timeoutsMs.lens,
      signal: opts.signal,
      label,
      onActivity: (activity) => emitLens(runId, ticker, skill, { status: "running", activity }),
    });

    const analysis: LensAnalysis = { ticker, skill, ...data };
    insertLensResult({ runId, ticker, skill, isoWeek: week, status: "ok", analysis, costUsd });
    emitLens(runId, ticker, skill, {
      status: "done",
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      headline: lensHeadline(skill, analysis.keyMetrics),
    });
    return { ok: true, analysis, cached: false, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      insertLensResult({ runId, ticker, skill, isoWeek: week, status: "error", error: message });
    } catch {
      // DB write failed on top of the cell failure — the event below still tells the client.
    }
    emitLens(runId, ticker, skill, { status: "error", error: message });
    return { ok: false, error: message, cached: false, costUsd: 0 };
  }
}
