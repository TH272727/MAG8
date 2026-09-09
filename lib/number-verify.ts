/* ============================================================================
 * Traceability — one rule for "did this number come from somewhere".
 *
 * Four deterministic writers in this project produce prose full of figures, and
 * each of them re-reads its own output and refuses any numeral that cannot be
 * traced back to a computed input. That check was written three times before it
 * was written here, and the three copies had quietly diverged in one way that
 * matters, so it now lives once.
 *
 * THE TOLERANCE RULE. A numeral is accepted when it sits within half a unit of
 * the last place it was WRITTEN to of some allowed magnitude — so 0.2869 and
 * 0.287 both trace back to a computed 0.28685, and 412.60 traces back to
 * nothing. Half a unit rather than an exact match after rounding, because an
 * exactly half-way figure has no single correct rendering: 0.28685 is held in
 * binary a hair BELOW itself, so rounding it to four places gives 0.2868 while
 * any writer working from the decimal would put 0.2869. Insisting on one of
 * those would throw away correct output over a representation detail.
 *
 * THE SIGN RULE, which is the divergence. A sign-aware reader takes "-44.1" as
 * negative forty-four point one, so a figure whose sign is wrong in the prose
 * is caught. A sign-blind reader takes the same text as forty-four point one
 * and checks only the magnitude, which means the allowed list has to carry
 * absolute values. Neither is wrong, but they demand different allowed lists
 * and cannot be swapped without changing what passes, so each caller states
 * which it wants rather than inheriting a default it did not choose.
 * ========================================================================== */

const SIGNED = /-?\d[\d,]*(?:\.\d+)?/g;
const UNSIGNED = /\d[\d,]*(?:\.\d+)?/g;

/** Decimal places a numeral was actually written to. */
export function writtenPrecision(raw: string): number {
  const dot = raw.indexOf(".");
  return dot < 0 ? 0 : raw.length - dot - 1;
}

/** Every numeral in a piece of text, as written. */
export function numeralsIn(text: string, signed: boolean): string[] {
  return text.match(signed ? SIGNED : UNSIGNED) ?? [];
}

export interface VerifyResult {
  ok: boolean;
  /** Numerals in the text that trace back to nothing computed. */
  offenders: string[];
}

export interface VerifyOptions {
  /**
   * Read a leading minus as part of the number. When false, only the magnitude
   * is checked and the allowed list is expected to hold absolute values.
   */
  signed: boolean;
}

export function verifyNumbers(text: string, allowed: number[], opts: VerifyOptions): VerifyResult {
  const offenders: string[] = [];
  for (const raw of numeralsIn(text, opts.signed)) {
    const written = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(written)) continue;
    const tolerance = 0.5 * 10 ** -writtenPrecision(raw) + 1e-9;
    const traced = allowed.some((a) => Math.abs(written - a) <= tolerance);
    if (!traced && !offenders.includes(raw)) offenders.push(raw);
  }
  return { ok: offenders.length === 0, offenders };
}
