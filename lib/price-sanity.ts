import { PUBLIC_LENS_LABEL } from "./public-view";

/* ============================================================================
 * Deterministic price grounding (server-only). After the lens matrix and
 * before compilation, each ticker's street-consensus spot price is checked
 * against an independent free quote source. Divergence becomes a
 * plain-language gap note that reaches the compiler prompt AND the published
 * report — a hallucinated or stale price gets flagged, never silently trusted.
 *
 * Quote source: Yahoo Finance's keyless v8 chart endpoint (the plan's original
 * pick, Stooq's CSV API, was retired/bot-walled as of 2026-07 — verified: its
 * /q/l/ endpoint 404s and /q/d/l/ serves a JS challenge). Yahoo requires a
 * browser-ish User-Agent; without one it rate-limits.
 *
 * Fail-silent by design: a fetch that errors, times out (3s), or returns no
 * data produces NO flag — absence of an external quote is not evidence of a
 * lens error, and a flaky third party must never fail a run.
 * ========================================================================== */

/** Kill switch: MAG8_PRICE_CHECK=0 disables the external quote check entirely. */
export function priceCheckEnabled(): boolean {
  return process.env.MAG8_PRICE_CHECK !== "0";
}

const FETCH_TIMEOUT_MS = 3_000;
/** Relative divergence vs the lens's own spot that earns a flag. */
const DIVERGENCE_THRESHOLD = 0.15;

const fmtUsd = (n: number) => (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2));

/**
 * Last regular-market price for a US-listed ticker; null on ANY failure —
 * network error, timeout, non-200, or an unrecognized payload.
 */
export async function fetchIndependentQuote(ticker: string): Promise<number | null> {
  if (!/^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(ticker)) return null;
  const symbol = ticker.toUpperCase().replace(/\./g, "-"); // BRK.B → BRK-B
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { chart?: { result?: { meta?: { regularMarketPrice?: unknown } }[] } };
    const price = body.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export interface PriceCheckInput {
  ticker: string;
  /** The street-consensus lens's own spot price (keyMetrics.currentPrice). */
  lensPrice: number;
}

/**
 * One quote request per ticker, all in parallel; only divergences beyond the
 * threshold produce flags. Never throws.
 */
export async function priceSanityFlags(inputs: PriceCheckInput[]): Promise<string[]> {
  if (!priceCheckEnabled() || inputs.length === 0) return [];
  const results = await Promise.allSettled(
    inputs.map(async ({ ticker, lensPrice }) => {
      if (!(lensPrice > 0)) return null;
      const quote = await fetchIndependentQuote(ticker);
      if (quote === null) return null;
      const divergence = Math.abs(quote - lensPrice) / lensPrice;
      if (divergence <= DIVERGENCE_THRESHOLD) return null;
      return `${ticker}: independent quote check — live market price $${fmtUsd(quote)} vs the ${PUBLIC_LENS_LABEL("institutional-forecast")} lens's spot $${fmtUsd(lensPrice)} (${Math.round(divergence * 100)}% apart). A figure may be stale; treat price-anchored numbers with caution.`;
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}
