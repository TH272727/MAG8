import type { Tier } from "./score";

/* ============================================================================
 * Number and date formatting for the board and its panels.
 * Presentation only — no rounding here ever feeds a calculation.
 * ========================================================================== */

/**
 * A ratio of two broad funds lives near a constant and moves in the third and
 * fourth decimal, so it is shown with enough places to see the move rather than
 * with a fixed two that would round every day to the same number.
 */
export function fmtRatio(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

/** One decimal, the precision the published tiers are stated in. Em dash when unscored. */
export function fmtScore(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toFixed(1);
}

/** Signed percentage, or an em dash when there is nothing to compare against. */
export function fmtPct(p: number | null | undefined, dp = 1): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return `${p >= 0 ? "+" : ""}${p.toFixed(dp)}%`;
}

/** Unsigned number to a fixed precision; em dash when absent. */
export function fmtNum(n: number | null | undefined, dp = 2): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toFixed(dp);
}

/** A percentile reads as a whole number followed by its ordinal band. */
export function fmtPercentile(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : String(Math.round(n));
}

/** 2026-08-28 → 28 Aug 2026. */
export function fmtDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** How long since a state last changed, in the coarsest unit still true. */
export function fmtSince(days: number | null | undefined): string {
  if (days === null || days === undefined) return "never";
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months`;
  return `${(days / 365).toFixed(1)} years`;
}

/**
 * Tier presentation.
 *
 * Gold marks final verdicts on the leaderboard and appears nowhere here: a
 * rotation reading is an observation, not a verdict. The scale runs from copper
 * for the strongest reading down to dim for none, so the eye can rank a column
 * without reading it.
 */
export const TIER_STYLE: Record<Tier, { chip: string; accent: string }> = {
  strong: { chip: "gate-caution", accent: "text-macro" },
  building: { chip: "gate-pass", accent: "text-fundamentals" },
  neutral: { chip: "", accent: "text-muted" },
  none: { chip: "", accent: "text-dim" },
};
