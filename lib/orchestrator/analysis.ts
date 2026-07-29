import { CONFIG } from "../config";
import { getCachedLens, insertLensCachedCopy, insertLensResult, isoWeekKey } from "../db";
import {
  LENS_SKILLS,
  cellKey,
  lensHeadline,
  lensWireNoMarkdownSchema,
  type CellKey,
  type DiscoveryCandidate,
  type LensAnalysis,
  type LensSkill,
  type LensStatusEvent,
} from "../schemas";
import { PUBLIC_LENS_LABEL } from "../public-view";
import { lensGroundTruth, type UniverseResult } from "../universe";
import { ContractError, runAgentWithContract } from "./agent";
import { createLimiter } from "./limit";
import { lensPrompt } from "./prompts";
import { emitProgress, nowIso } from "./progress";

export interface CellOutcome {
  ok: boolean;
  analysis?: LensAnalysis;
  error?: string;
  cached: boolean;
  costUsd: number;
  /** Deterministic grounding cautions (public-label vocabulary) — merged into the report's gap notes. */
  flags?: string[];
}

/** Occurrences of http(s) links in a write-up — the deterministic sourcing signal. */
export function countSourceLinks(markdown: string): number {
  return markdown.match(/https?:\/\//g)?.length ?? 0;
}

const MIN_SOURCE_LINKS = 3;

/** A write-up citing almost no sources earns a caution flag; applies to cached cells too. */
export function groundingFlags(ticker: string, skill: LensSkill, analysis: LensAnalysis): string[] | undefined {
  const n = countSourceLinks(analysis.fullAnalysisMarkdown);
  if (n >= MIN_SOURCE_LINKS) return undefined;
  return [
    `${ticker} × ${PUBLIC_LENS_LABEL(skill)}: only ${n} source link${n === 1 ? "" : "s"} in the write-up — treat its figures with caution.`,
  ];
}

/**
 * Errors that will hit EVERY subsequent agent call too (plan usage exhausted,
 * auth broken) — burning through the remaining matrix is pointless and the
 * cascade buries the real cause, so these escalate to a run-level abort.
 */
const FATAL_AGENT_ERROR =
  /(hit|reached) your (session|usage|weekly|5-hour) limit|session limit|usage limit|credit balance is too low|invalid (api key|bearer token)|authentication[_ ]error|oauth token (has )?(expired|been revoked)/i;

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
 *
 * `banked` (resume only) is work this same run already did: those cells are
 * carried straight through — not re-run, not re-billed, not even queued — so a
 * resumed matrix only pays for its gaps. A candidate whose row is fully banked
 * never takes a concurrency slot.
 */
export async function runAnalysisMatrix(
  runId: string,
  candidates: DiscoveryCandidate[],
  opts: {
    force: boolean;
    signal: AbortSignal;
    onFatal?: (reason: string) => void;
    /** Stage-0 snapshot — per-ticker verified reference data for lens prompts (null: unscreened run). */
    universe?: UniverseResult | null;
    /** Cells an earlier attempt of THIS run banked — see lib/orchestrator/resume.ts. */
    banked?: Map<CellKey, CellOutcome>;
  },
): Promise<AnalysisMatrixResult> {
  const week = isoWeekKey();
  const cells = new Map<CellKey, CellOutcome>();
  let costUsd = 0;

  for (const c of candidates) {
    for (const skill of LENS_SKILLS) {
      const key = cellKey(c.ticker, skill);
      const done = opts.banked?.get(key);
      if (done?.ok && done.analysis) {
        cells.set(key, done);
        emitLens(runId, c.ticker, skill, {
          status: "done",
          verdict: done.analysis.verdict,
          confidence: done.analysis.confidence,
          headline: lensHeadline(skill, done.analysis.keyMetrics),
        });
      } else {
        emitLens(runId, c.ticker, skill, { status: "queued" });
      }
    }
  }

  const admit = createLimiter(CONFIG.maxConcurrentStocks);

  await Promise.all(
    candidates.map((candidate) => {
      const todo = LENS_SKILLS.filter((skill) => !cells.has(cellKey(candidate.ticker, skill)));
      if (todo.length === 0) return Promise.resolve();
      return admit(async () => {
        await Promise.allSettled(
          todo.map(async (skill) => {
            const outcome = await runOneCell(runId, candidate, skill, week, opts);
            cells.set(cellKey(candidate.ticker, skill), outcome);
            costUsd += outcome.costUsd;
          }),
        );
      });
    }),
  );

  return { cells, costUsd };
}

/** Runs one lens cell. Never throws — every failure becomes an error outcome. */
async function runOneCell(
  runId: string,
  candidate: DiscoveryCandidate,
  skill: LensSkill,
  week: string,
  opts: {
    force: boolean;
    signal: AbortSignal;
    onFatal?: (reason: string) => void;
    universe?: UniverseResult | null;
  },
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
        return { ok: true, analysis: hit.analysis, cached: true, costUsd: 0, flags: groundingFlags(ticker, skill, hit.analysis) };
      }
    }

    emitLens(runId, ticker, skill, { status: "running", activity: "Starting analysis…" });

    // Same-week ground truth is cache-safe: within an ISO week the snapshot is
    // frozen, so an injected prompt and a cached cell describe the same data.
    const ground = opts.universe ? lensGroundTruth(ticker, opts.universe) : null;
    const { data, costUsd, narrativeText, numTurns } = await runAgentWithContract(lensWireNoMarkdownSchema(skill), {
      prompt: lensPrompt(skill, candidate, undefined, ground),
      model: CONFIG.models.lens,
      allowedTools: ["WebSearch", "WebFetch", "Bash", "Read"],
      skills: [skill],
      maxTurns: CONFIG.maxTurns.lens,
      timeoutMs: CONFIG.timeoutsMs.lens,
      effort: CONFIG.effort.lens,
      thinking: CONFIG.thinking.lens,
      maxBudgetUsd: CONFIG.maxBudgetUsd.lens,
      signal: opts.signal,
      label,
      onActivity: (activity) => emitLens(runId, ticker, skill, { status: "running", activity }),
    });

    // The wire fence carries only compact fields; the markdown report is the
    // message itself (models corrupt 10KB+ strings inside JSON far too often).
    const analysis: LensAnalysis = { ticker, skill, ...data, fullAnalysisMarkdown: narrativeText.trim() || data.summary };
    insertLensResult({ runId, ticker, skill, isoWeek: week, status: "ok", analysis, costUsd, numTurns });
    emitLens(runId, ticker, skill, {
      status: "done",
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      headline: lensHeadline(skill, analysis.keyMetrics),
    });
    return { ok: true, analysis, cached: false, costUsd, flags: groundingFlags(ticker, skill, analysis) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Persist the WHY (zod issue report) and the cost of the failed attempts, not just the headline.
    const detail = err instanceof ContractError && err.detail ? `\n${err.detail.slice(0, 800)}` : "";
    const costUsd = err instanceof ContractError ? err.costUsd : 0;
    const stored = `${message}${detail}`;
    try {
      insertLensResult({ runId, ticker, skill, isoWeek: week, status: "error", error: stored, costUsd });
    } catch {
      // DB write failed on top of the cell failure — the event below still tells the client.
    }
    emitLens(runId, ticker, skill, { status: "error", error: message });
    if (FATAL_AGENT_ERROR.test(message)) opts.onFatal?.(message);
    return { ok: false, error: stored, cached: false, costUsd };
  }
}
