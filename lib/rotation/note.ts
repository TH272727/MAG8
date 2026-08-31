import { getRotationBrief, latestRotationBrief, saveRotationBrief, type RotationBriefRow } from "../db";
import { rotationSettings } from "../rotation-settings";
import type { Board } from "./board";
import { allowedNumbers, briefPrompt, templateBrief, verifyBriefNumbers, type BriefChange } from "./brief";
import { stateHash } from "./state";
import { TIER_META } from "./score";

/* ============================================================================
 * Wiring the written note to the board.
 *
 * Split deliberately in two so that reading the board never costs anything:
 *
 *   noteForBoard()  pure-ish and free. Serves the cached note for the current
 *                   state, or writes the deterministic one on the spot, or
 *                   falls back to the last note on record. Called on every page
 *                   render. Never writes, never reaches the network.
 *   ensureNote()    the writing half. Called only from the admin refresh, and
 *                   the only path on which a model can ever be reached.
 *
 * That split is what makes "the model is called once per confirmed state
 * change, never per page load" a property of the code rather than a promise.
 * ========================================================================== */

/** Which settings a note depends on. Retuning any of these invalidates it. */
function briefSettingsFingerprint(): Record<string, number | boolean> {
  const s = rotationSettings();
  return {
    trendFullPct: s.trendFullPct,
    trendUnconfirmedFactor: s.trendUnconfirmedFactor,
    zScale: s.zScale,
    rsiDivisor: s.rsiDivisor,
    zWindowDays: s.zWindowDays,
    percentileWindowDays: s.percentileWindowDays,
    weightTrend: s.weightTrend,
    weightStretch: s.weightStretch,
    weightMomentum: s.weightMomentum,
    weightPercentile: s.weightPercentile,
    directionDeadbandPct: s.directionDeadbandPct,
    strongTierMin: s.strongTierMin,
    buildingTierMin: s.buildingTierMin,
    neutralTierMin: s.neutralTierMin,
  };
}

/**
 * The changes a note should cover, highest-scoring first and capped.
 *
 * A session on which most of the board changes at once is more often a data
 * problem than a market event, and an uncapped note would turn that into an
 * unreadable wall of text.
 */
export function briefItems(board: Board): BriefChange[] {
  const readings = new Map(board.readings.map((r) => [r.id, r]));
  const items: BriefChange[] = [];
  for (const change of board.changesToday) {
    const reading = readings.get(change.indicatorId);
    // A reading barred from raising a signal cannot contribute to a note either.
    if (!reading || !reading.signalEligible) continue;
    items.push({ change, reading });
  }
  items.sort((a, b) => {
    const rank = TIER_META[b.change.to.tier].rank - TIER_META[a.change.to.tier].rank;
    if (rank !== 0) return rank;
    return (b.reading.score ?? 0) - (a.reading.score ?? 0);
  });
  return items.slice(0, rotationSettings().briefMaxIndicators);
}

export function briefHash(board: Board): string | null {
  if (!board.asOf) return null;
  return stateHash({
    asOf: board.asOf,
    changes: briefItems(board).map((i) => i.change),
    settings: briefSettingsFingerprint(),
  });
}

export interface NoteView {
  body: string;
  origin: RotationBriefRow["origin"];
  asOf: string;
  createdAt: string | null;
  /** True when the note describes the CURRENT state; false when it is the last on record. */
  current: boolean;
}

/**
 * The note to show. Free, and never reaches the network:
 *   a cached note for exactly this state, else the deterministic one written on
 *   the spot, else the most recent note on record, labelled as historic.
 */
export function noteForBoard(board: Board): NoteView | null {
  const items = briefItems(board);
  if (board.asOf && items.length > 0) {
    const hash = briefHash(board)!;
    const cached = getRotationBrief(hash);
    if (cached) {
      return {
        body: cached.body,
        origin: cached.origin,
        asOf: cached.asOf,
        createdAt: cached.createdAt,
        current: true,
      };
    }
    return {
      body: templateBrief(items, board.asOf),
      origin: "template",
      asOf: board.asOf,
      createdAt: null,
      current: true,
    };
  }
  const last = latestRotationBrief();
  if (!last) return null;
  return { body: last.body, origin: last.origin, asOf: last.asOf, createdAt: last.createdAt, current: false };
}

export interface EnsureNoteResult {
  written: boolean;
  origin: RotationBriefRow["origin"] | null;
  /** Set when a model note was produced but refused, and why. */
  rejected?: string;
  costUsd: number;
  message: string;
}

/**
 * Write the note for the current state, if there is one to write.
 *
 * The model half is reached only when the operator has switched it on AND an
 * indicator has actually changed state AND no note for this exact state is
 * already cached. Every changed indicator goes into ONE request. A returned
 * note containing a figure that cannot be traced back to an input is discarded
 * whole and the deterministic note is stored instead — so the worst case of
 * turning the model on is that nothing changes.
 */
export async function ensureNote(board: Board): Promise<EnsureNoteResult> {
  const nothing = (message: string): EnsureNoteResult => ({
    written: false,
    origin: null,
    costUsd: 0,
    message,
  });
  if (!board.asOf) return nothing("No board to write about.");

  const items = briefItems(board);
  if (items.length === 0) return nothing("No indicator changed state, so no note was written.");

  const hash = briefHash(board)!;
  const cached = getRotationBrief(hash);
  if (cached) {
    return {
      written: false,
      origin: cached.origin,
      costUsd: 0,
      message: "A note for this exact state already exists, so nothing was regenerated.",
    };
  }

  const fallback = templateBrief(items, board.asOf);
  const settings = rotationSettings();
  let body = fallback;
  let origin: RotationBriefRow["origin"] = "template";
  let rejected: string | undefined;
  let costUsd = 0;

  if (settings.briefModelEnabled) {
    try {
      // Imported here, not at module load: the page path must never pull in the
      // research engine just to render a deterministic note.
      const { runAgentWithContract } = await import("../orchestrator/agent");
      const { sanitizeMarkdown } = await import("../public-view");
      const { CONFIG } = await import("../config");
      const { z } = await import("zod");

      const result = await runAgentWithContract(
        z.object({ indicatorsCovered: z.number().int().nonnegative().catch(0) }),
        {
          prompt: briefPrompt(items, board.asOf),
          model: CONFIG.rotation.model,
          allowedTools: [],
          maxTurns: CONFIG.rotation.maxTurns,
          timeoutMs: CONFIG.rotation.timeoutMs,
          effort: CONFIG.rotation.effort,
          thinking: CONFIG.rotation.thinking,
          maxBudgetUsd: CONFIG.rotation.maxBudgetUsd,
          label: "rotation-brief",
        },
      );
      costUsd = result.costUsd;
      const written = sanitizeMarkdown(result.narrativeText.trim());
      if (written.length < 40) {
        rejected = "the note came back empty";
      } else {
        const check = verifyBriefNumbers(written, allowedNumbers(items, board.asOf));
        if (check.ok) {
          body = written;
          origin = "model";
        } else {
          rejected = `it contained ${check.offenders.length} figure(s) that were never computed: ${check.offenders
            .slice(0, 5)
            .join(", ")}`;
        }
      }
    } catch (err) {
      rejected = err instanceof Error ? err.message : "the request did not complete";
    }
  }

  saveRotationBrief({
    stateHash: hash,
    origin,
    asOf: board.asOf,
    changed: items.map((i) => i.change.indicatorId),
    body,
  });

  const covered = `${items.length} changed indicator${items.length === 1 ? "" : "s"}`;
  return {
    written: true,
    origin,
    rejected,
    costUsd,
    message: rejected
      ? `Wrote the deterministic note covering ${covered}. The model note was discarded because ${rejected}.`
      : origin === "model"
        ? `Wrote a model note covering ${covered}; every figure in it traces back to the computed inputs.`
        : `Wrote the deterministic note covering ${covered}.`,
  };
}
