import type { InsiderSettings } from "../insider-settings";

/* ============================================================================
 * The composite — pure.
 *
 * Four readings, each already on a 0-100 scale and each measuring something
 * genuinely different: how convincing the buying looks, how well the price
 * setup fits the reader's band, whether the balance sheet is sound, and how far
 * below the estimated value the price sits.
 *
 * Equal weight by default, and that is not a placeholder. There is no evidence
 * for any particular blend of these four, and inventing one would be exactly the
 * kind of false precision that makes a ranking look more authoritative than it
 * is. The weights are exposed so a reader who disagrees can say so; the live
 * weighting is published alongside the scores it produced.
 *
 * A COMPONENT THAT COULD NOT BE MEASURED IS NOT ZERO. A company whose statements
 * cannot be read has not been shown to be weak, and one whose owner earnings are
 * negative has not been shown to be expensive. Such a company is scored on what
 * could be measured and is marked partial, and partial candidates rank BELOW
 * fully measured ones whatever their score — the same rule the other desks use,
 * so that an unmeasured thing can never pass for a quiet one.
 * ========================================================================== */

export type ComponentKey = "insider" | "setup" | "strength" | "value";

export const COMPONENT_META: Record<ComponentKey, { label: string; blurb: string }> = {
  insider: {
    label: "Insider conviction",
    blurb: "How much was bought, by how many different people, in what roles, and how recently.",
  },
  setup: {
    label: "Turnaround setup",
    blurb: "Where the fall sits inside the chosen band, how recent the high is, and whether the decline steadied.",
  },
  strength: {
    label: "Financial strength",
    blurb: "The nine-point fundamental-strength score and the solvency zone beneath it.",
  },
  value: {
    label: "Margin of safety",
    blurb: "How far below the conservative owner-earnings estimate the price sits.",
  },
};

export type WeightingPreset = "equal" | "insider-weighted" | "value-weighted";

export const WEIGHTING_PRESETS: Record<WeightingPreset, Record<ComponentKey, number>> = {
  equal: { insider: 1, setup: 1, strength: 1, value: 1 },
  "insider-weighted": { insider: 2.5, setup: 1, strength: 1, value: 0.5 },
  "value-weighted": { insider: 1, setup: 0.5, strength: 1.5, value: 2 },
};

export interface Components {
  insider: number | null;
  setup: number | null;
  strength: number | null;
  value: number | null;
}

export interface CompositeResult {
  /** 0-100 over the components that could be measured, or null when none could. */
  score: number | null;
  /** How many of the four weighted components had a value. */
  measured: number;
  /** Weighted components that could not be measured. */
  missing: ComponentKey[];
  /** True when every weighted component was measured. */
  complete: boolean;
  /** The weights actually applied, so a page can print them. */
  weights: Record<ComponentKey, number>;
  contributions: Record<ComponentKey, number | null>;
}

export function weightsFrom(s: InsiderSettings): Record<ComponentKey, number> {
  return {
    insider: s.weightInsider,
    setup: s.weightSetup,
    strength: s.weightStrength,
    value: s.weightValue,
  };
}

/**
 * Combine the four readings.
 *
 * A component carrying zero weight cannot block anything and is not counted as
 * missing — the reader turned it off, which is not the same as it being
 * unavailable. Everything else that carries weight and has no value is recorded
 * by name, and the remaining weights are renormalised so the result stays on the
 * same 0-100 scale rather than silently shrinking towards zero.
 */
export function composite(
  c: Components,
  weights: Record<ComponentKey, number>,
): CompositeResult {
  const keys: ComponentKey[] = ["insider", "setup", "strength", "value"];
  const missing: ComponentKey[] = [];
  const contributions: Record<ComponentKey, number | null> = {
    insider: null,
    setup: null,
    strength: null,
    value: null,
  };

  let weighted = 0;
  let totalWeight = 0;
  let measured = 0;

  for (const k of keys) {
    const w = weights[k];
    if (w <= 0) continue;
    const v = c[k];
    if (v === null) {
      missing.push(k);
      continue;
    }
    measured++;
    weighted += w * v;
    totalWeight += w;
    contributions[k] = Math.round(w * v * 10) / 10;
  }

  return {
    score: totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : null,
    measured,
    missing,
    complete: missing.length === 0 && measured > 0,
    weights,
    contributions,
  };
}

/**
 * Rank best first, with every incompletely measured company below every
 * complete one.
 *
 * Sorting purely on the composite would let a company scored on two components
 * out of four outrank one scored on all four, purely by having fewer ways to
 * disappoint. Separating them is the honest ordering, and the page labels the
 * two groups rather than running them together.
 */
export function rankByComposite<T extends { composite: CompositeResult; ticker: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.composite.complete !== b.composite.complete) return a.composite.complete ? -1 : 1;
    const as = a.composite.score;
    const bs = b.composite.score;
    if (as === null || bs === null) {
      if (as === bs) return a.ticker.localeCompare(b.ticker);
      return as === null ? 1 : -1;
    }
    return bs - as || a.ticker.localeCompare(b.ticker);
  });
}
