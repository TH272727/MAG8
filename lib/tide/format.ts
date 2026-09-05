import type { Posture } from "./score";

/* ============================================================================
 * Number formatting for the desk and its panels.
 * Presentation only — no rounding here ever feeds a calculation.
 * ========================================================================== */

const DASH = "—";

/** A stress score, to the one decimal the bands are stated in. */
export function fmtStress(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : n.toFixed(1);
}

/** A whole percentage, for the exposure band. */
export function fmtWhole(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `${Math.round(n)}%`;
}

/** A share of weight or a percentile. */
export function fmtPct(n: number | null | undefined, dp = 1): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `${n.toFixed(dp)}%`;
}

/** A signed change, for anything that can move either way. */
export function fmtSigned(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

/**
 * A gauge's reading in its own units.
 *
 * These range from a spread of 0.87 to a market value of 77,110, so a fixed
 * precision would either round a spread to nothing or print an index level to
 * four meaningless decimals.
 */
export function fmtReading(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  const abs = Math.abs(n);
  if (abs >= 10_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

/** 2026-09-04 → 4 Sep 2026. */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** 2026-09 → Sep 2026. */
export function fmtMonth(key: string | null | undefined): string {
  return key ? fmtDay(`${key}-01`).replace(/^\d+\s/, "") : DASH;
}

/**
 * Which accent a stress score gets.
 *
 * Gold is deliberately absent from this whole desk: it is the leaderboard's
 * verdict colour and marks a final judgement about a company. Nothing here is
 * a verdict about anything.
 */
export function stressTone(stress: number | null): "bad" | "warn" | "ok" | "none" {
  if (stress === null) return "none";
  if (stress >= 66) return "bad";
  if (stress >= 40) return "warn";
  return "ok";
}

export const TONE_CLASS: Record<"bad" | "warn" | "ok" | "none", string> = {
  bad: "text-[color:var(--color-macro)]",
  warn: "text-ink",
  ok: "text-[color:var(--color-consensus)]",
  none: "text-dim",
};

export const POSTURE_TONE: Record<Posture, "bad" | "warn" | "ok" | "none"> = {
  defensive: "bad",
  cautious: "bad",
  neutral: "warn",
  constructive: "ok",
  "risk-on": "ok",
  unmeasured: "none",
};
