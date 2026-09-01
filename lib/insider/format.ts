import type { AltmanZone } from "./fundamentals";
import type { Stage } from "./scanner";

/* ============================================================================
 * Number and date formatting for the scanner's pages.
 * Presentation only — no rounding here ever feeds a calculation.
 * ========================================================================== */

const bad = (n: number | null | undefined): boolean =>
  n === null || n === undefined || !Number.isFinite(n);

/** A dollar figure at reading size: $1.24B, $153.5M, $154k, $940. */
export function fmtUsd(n: number | null | undefined): string {
  if (bad(n)) return "—";
  const v = n as number;
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** An exact dollar amount with separators, for a share price. */
export function fmtPrice(n: number | null | undefined): string {
  return bad(n) ? "—" : `$${(n as number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A percentage already expressed in percent. */
export function fmtPct(n: number | null | undefined, dp = 1): string {
  return bad(n) ? "—" : `${(n as number).toFixed(dp)}%`;
}

/** A fraction rendered as a percentage. */
export function fmtFraction(n: number | null | undefined, dp = 1): string {
  return bad(n) ? "—" : `${((n as number) * 100).toFixed(dp)}%`;
}

/** A signed percentage, for a return. */
export function fmtSignedFraction(n: number | null | undefined, dp = 1): string {
  if (bad(n)) return "—";
  const v = (n as number) * 100;
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}%`;
}

export function fmtNum(n: number | null | undefined, dp = 2): string {
  return bad(n) ? "—" : (n as number).toFixed(dp);
}

export function fmtInt(n: number | null | undefined): string {
  return bad(n) ? "—" : Math.round(n as number).toLocaleString("en-US");
}

/** 2026-08-28 → 28 Aug 2026. */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** How long ago, in the coarsest unit still true. */
export function fmtAgo(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months < 24 ? `${months} months ago` : `${(days / 365).toFixed(1)} years ago`;
}

/* ----------------------------------------------------------------------------
 * Vocabulary
 * -------------------------------------------------------------------------- */

/**
 * The solvency zones, in the author's own words.
 *
 * Gold is reserved across this platform for final verdicts, so nothing here
 * uses it: a solvency reading is an input, not a conclusion.
 */
export const ZONE_STYLE: Record<AltmanZone, { label: string; chip: string }> = {
  safe: { label: "Safe", chip: "gate-pass" },
  grey: { label: "Middle", chip: "gate-caution" },
  distress: { label: "Distress", chip: "gate-fail" },
  unmeasured: { label: "Not measured", chip: "" },
};

/** Where a company stopped, in language a reader can act on. */
export const STAGE_META: Record<Stage, { label: string; blurb: string }> = {
  ranked: { label: "Ranked", blurb: "Cleared every filter at this risk tolerance." },
  price: {
    label: "Price setup",
    blurb: "The fall was outside the band, too old, too deep against three years, or had not steadied.",
  },
  strength: {
    label: "Financial strength",
    blurb: "The balance sheet did not clear the published value-trap filters.",
  },
  buying: { label: "Insider buying", blurb: "The buying did not meet the conviction thresholds." },
  unworked: {
    label: "Not worked up",
    blurb: "Qualifying insider buying, but prices and statements have not been fetched yet.",
  },
};

/**
 * A composite band, for colour only.
 *
 * Deliberately coarse. A ranking built on four readings of a beaten-down
 * company is not precise enough to justify a fine gradient, and a page that
 * looks precise about an imprecise thing is making a claim of its own.
 */
export function scoreBand(score: number | null): "high" | "mid" | "low" | "none" {
  if (score === null || !Number.isFinite(score)) return "none";
  if (score >= 65) return "high";
  if (score >= 45) return "mid";
  return "low";
}

export const BAND_ACCENT: Record<ReturnType<typeof scoreBand>, string> = {
  high: "text-ink",
  mid: "text-muted",
  low: "text-dim",
  none: "text-dim",
};
