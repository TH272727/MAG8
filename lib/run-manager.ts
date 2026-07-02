import crypto from "node:crypto";
import { createRun, finishRun, getActiveRun } from "./db";
import { executeRun } from "./orchestrator";
import { emitProgress, nowIso } from "./orchestrator/progress";
import type { RunParams } from "./schemas";

/* ============================================================================
 * Single-active-run manager. globalThis-cached (dev-HMR-safe). POST returns
 * immediately; executeRun runs detached with a last-resort catch so an escaped
 * rejection can never kill the process.
 * ========================================================================== */

interface RunManagerState {
  activeRunId: string | null;
}

type GlobalWithRm = typeof globalThis & { __mag8_rm?: RunManagerState };

function state(): RunManagerState {
  const g = globalThis as GlobalWithRm;
  if (!g.__mag8_rm) g.__mag8_rm = { activeRunId: null };
  return g.__mag8_rm;
}

export type StartRunResult =
  | { ok: true; runId: string }
  | { ok: false; code: "active_run"; activeRunId: string };

export function startRun(params: RunParams): StartRunResult {
  const s = state();
  if (s.activeRunId) {
    return { ok: false, code: "active_run", activeRunId: s.activeRunId };
  }
  // Belt-and-braces: DB check (stale rows are reconciled at boot, so a hit here is live).
  const dbActive = getActiveRun();
  if (dbActive) {
    return { ok: false, code: "active_run", activeRunId: dbActive.id };
  }

  const runId = crypto.randomUUID();
  createRun(runId, params);
  s.activeRunId = runId;

  void executeRun(runId, params)
    .catch((err: unknown) => {
      // executeRun catches internally; this is the absolute last resort.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mag8] executeRun escaped for ${runId}:`, err);
      try {
        finishRun(runId, { status: "error", error: message });
        emitProgress(runId, { type: "run_error", error: message, at: nowIso() });
      } catch {
        /* nothing left to do */
      }
    })
    .finally(() => {
      if (s.activeRunId === runId) s.activeRunId = null;
    });

  return { ok: true, runId };
}

export function getActiveRunId(): string | null {
  return state().activeRunId ?? getActiveRun()?.id ?? null;
}
