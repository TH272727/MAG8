import { CONFIG } from "../config";
import { finalizeRankings, type VerifyContext } from "../ranking";
import {
  CompilerWireSchema,
  LENS_SKILLS,
  cellKey,
  type CellKey,
  type CompiledReport,
  type DiscoveryResult,
  type LensSkill,
  type MetricValue,
  type Verdict,
} from "../schemas";
import { LENS_TO_PUBLIC, PUBLIC_LENS_LABEL, sanitizeError } from "../public-view";
import { runAgentWithContract } from "./agent";
import type { CellOutcome } from "./analysis";
import { compilerPrompt } from "./prompts";
import { emitProgress, nowIso } from "./progress";

/**
 * Stage 3: compile the ranked leaderboard. The compiler judges sub-scores;
 * finalizeRankings re-derives gate/confluence/score arithmetic deterministically.
 * fullAnalysisMarkdown never enters the prompt (display-only bulk).
 */
export async function runCompiler(
  runId: string,
  discovery: DiscoveryResult,
  cells: Map<CellKey, CellOutcome>,
  signal: AbortSignal,
  modifier?: string,
): Promise<{ report: CompiledReport; costUsd: number }> {
  const { candidates } = discovery;

  emitProgress(runId, {
    type: "compile_activity",
    activity: `Assembling lens data for ${candidates.length} candidates…`,
    at: nowIso(),
  });

  // Reports are persisted, publishable artifacts — public lens vocabulary and
  // sanitized error text are applied HERE at generation, not at the boundary.
  const lensData: Record<string, Record<string, unknown>> = {};
  const gaps: string[] = [];
  for (const c of candidates) {
    const perLens: Record<string, unknown> = {};
    for (const skill of LENS_SKILLS) {
      const cell = cells.get(cellKey(c.ticker, skill));
      if (cell?.ok && cell.analysis) {
        const { fullAnalysisMarkdown: _md, ticker: _t, skill: _s, ...wire } = cell.analysis;
        perLens[LENS_TO_PUBLIC[skill]] = wire;
      } else {
        const why = cell?.error ? sanitizeError(cell.error) : "cell not run";
        perLens[LENS_TO_PUBLIC[skill]] = `MISSING (${why})`;
        gaps.push(`${c.ticker} × ${PUBLIC_LENS_LABEL(skill)}: ${why}`);
      }
    }
    lensData[c.ticker] = perLens;
  }

  emitProgress(runId, {
    type: "compile_activity",
    activity: "Scoring candidates against the Trillion-Dollar Confluence rubric…",
    at: nowIso(),
  });

  const { data: wire, costUsd } = await runAgentWithContract(CompilerWireSchema, {
    prompt: compilerPrompt({ marketContext: discovery.marketContext, candidates, lensData, gaps, modifier }),
    model: CONFIG.models.compiler,
    allowedTools: [],
    maxTurns: CONFIG.maxTurns.compile,
    timeoutMs: CONFIG.timeoutsMs.compile,
    effort: CONFIG.effort.compiler,
    thinking: CONFIG.thinking.compiler,
    maxBudgetUsd: CONFIG.maxBudgetUsd.compile,
    signal,
    label: "compiler",
  });

  emitProgress(runId, {
    type: "compile_activity",
    activity: "Verifying gate and score arithmetic…",
    at: nowIso(),
  });

  const ctx: VerifyContext = {
    lensVerdicts: new Map(),
    scannerMetrics: new Map(),
    candidateTickers: candidates.map((c) => c.ticker),
  };
  for (const c of candidates) {
    const verdicts: Partial<Record<LensSkill, Verdict>> = {};
    for (const skill of LENS_SKILLS) {
      const cell = cells.get(cellKey(c.ticker, skill));
      if (cell?.ok && cell.analysis) verdicts[skill] = cell.analysis.verdict;
    }
    ctx.lensVerdicts.set(c.ticker, verdicts);
    const scanner = cells.get(cellKey(c.ticker, "stock-scanner"));
    if (scanner?.ok && scanner.analysis) {
      ctx.scannerMetrics.set(c.ticker, scanner.analysis.keyMetrics as Record<string, MetricValue>);
    }
  }

  const { rankings, notes } = finalizeRankings(wire.rankings, ctx);

  const report: CompiledReport = {
    runId,
    generatedAt: nowIso(),
    marketOverview: wire.marketOverview,
    methodologyNote: wire.methodologyNote,
    gapsNoted: [...new Set([...wire.gapsNoted, ...notes])],
    rankings,
  };
  return { report, costUsd };
}
