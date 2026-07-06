import type { MetricValue } from "@/lib/schemas";

/* ============================================================================
 * Narrowing helpers for chart components. keyMetrics is persisted, loosely
 * typed data (old rows predate the structured fields) — every chart must
 * survive missing, null, or malformed values by rendering nothing.
 * ========================================================================== */

export const asNum = (v: MetricValue | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export const asStr = (v: MetricValue | undefined): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

export const asObj = (v: MetricValue | undefined): Record<string, MetricValue | undefined> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v : null;

export const asArr = (v: MetricValue | undefined): MetricValue[] | null => (Array.isArray(v) ? v : null);

/** Position of value on [lo, hi] as a 0–100 percent, clamped. */
export function pctPos(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 50;
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100));
}

export const fmtUsd = (n: number): string =>
  `$${n >= 1000 ? Math.round(n).toLocaleString("en-US") : n >= 100 ? n.toFixed(0) : n.toFixed(2)}`;

/** Mark fill in a lens hue: 78% hue over panel keeps the dark-fill lightness band. */
export const markFill = (colorVar: string) => `color-mix(in oklab, var(${colorVar}) 78%, var(--color-panel))`;
/** Unfilled meter track: a light step of the same hue's ramp (never plain gray). */
export const trackFill = (colorVar: string) => `color-mix(in oklab, var(${colorVar}) 14%, var(--color-panel))`;
/** Range/zone wash: the hue at low opacity over the panel. */
export const washFill = (colorVar: string, pct = 22) => `color-mix(in oklab, var(${colorVar}) ${pct}%, var(--color-panel))`;
