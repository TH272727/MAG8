/**
 * Chart geometry — pure functions, no React, no frame, no clock. Everything the
 * plot draws is derived here so the same numbers can be checked offline by
 * scripts/chart-verify.ts (the on-screen readouts are verified against the
 * frozen dataset the same way rotation's brief verifies its own prose).
 */
import type {ChartData, Unit} from './spec.ts';

/* --------------------------------- scales -------------------------------- */

/** Value → 0..1 up the plot. Log needs a positive floor; the caller guarantees it. */
export const yFrac = (v: number, min: number, max: number, log: boolean): number => {
  if (log) {
    const lo = Math.log(Math.max(min, 1e-9));
    const hi = Math.log(Math.max(max, min * 1.0001));
    return (Math.log(Math.max(v, min)) - lo) / (hi - lo);
  }
  return (v - min) / (max - min || 1);
};

/**
 * "Nice" gridline values inside [min,max]. Linear walks 1/2/5×10^n; log walks
 * decades. Returns at most `want`+2 ticks — the axis stays readable while the
 * domain grows underneath it, which is the whole visual signature of the genre.
 */
export const ticks = (min: number, max: number, log: boolean, want = 5): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  // A log axis spanning less than about a decade cannot be labelled with
  // decades — early in a race the whole field sits between $8K and $14K and the
  // decade walk yields a single tick. Nice round steps positioned on the log
  // scale read correctly and keep the axis populated; the walk below takes over
  // once the spread is wide enough to need it.
  if (log && max / min >= 12) {
    const out: number[] = [];
    const from = Math.floor(Math.log10(Math.max(min, 1e-9)));
    const to = Math.ceil(Math.log10(max));
    for (let e = from; e <= to; e++) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v >= min && v <= max) out.push(v);
      }
    }
    // Thin evenly rather than truncating, so the top of the axis keeps a label.
    const stride = Math.max(1, Math.ceil(out.length / (want + 1)));
    return out.filter((_, i) => i % stride === 0);
  }
  const raw = (max - min) / want;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
};

/* ------------------------------ series reading ---------------------------- */

/**
 * The value of a series at a FRACTIONAL index — the head of the line sits
 * between two months and slides smoothly, which is what makes the motion read
 * as time passing rather than as a slideshow. `null` in either neighbour means
 * the series has no reading there and the head is simply absent.
 */
export const valueAt = (values: (number | null)[], idx: number): number | null => {
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, values.length - 1);
  const a = values[i0];
  const b = values[i1];
  if (a === null || a === undefined) return null;
  if (b === null || b === undefined) return a;
  return a + (b - a) * (idx - i0);
};

/** The drawn points for one series up to `idx`, holes dropped, head appended. */
export const pointsUpTo = (
  values: (number | null)[],
  idx: number,
): {i: number; v: number}[] => {
  const out: {i: number; v: number}[] = [];
  const last = Math.floor(idx);
  for (let i = 0; i <= last && i < values.length; i++) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) out.push({i, v});
  }
  const head = valueAt(values, idx);
  if (head !== null && idx > last) out.push({i: idx, v: head});
  return out;
};

/** Largest and smallest revealed value across every series at `idx`. */
export const revealedExtent = (
  data: ChartData,
  idx: number,
): {min: number; max: number} => {
  let min = Infinity;
  let max = -Infinity;
  for (const s of data.series) {
    for (const p of pointsUpTo(s.values, idx)) {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
    }
  }
  if (!Number.isFinite(min)) return {min: 0, max: 1};
  return {min, max};
};

/**
 * The y domain at `idx`. It RATCHETS: the top only ever rises, so the axis
 * expands and never rewinds mid-race (a shrinking axis reads as the data going
 * backwards). Headroom keeps the leading line off the ceiling.
 */
export const yDomain = (
  data: ChartData,
  idx: number,
  opts: {log: boolean; floor?: number; headroom?: number},
): {min: number; max: number} => {
  const {min, max} = revealedExtent(data, idx);
  const headroom = opts.headroom ?? 0.12;
  if (opts.log) {
    /**
     * The window opens TIGHT around the revealed data and widens from there.
     *
     * It used to open on a full decade (`lo * 10`) no matter what was revealed,
     * so for the first third of a run every line sat inside about 25px of a
     * 610px plot: the chart looked flat, and the head badges — which must not
     * overlap — fanned out across the whole column into what read as a floating
     * legend of eight different values that were in fact all within a few
     * hundred dollars of each other. Tracking the data instead is also what the
     * format is FOR: the axis visibly expands, and its units climb, as time
     * passes.
     *
     * Both bounds are monotone by construction — revealed min only falls and
     * revealed max only rises as more data is shown — so the axis never rewinds.
     */
    const lo = Math.max(Math.min(opts.floor ?? Infinity, min / 1.06), 1e-9);
    return {min: lo, max: Math.max(max * (1 + headroom), lo * 1.5)};
  }
  /**
   * `yFloor` is where the axis PREFERS to start, not a hard bottom. Pinning it
   * hard clipped a real series: the median-home line dips to −1.27% in 2000 and
   * was drawn below the baseline, outside the plot box, because the floor said
   * zero. Data below the preferred floor wins and the axis opens downward to
   * hold it — a line that leaves the frame is a chart that is hiding something.
   */
  const dataLo = min < 0 ? min - (max - min) * 0.06 : min;
  const lo = Math.min(opts.floor ?? dataLo, dataLo);
  return {min: lo, max: Math.max(max * (1 + headroom), lo + 1)};
};

/**
 * The x domain in index space. It expands with the reveal, but never narrower
 * than `minSpanFrac` of the full run — otherwise the first three months stretch
 * across the whole plot and the opening reads as noise.
 */
export const xSpan = (idx: number, n: number, minSpanFrac = 0.08): number =>
  Math.max(idx, (n - 1) * minSpanFrac);

/* --------------------------- line-head placement -------------------------- */

export type Head = {key: string; y: number; yLine: number; v: number};

/**
 * Push overlapping line heads apart vertically. The badge stays connected to
 * its true point by a leader stub (`yLine` is where the data actually is,
 * `y` is where the badge got parked), so nudging a label never misstates a
 * value. Deterministic: sort, sweep down, sweep up, clamp.
 */
export const deOverlap = (heads: Head[], minGap: number, top: number, bottom: number): Head[] => {
  const sorted = [...heads].sort((a, b) => a.y - b.y);
  const n = sorted.length;
  if (n === 0) return sorted;

  /**
   * Shrink the gap BEFORE spacing anything, if the stack cannot fit at the
   * requested one. The first version of this clamped each badge into the box
   * as a last step, which silently undid the spacing it had just done: eight
   * badges needed 588px of a 554px column, the block got shifted up, and the
   * top badge was then clamped back down ONTO its neighbour — the leader and
   * the runner-up printed through each other, which is the single worst place
   * for it to happen. Fit first, then place; never clamp per item.
   */
  const room = Math.max(bottom - top, 0);
  const gap = n > 1 ? Math.min(minGap, room / (n - 1)) : minGap;

  for (let i = 1; i < n; i++) {
    if (sorted[i].y - sorted[i - 1].y < gap) sorted[i].y = sorted[i - 1].y + gap;
  }

  /**
   * Spacing the crowded badges can still leave the STACK taller than the box,
   * because badges that were already far apart keep their real separation. A
   * shift cannot fix that — pushing up to clear the bottom immediately breaks
   * the top, and pushing back down undoes it, which is a no-op that looks like
   * the guard is working (eight badges walked straight through the date
   * readout while every clamp reported success). So when the stack genuinely
   * does not fit, compress it proportionally: order and relative spacing
   * survive, and the true reading is never in doubt because each badge also
   * draws a dot at its real point.
   */
  const first = sorted[0].y;
  const spanY = sorted[n - 1].y - first;
  if (spanY > room && spanY > 0) {
    const k = room / spanY;
    for (const h of sorted) h.y = top + (h.y - first) * k;
    return sorted;
  }
  const overflow = sorted[n - 1].y - bottom;
  if (overflow > 0) for (const h of sorted) h.y -= overflow;
  const underflow = top - sorted[0].y;
  if (underflow > 0) for (const h of sorted) h.y += underflow;
  return sorted;
};

/* --------------------------------- ranking -------------------------------- */

/** Series ordered by value at `idx`, biggest first. Unreadable series rank last. */
export const standingsAt = (
  data: ChartData,
  idx: number,
): {key: string; v: number | null}[] =>
  data.series
    .map((s) => ({key: s.key, v: valueAt(s.values, idx)}))
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));

/** Multiple of the starting value — the "$10,000 became…" arithmetic. */
export const growthMultiple = (values: (number | null)[]): number | null => {
  const first = values.find((v): v is number => v !== null && Number.isFinite(v));
  const last = [...values].reverse().find((v): v is number => v !== null && Number.isFinite(v));
  if (first === undefined || last === undefined || first <= 0) return null;
  return last / first;
};

/** Rounded to the precision it will be PRINTED at — verify against this, not the raw float. */
export const printable = (v: number, unit: Unit): number =>
  unit === 'pct' ? Number(v.toFixed(1)) : Math.round(v);
