import type { ConceptFact } from "../edgar";

/* ============================================================================
 * XBRL period arithmetic — turning a company-concept fact series into clean,
 * comparable quarters. Pure functions; no network, no database.
 *
 * THE TRAP THIS EXISTS FOR. Cash-flow-statement concepts such as capital
 * expenditure are DURATION facts, and most filers report them cumulatively from
 * the start of the fiscal year. Apple's capex, verified 2026-08-29:
 *
 *     FY2026 Q1   2025-09-28 → 2025-12-27    90d   $2.373B
 *     FY2026 Q2   2025-09-28 → 2026-03-28   181d   $4.344B   ← six months
 *     FY2026 Q3   2025-09-28 → 2026-06-27   272d   $6.799B   ← nine months
 *
 * Reading "the latest 10-Q value" as a quarter reports $6.799B for a quarter
 * that was actually $2.455B — a 2.8x overstatement, with no error anywhere.
 * Since a whole playbook multiplies this figure into physical units, the error
 * would propagate silently into every number the desk publishes.
 *
 * The rule: facts sharing a `start` inside one fiscal year are cumulative, so
 * consecutive ones are differenced by `end`. Filers that already report discrete
 * quarters (each fact its own ~90-day window) pass through untouched. Both
 * shapes occur in the wild, so both are handled and labelled.
 * ========================================================================== */

/** One fiscal quarter of a duration concept, normalized. */
export interface QuarterValue {
  /** Period end, YYYY-MM-DD — the quarter's identity. */
  end: string;
  start: string;
  /** Value for THIS quarter alone, never cumulative. */
  val: number;
  /** Days covered (~90 for a clean quarter). */
  days: number;
  /** Fiscal year and period as the filer labelled them. */
  fy?: number;
  fp?: string;
  form?: string;
  /** `reported` = the filing gave a discrete quarter; `derived` = differenced out of a cumulative series. */
  basis: "reported" | "derived";
}

const dayCount = (start: string, end: string): number =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);

/** A single fiscal quarter, allowing for 13-week vs calendar-quarter drift. */
const isQuarterLength = (days: number): boolean => days >= 80 && days <= 100;
/** A full fiscal year. */
export const isAnnualLength = (days: number): boolean => days >= 350 && days <= 380;

/**
 * Deduplicate: the same fact reappears in later filings as a comparative, with
 * an identical window and value but a different `fy` stamp. Keep the earliest
 * filed instance so the original report wins over a restatement echo.
 */
function dedupe(facts: ConceptFact[]): ConceptFact[] {
  const byWindow = new Map<string, ConceptFact>();
  for (const f of facts) {
    if (!f.start || !f.end || typeof f.val !== "number") continue;
    const key = `${f.start}|${f.end}|${f.val}`;
    const prev = byWindow.get(key);
    if (!prev || (f.filed ?? "") < (prev.filed ?? "")) byWindow.set(key, f);
  }
  return [...byWindow.values()];
}

/**
 * Normalize a duration-concept fact series into discrete fiscal quarters,
 * oldest first.
 *
 * Facts are grouped by `start`. A group with several `end`s is a cumulative
 * run: its consecutive values are differenced, so the first entry is Q1 as
 * reported and each later one is the incremental quarter. A group with a single
 * quarter-length window is already discrete and passes through.
 *
 * Annual windows are excluded — they are the fiscal-year total, and including
 * them would double-count the quarters they contain.
 */
export function quarterlySeries(facts: ConceptFact[]): QuarterValue[] {
  const clean = dedupe(facts);
  const byStart = new Map<string, ConceptFact[]>();
  for (const f of clean) {
    const g = byStart.get(f.start!);
    if (g) g.push(f);
    else byStart.set(f.start!, [f]);
  }

  const out: QuarterValue[] = [];
  for (const [start, group] of byStart) {
    const ordered = [...group].sort((a, b) => a.end.localeCompare(b.end));

    if (ordered.length === 1) {
      // Lone window: a discrete quarter is usable; an annual total is not.
      const f = ordered[0];
      const days = dayCount(start, f.end);
      if (isQuarterLength(days)) {
        out.push({ end: f.end, start, val: f.val, days, fy: f.fy, fp: f.fp, form: f.form, basis: "reported" });
      }
      continue;
    }

    // Cumulative run: difference consecutive windows sharing this start.
    let prevVal = 0;
    let prevEnd = start;
    for (const f of ordered) {
      const spanDays = dayCount(prevEnd, f.end);
      const val = f.val - prevVal;
      // Only emit windows that increment by roughly one quarter; a jump from
      // the nine-month figure straight to the fiscal year is the annual total.
      if (isQuarterLength(spanDays)) {
        out.push({
          end: f.end,
          start: prevEnd,
          val,
          days: spanDays,
          fy: f.fy,
          fp: f.fp,
          form: f.form,
          basis: prevVal === 0 ? "reported" : "derived",
        });
      }
      prevVal = f.val;
      prevEnd = f.end;
    }
  }

  return dedupeByEnd(out).sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * One entry per period end.
 *
 * A filer often tags the SAME quarter twice: once directly (its own 90-day
 * window) and once inside the year-to-date run that gets differenced. Verified
 * on Amazon 2026-06-30, which appears both as `2026-04-01 → 2026-06-30` and as
 * the difference between the three- and six-month cumulative facts. Both are
 * $54.21B and both are correct, so neither errors — but keeping both would
 * double-count the quarter in every trailing-twelve-month total.
 *
 * A directly reported quarter wins over a derived one; otherwise the larger
 * absolute value wins, since a dropped sibling is more often a partial.
 */
function dedupeByEnd(quarters: QuarterValue[]): QuarterValue[] {
  const byEnd = new Map<string, QuarterValue>();
  for (const q of quarters) {
    const prev = byEnd.get(q.end);
    if (!prev) {
      byEnd.set(q.end, q);
      continue;
    }
    if (prev.basis === "derived" && q.basis === "reported") byEnd.set(q.end, q);
    else if (prev.basis === q.basis && Math.abs(q.val) > Math.abs(prev.val)) byEnd.set(q.end, q);
  }
  return [...byEnd.values()];
}

/** Annual totals, oldest first — the fiscal-year windows in the same series. */
export function annualSeries(facts: ConceptFact[]): QuarterValue[] {
  const out: QuarterValue[] = [];
  for (const f of dedupe(facts)) {
    const days = dayCount(f.start!, f.end);
    if (!isAnnualLength(days)) continue;
    out.push({ end: f.end, start: f.start!, val: f.val, days, fy: f.fy, fp: f.fp, form: f.form, basis: "reported" });
  }
  return out.sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * The quarter a year before `end`, matched on fiscal period label when the
 * filer provides one and on a ~365-day gap otherwise. Fiscal calendars drift
 * against the Gregorian one (Apple's Q3 ends in late June), so a tolerance
 * window rather than an exact date is required.
 */
export function priorYearQuarter(series: QuarterValue[], end: string): QuarterValue | null {
  const target = series.find((q) => q.end === end);
  if (!target) return null;
  const wanted = Date.parse(end) - 365 * 86_400_000;
  let best: QuarterValue | null = null;
  let bestGap = Infinity;
  for (const q of series) {
    if (q.end >= end) continue;
    if (target.fp && q.fp && q.fp !== target.fp) continue;
    const gap = Math.abs(Date.parse(q.end) - wanted);
    if (gap < bestGap && gap <= 45 * 86_400_000) {
      best = q;
      bestGap = gap;
    }
  }
  return best;
}

/** The quarter immediately preceding `end` in the series. */
export function priorQuarter(series: QuarterValue[], end: string): QuarterValue | null {
  const idx = series.findIndex((q) => q.end === end);
  return idx > 0 ? series[idx - 1] : null;
}

export interface Change {
  absolute: number;
  /** Null when the base is zero or negative — a percentage would be meaningless. */
  pct: number | null;
}

export function change(current: number, base: number | undefined): Change | null {
  if (base === undefined) return null;
  return { absolute: current - base, pct: base > 0 ? ((current - base) / base) * 100 : null };
}

/**
 * Trailing-twelve-month total ending at `end`: the four consecutive quarters up
 * to and including it. Null unless all four are present, since a partial sum
 * would understate the total while looking like a complete one.
 */
export function ttm(series: QuarterValue[], end: string): number | null {
  const idx = series.findIndex((q) => q.end === end);
  if (idx < 3) return null;
  return series.slice(idx - 3, idx + 1).reduce((s, q) => s + q.val, 0);
}
