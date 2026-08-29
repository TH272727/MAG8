/* ============================================================================
 * Number and date formatting shared by the desk and its admin panel.
 * Presentation only — no rounding here ever feeds a calculation.
 * ========================================================================== */

/** Compact signed USD: $573.72B / $54.2B / $173M / $12,400. */
export function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2).replace(/\.?0+$/, "")}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}$${Math.round(abs * 100) / 100}`;
}

/**
 * Physical quantities span many orders of magnitude in one table — tens of
 * thousands of megawatts next to a hundred billion gigabytes — so large values
 * get a magnitude suffix rather than a wall of digits.
 */
export function fmtUnits(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1)} trillion`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  if (abs >= 1000) return Math.round(n).toLocaleString("en-US");
  return String(Math.round(n * 100) / 100);
}

/** Signed percentage, or an em dash when there is nothing to compare against. */
export function fmtPct(p: number | null | undefined, dp = 1): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return `${p >= 0 ? "+" : ""}${p.toFixed(dp)}%`;
}

/** 2026-06-30 → 30 Jun 2026. */
export function fmtDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** How long ago, in the coarsest unit that is still true. */
export function fmtAge(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
