import { getCandidates, getLensRowsForRun, getRun, isoWeekKey, type RunRow } from "../db";
import { LENS_SKILLS, cellKey, type CellKey, type DiscoveryCandidate } from "../schemas";
import { groundingFlags, type CellOutcome } from "./analysis";

/* ============================================================================
 * Resume — finish a run that stopped mid-flight (plan limit, watchdog, server
 * restart) IN PLACE: same run id, same cohort, same URL, cost accumulating on
 * the row that already exists.
 *
 * Stage 1 never repeats — the cohort is persisted, so a resume can never drift
 * to a different set of names, and a run that died before delivering one has
 * nothing to carry forward (start a fresh one). Every lens cell the earlier
 * attempt banked is carried straight through, so the plan window only pays for
 * the gaps plus the compile. Nothing here spends: this module only reads state
 * and decides what is left to do.
 *
 * Distinct from the weekly lens cache: that reuses OTHER runs' cells for the
 * same ISO week; this reuses THIS run's own, whatever week they came from —
 * and says so in the report when those weeks no longer match.
 * ========================================================================== */

export type ResumeBlock = "not_found" | "run_active" | "mock_run" | "already_complete" | "no_cohort";

const BLOCK_MESSAGE: Record<ResumeBlock, string> = {
  not_found: "No run with that id.",
  run_active: "That run is still going — watch it instead of resuming it.",
  mock_run: "Demo runs have nothing to resume — trigger a fresh one.",
  already_complete: "That run already finished; there is nothing left to do.",
  no_cohort:
    "That run stopped before it delivered a cohort, so there is nothing to carry forward — start a fresh run instead.",
};

export interface ResumePlan {
  run: RunRow;
  /** The cohort the run already delivered — fixed; a resume never re-picks. */
  candidates: DiscoveryCandidate[];
  /** Cells this run already banked: carried through untouched, never re-billed. */
  banked: Map<CellKey, CellOutcome>;
  /** Cells in the full matrix (cohort × lenses). */
  total: number;
  /** Cells still to run. Zero is valid — the run got through the matrix and died compiling. */
  remaining: number;
  /** ISO week the run STARTED in — the week whose screen and market framing picked this cohort. */
  runWeek: string;
  /** ISO weeks the banked cells came from, excluding the current one (disclosed in the report). */
  staleWeeks: string[];
}

export type ResumeCheck =
  | { ok: true; plan: ResumePlan }
  | { ok: false; code: ResumeBlock; error: string };

const blocked = (code: ResumeBlock): ResumeCheck => ({ ok: false, code, error: BLOCK_MESSAGE[code] });

/**
 * What finishing this run would take — the single source of truth for both the
 * "can this be resumed?" question (admin desk, API) and the work itself.
 * Read-only and cheap enough to call on a page render.
 */
export function planResume(runId: string): ResumeCheck {
  const run = getRun(runId);
  if (!run) return blocked("not_found");
  if (run.status === "pending" || run.status === "running") return blocked("run_active");
  if (run.params.mock) return blocked("mock_run");
  if (run.status === "complete") return blocked("already_complete");

  const candidates = getCandidates(runId);
  if (candidates.length === 0) return blocked("no_cohort");

  const inCohort = new Set(candidates.map((c) => c.ticker));
  const banked = new Map<CellKey, CellOutcome>();
  const weeks = new Set<string>();
  for (const row of getLensRowsForRun(runId)) {
    if (row.status !== "ok" || !row.analysis || !inCohort.has(row.ticker)) continue;
    banked.set(cellKey(row.ticker, row.skill), {
      ok: true,
      analysis: row.analysis,
      cached: row.cachedFromId !== null,
      // Already inside the run's persisted total — counting it again would double-bill the row.
      costUsd: 0,
      flags: groundingFlags(row.ticker, row.skill, row.analysis),
    });
    weeks.add(row.isoWeek);
  }

  const total = candidates.length * LENS_SKILLS.length;
  const thisWeek = isoWeekKey();
  return {
    ok: true,
    plan: {
      run,
      candidates,
      banked,
      total,
      remaining: total - banked.size,
      runWeek: isoWeekKey(new Date(run.createdAt)),
      staleWeeks: [...weeks].filter((w) => w !== thisWeek).sort(),
    },
  };
}
