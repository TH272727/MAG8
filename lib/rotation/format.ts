import type { DirectionKey, Reading, Tier } from "./score";

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
 * rotation reading is an observation, not a verdict.
 *
 * The emphasis ramp is deliberately monochrome — ink for the strongest reading
 * down to dim for none. It previously ran copper-to-green, which put a
 * good/bad reading on a number that has no good or bad in it: a strong score is
 * a strong move, and whether that move is welcome depends entirely on which
 * side it favours. Colour on this page now carries direction and nothing else.
 */
export const TIER_STYLE: Record<Tier, { chip: string; accent: string }> = {
  // The chip always spells the tier out, so its colour only has to mark the one
  // that asks to be looked at — copper for attention, never green for approval.
  strong: { chip: "gate-caution", accent: "text-ink" },
  building: { chip: "", accent: "text-ink" },
  neutral: { chip: "", accent: "text-muted" },
  none: { chip: "", accent: "text-dim" },
};

export interface DirectionMark {
  /** Which way the ratio itself is moving. Never shown without the ticker. */
  glyph: string;
  /** The side this reading favours; null when neither. */
  ticker: string | null;
  /** Spoken form, for screen readers and tooltips. */
  label: string;
  accent: string;
}

/**
 * The side a score favours, rendered as a compact badge that sits WITH the
 * number rather than under it.
 *
 * This exists because the pivot score is magnitude-only by construction: trend,
 * stretch and momentum are all absolute values, so the score measures how
 * decisively a ratio is moving and says nothing about which way. Shown alone it
 * reads like a recommendation — the highest score on the board can be a strong
 * move AGAINST the thing being named. Pairing the number with the side it
 * favours makes that misreading impossible rather than merely documented.
 *
 * The glyph is never shown on its own: the published method requires direction
 * to name the actual assets, never just "up" or "down". The shape and the
 * ticker carry the whole message, so colour is deliberately NOT the code for
 * which side won — two hues would have to be learned, would collide with the
 * chart's own legend, and would inevitably read as good against bad when
 * neither leg of a ratio is either. Colour here separates only "has a side"
 * from "has none".
 */
export function directionMark(reading: Pick<Reading, "direction" | "base" | "quote">): DirectionMark {
  const dir: DirectionKey = reading.direction;
  if (dir === "favors-base") {
    return { glyph: "▲", ticker: reading.base, label: `favours ${reading.base}`, accent: "text-muted" };
  }
  if (dir === "favors-quote" && reading.quote) {
    return { glyph: "▼", ticker: reading.quote, label: `favours ${reading.quote}`, accent: "text-muted" };
  }
  return { glyph: "–", ticker: null, label: "balanced, favouring neither side", accent: "text-dim" };
}
