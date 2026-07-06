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

/** >20% disagreement between two lenses' own spot prices is a data-quality signal, not noise. */
const CROSS_LENS_DIVERGENCE_THRESHOLD = 0.2;

function numericMetric(cell: CellOutcome | undefined, key: string): number | null {
  if (!cell?.ok || !cell.analysis) return null;
  const v = cell.analysis.keyMetrics[key];
  return typeof v === "number" && v > 0 ? v : null;
}

/**
 * Cross-lens grounding check: the fundamentals and street-consensus lenses each
 * report the spot price their analysis used, same week. Honest live data agrees
 * to within noise; a large gap means at least one figure is stale or invented.
 */
function crossLensPriceFlag(ticker: string, cells: Map<CellKey, CellOutcome>): string | null {
  const spot = numericMetric(cells.get(cellKey(ticker, "stock-scanner")), "spotPrice");
  const current = numericMetric(cells.get(cellKey(ticker, "institutional-forecast")), "currentPrice");
  if (spot === null || current === null) return null;
  const divergence = Math.abs(spot - current) / current;
  if (divergence <= CROSS_LENS_DIVERGENCE_THRESHOLD) return null;
  return `${ticker}: the ${PUBLIC_LENS_LABEL("stock-scanner")} and ${PUBLIC_LENS_LABEL("institutional-forecast")} lenses anchored on different spot prices — $${spot.toFixed(2)} vs $${current.toFixed(2)} (${Math.round(divergence * 100)}% apart). At least one figure is likely stale; treat valuation numbers with caution.`;
}

export interface CompileOptions {
  /** Sanitized operator focus directive this run carried, if any. */
  modifier?: string;
  /** Run-level deterministic check flags (e.g. external price sanity) — join the gap notes. */
  extraGaps?: string[];
}

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
  opts: CompileOptions = {},
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
  // Deterministic grounding cautions (thin sourcing, price divergence). They go
  // to the compiler as known gaps AND into the final report unconditionally —
  // the compiler weighing them is optional, disclosing them is not.
  const checkFlags: string[] = [];
  for (const c of candidates) {
    const perLens: Record<string, unknown> = {};
    for (const skill of LENS_SKILLS) {
      const cell = cells.get(cellKey(c.ticker, skill));
      if (cell?.ok && cell.analysis) {
        const { fullAnalysisMarkdown: _md, ticker: _t, skill: _s, ...wire } = cell.analysis;
        // Roster-style arrays (players, institutions) are display data — they
        // inform no sub-score and only bloat the compiler prompt. Scenario and
        // horizon numbers stay: they sharpen the scoring judgment.
        const { players: _players, institutions: _institutions, ...keyMetrics } = wire.keyMetrics;
        perLens[LENS_TO_PUBLIC[skill]] = { ...wire, keyMetrics };
      } else {
        const why = cell?.error ? sanitizeError(cell.error) : "cell not run";
        perLens[LENS_TO_PUBLIC[skill]] = `MISSING (${why})`;
        gaps.push(`${c.ticker} × ${PUBLIC_LENS_LABEL(skill)}: ${why}`);
      }
      if (cell?.flags?.length) checkFlags.push(...cell.flags);
    }
    const priceFlag = crossLensPriceFlag(c.ticker, cells);
    if (priceFlag) checkFlags.push(priceFlag);
    lensData[c.ticker] = perLens;
  }
  checkFlags.push(...(opts.extraGaps ?? []));

  emitProgress(runId, {
    type: "compile_activity",
    activity: "Scoring candidates against the Trillion-Dollar Confluence rubric…",
    at: nowIso(),
  });

  const { data: wire, costUsd } = await runAgentWithContract(CompilerWireSchema, {
    prompt: compilerPrompt({
      marketContext: discovery.marketContext,
      candidates,
      lensData,
      gaps: [...gaps, ...checkFlags],
      modifier: opts.modifier,
    }),
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
    gapsNoted: [...new Set([...wire.gapsNoted, ...notes, ...checkFlags])],
    rankings,
  };
  return { report, costUsd };
}
