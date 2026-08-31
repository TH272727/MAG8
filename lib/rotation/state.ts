import type { DailyState, DirectionKey, Reading, Tier } from "./score";
import { TIER_META } from "./score";

/* ============================================================================
 * State changes — pure.
 *
 * A state is (Tier, Direction). A state CHANGE is the only thing that may
 * trigger a written note, so what counts as one is a decision with consequences
 * rather than a detail:
 *
 *   - A tier crossing in EITHER direction is a change. A signal decaying is
 *     reported exactly as loudly as one building; a board that only ever
 *     announces the building half is an advertisement, not an instrument.
 *   - A direction flip counts only between two DECISIVE directions. A ratio
 *     resting on its own trend drifts in and out of "balanced" on daily noise,
 *     and treating each of those as a flip would raise a note nearly every day
 *     and teach the reader to ignore all of them.
 *
 * Changes are DERIVED from the computed history rather than logged as they
 * happen, so the marks on a chart cover the full stored history immediately and
 * continue to describe the weighting currently in force.
 * ========================================================================== */

export interface StateChange {
  indicatorId: string;
  date: string;
  kind: "tier" | "direction" | "both";
  from: { tier: Tier; direction: DirectionKey };
  to: { tier: Tier; direction: DirectionKey };
}

/** Every state change in one indicator's history, oldest first. */
export function detectChanges(indicatorId: string, history: DailyState[]): StateChange[] {
  const out: StateChange[] = [];
  let prevTier: Tier | null = null;
  let lastDecisive: DirectionKey | null = null;

  for (const day of history) {
    const decisive: DirectionKey | null = day.direction === "balanced" ? lastDecisive : day.direction;

    if (prevTier !== null) {
      const tierChanged = day.tier !== prevTier;
      const directionChanged = decisive !== null && lastDecisive !== null && decisive !== lastDecisive;
      if (tierChanged || directionChanged) {
        out.push({
          indicatorId,
          date: day.date,
          kind: tierChanged && directionChanged ? "both" : tierChanged ? "tier" : "direction",
          from: { tier: prevTier, direction: lastDecisive ?? "balanced" },
          to: { tier: day.tier, direction: decisive ?? "balanced" },
        });
      }
    }

    prevTier = day.tier;
    if (day.direction !== "balanced") lastDecisive = day.direction;
  }
  return out;
}

export function latestChange(changes: StateChange[]): StateChange | null {
  return changes.length === 0 ? null : changes[changes.length - 1];
}

/** Sessions between the last state change and the newest session. Null when it never changed. */
export function sessionsSinceChange(changes: StateChange[], history: DailyState[]): number | null {
  const last = latestChange(changes);
  if (!last) return null;
  const idx = history.findIndex((d) => d.date === last.date);
  if (idx < 0) return null;
  return history.length - 1 - idx;
}

/** Calendar days between the last state change and a given date. Null when it never changed. */
export function daysSinceChange(changes: StateChange[], asOf: string): number | null {
  const last = latestChange(changes);
  if (!last) return null;
  const then = Date.parse(`${last.date}T00:00:00Z`);
  const now = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}

/** Changes that fired on the newest session — the only thing that may raise a note. */
export function changesOn(changes: StateChange[], date: string): StateChange[] {
  return changes.filter((c) => c.date === date);
}

/** Plain-English summary of one change, using the reading for the asset names. */
export function describeChange(change: StateChange, reading: Reading): string {
  const parts: string[] = [];
  if (change.kind === "tier" || change.kind === "both") {
    const from = TIER_META[change.from.tier].label;
    const to = TIER_META[change.to.tier].label;
    const verb = TIER_META[change.to.tier].rank > TIER_META[change.from.tier].rank ? "strengthened" : "eased";
    parts.push(`${verb} from ${from} to ${to}`);
  }
  if (change.kind === "direction" || change.kind === "both") {
    parts.push(`direction flipped to "${reading.directionLabel}"`);
  }
  return `${reading.label} ${parts.join(", and ")}`;
}

/* ----------------------------------------------------------------------------
 * State hash — the cache key for a written note.
 *
 * A deliberately dependency-free hash so this module stays importable anywhere.
 * It covers the changed indicators AND the settings that produced them: retuning
 * a weight re-derives the whole board, so a note written under the old weighting
 * describes a state that no longer exists and must not be served for it.
 * -------------------------------------------------------------------------- */

/** xmur3-style mixing, two rounds combined into 16 hex characters. */
export function hashString(input: string): string {
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h1 = (h1 << 13) | (h1 >>> 19);
    h2 = Math.imul(h2 ^ c, 1597334677);
    h2 = (h2 << 11) | (h2 >>> 21);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) >>> 0;
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export interface HashInputs {
  asOf: string;
  changes: StateChange[];
  /** The scoring settings in force, so a retune cannot serve a stale note. */
  settings: Record<string, number | boolean>;
}

export function stateHash(inputs: HashInputs): string {
  const changes = [...inputs.changes]
    .sort((a, b) => a.indicatorId.localeCompare(b.indicatorId))
    .map((c) => `${c.indicatorId}:${c.kind}:${c.from.tier}>${c.to.tier}:${c.from.direction}>${c.to.direction}`);
  const settings = Object.keys(inputs.settings)
    .sort()
    .map((k) => `${k}=${inputs.settings[k]}`);
  return hashString([inputs.asOf, ...changes, ...settings].join("|"));
}
