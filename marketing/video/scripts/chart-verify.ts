/**
 * The honesty gate. Run before rendering, and again before publishing:
 *
 *   node scripts/chart-verify.ts            → every chart
 *   node scripts/chart-verify.ts mag7-10k   → one
 *
 * WHY THIS EXISTS. The most-viewed chart in this genre was fact-checked in
 * public and lost, not because a number was wrong but because a WINDOW was: one
 * series had fewer periods than the others, so once the animation ran past its
 * last observation its line stopped climbing while every rival kept going — and
 * a line that stops climbing while the others rise reads, to every viewer, as
 * the winner. Nothing in the rendering was false. The chart was.
 *
 * So the checks here are about windows, labels and traceability rather than
 * taste. They are deliberately blunt: a FAIL blocks the render.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHART_IDS, CHART_SPECS} from '../src/charts/jobs.ts';
import {beatsOf, formatValue, totalFrames} from '../src/charts/spec.ts';
import {growthMultiple, standingsAt} from '../src/charts/cmath.ts';
import type {ChartData, ChartSpec} from '../src/charts/spec.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

type Finding = {level: 'FAIL' | 'WARN'; msg: string};

const checkChart = (spec: ChartSpec, data: ChartData): Finding[] => {
  const out: Finding[] = [];
  const fail = (msg: string) => out.push({level: 'FAIL', msg});
  const warn = (msg: string) => out.push({level: 'WARN', msg});

  /* ---- shape ---- */
  if (data.id !== spec.id) fail(`dataset id "${data.id}" does not match spec id "${spec.id}"`);
  if (data.dates.length < 8) fail(`only ${data.dates.length} dates — too few to animate honestly`);
  for (let i = 1; i < data.dates.length; i++) {
    if (data.dates[i] <= data.dates[i - 1]) {
      fail(`dates are not strictly ascending at ${data.dates[i - 1]} → ${data.dates[i]}`);
      break;
    }
  }
  const keys = new Set(data.series.map((s) => s.key));
  for (const s of spec.series) {
    if (!keys.has(s.key)) fail(`spec draws "${s.key}" but the dataset has no such series`);
  }
  for (const s of data.series) {
    if (s.values.length !== data.dates.length) {
      fail(`series "${s.key}" has ${s.values.length} values for ${data.dates.length} dates`);
    }
  }

  /* ---- THE WINDOW CHECK — the one that matters ---- */
  const last = data.dates.length - 1;
  for (const s of data.series) {
    let tail = 0;
    for (let i = last; i >= 0 && s.values[i] === null; i--) tail++;
    if (tail > 0) {
      fail(
        `series "${s.key}" has no reading for its final ${tail} date(s): its line would stop ` +
          `climbing while the others continue, which reads as a result rather than as missing data. ` +
          `Trim the run to the last date every series reports.`,
      );
    }
    let head = 0;
    for (let i = 0; i < data.dates.length && s.values[i] === null; i++) head++;
    if (head > 0) {
      fail(
        `series "${s.key}" does not start until ${data.dates[head]} while the chart starts at ` +
          `${data.dates[0]}: a shorter run cannot share an axis with longer ones without saying so. ` +
          `Rebase every line to the first date they all exist.`,
      );
    }
    const holes = s.values.filter((v) => v === null).length;
    if (holes > 0 && head === 0 && tail === 0) {
      warn(`series "${s.key}" has ${holes} interior hole(s) — the line will draw a straight chord across them`);
    }
  }

  /**
   * ---- discontinuity check ----
   * A single point that jumps far outside the series' own behaviour and comes
   * straight back is almost never data; it is a parse artefact. This one is
   * here because a blank field in a federal CSV was read as a zero and drew
   * consumer prices collapsing 100% for one month — visible on screen as a
   * line falling off the bottom of the plot, and invisible to every other
   * check, because a wrong number is still a number.
   */
  for (const s of data.series) {
    const v = s.values;
    /**
     * The excursion is judged against the series' OWN full range as well as
     * against its local level, and both tests have to fire.
     *
     * The local-level test alone is unusable on a rebased percent chart: every
     * line starts at zero by construction, so for the first year or two the
     * denominator is a couple of percentage points and ordinary published noise
     * is enormous next to it. The toys line in cheaper-or-dearer was failed for
     * moving 118.4 → 117.5 → 118.3 on a 118-point index — a nine-tenths-of-a-
     * point wiggle, checked against the CSV, and 1% of what that line goes on to
     * do. The blank-field collapse this check exists for is 100% of its series'
     * range and still fails both tests.
     */
    const seen = v.filter((x): x is number => x !== null);
    const range = seen.length ? Math.max(...seen) - Math.min(...seen) : 0;
    /**
     * ...and against the series' own TYPICAL step, which is what "far outside
     * the series' own behaviour" actually means. Comparing only to the two
     * neighbours is a sample of one: a volatile line that falls hard and
     * recovers inside two months looks identical to a bad parse. The German
     * market fell 13% in September 2011 and bounced 16% in October — the
     * eurozone crisis, checked against the source closes — and was FAILED for
     * it. A blank field read as zero is hundreds of times the typical step; a
     * bad month is three or four.
     */
    const steps: number[] = [];
    for (let i = 1; i < v.length; i++) {
      const a = v[i - 1];
      const b = v[i];
      if (a !== null && b !== null) steps.push(Math.abs(b - a));
    }
    steps.sort((a, b) => a - b);
    const typicalStep = steps.length ? steps[Math.floor(steps.length / 2)] : 0;
    for (let i = 1; i < v.length - 1; i++) {
      const a = v[i - 1];
      const b = v[i];
      const c = v[i + 1];
      if (a === null || b === null || c === null) continue;
      const neighbourGap = Math.abs(c - a);
      const spike = Math.min(Math.abs(b - a), Math.abs(b - c));
      const scale = Math.max(Math.abs(a), Math.abs(c), 1);
      if (
        spike > 8 * Math.max(neighbourGap, scale * 0.01) &&
        spike > scale * 0.25 &&
        spike > range * 0.05 &&
        spike > typicalStep * 6
      ) {
        fail(
          `series "${s.key}" jumps to ${b} at ${data.dates[i]} and returns (neighbours ${a} → ${c}): ` +
            `a one-point excursion that large is a parsing artefact far more often than it is data. ` +
            `Check the source row before publishing.`,
        );
        break;
      }
    }
  }

  /* ---- the axis must announce itself ---- */
  if (spec.scale === 'log') {
    const clib = readFileSync(join(ROOT, 'src', 'charts', 'clib.tsx'), 'utf8');
    if (!clib.includes('LOG SCALE')) {
      fail('this chart is on a log axis and the LOG SCALE chip is no longer rendered by clib.tsx');
    }
    if (!spec.yFloor || spec.yFloor <= 0) fail('a log axis needs a positive yFloor');
  }
  if (spec.scale === 'linear') {
    const finals = data.series
      .map((s) => s.values[last])
      .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
    if (finals.length > 1) {
      const spread = Math.max(...finals) / Math.min(...finals);
      if (spread > 30) {
        warn(
          `linear axis with a ${Math.round(spread)}× spread between top and bottom line — ` +
            `the slower lines will sit flat on the floor. Consider scale: 'log' (and it will be labelled).`,
        );
      }
    }
  }

  /* ---- provenance ---- */
  if (!/^https?:\/\//.test(data.sourceUrl)) fail('sourceUrl is not a URL — a figure with no origin is not publishable');
  if (!data.method.trim()) fail('method line is empty: the viewer is not told what arithmetic was done');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fetchedAt)) fail('fetchedAt is not an ISO day');

  /* ---- copy vs data: no typed figure may contradict the file ---- */
  const order = standingsAt(data, last);
  const leaderKey = order[0]?.key;
  const leaderLabel = spec.series.find((s) => s.key === leaderKey)?.label ?? leaderKey;
  const copy = [spec.title, spec.subtitle ?? '', spec.hook.question, spec.hook.kicker ?? '', spec.payoff.lead, ...spec.payoff.lines].join(' ');
  // Any number written into the copy must be findable in the data, in a final
  // value, or in a growth multiple. Years and the principal are exempt.
  const principal = data.series[0]?.values.find((v) => v !== null) ?? null;
  const allowed = new Set<number>();
  if (principal !== null) allowed.add(Math.round(principal));
  for (const s of data.series) {
    const v = s.values[last];
    if (v !== null) allowed.add(Math.round(v));
    const m = growthMultiple(s.values);
    if (m !== null) allowed.add(Math.round(m));
  }
  allowed.add(spec.series.length);
  for (const d of data.dates) allowed.add(Number(d.slice(0, 4)));
  for (const raw of copy.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const n = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    if (n <= 12) continue; // small counts read as prose, not as claims
    if (!allowed.has(Math.round(n))) {
      warn(`copy contains "${raw}", which is not a final value, a growth multiple, a year or the principal`);
    }
  }

  /* ---- pacing (FORMULA §C) ---- */
  const b = beatsOf(spec);
  if (b.race / data.dates.length < 1.2) {
    warn(
      `${data.dates.length} points across ${b.race} frames is ${(b.race / data.dates.length).toFixed(2)} ` +
        `frames per point — the date will blur. Lengthen beats.race or coarsen the sampling.`,
    );
  }
  /**
   * ---- the cut is the race alone (OWNER RULE, 2026-09-05) ----
   * The two shipped films are the reference: no question card at the front, no
   * endcard at the back, just the chart moving. A card is not a small addition
   * to this format — it is the difference between a graph someone watches and
   * an ad they scroll past, and the owner has now called it twice. The scenes
   * remain in the engine, so this has to be a gate rather than a default: a
   * spec that quietly gives one of them frames would otherwise ship.
   */
  for (const [name, frames] of [['hook', b.hook], ['payoff', b.payoff], ['endcard', b.endcard]] as const) {
    if (frames > 0) {
      fail(
        `the ${name} beat is on (${frames}f). A chart film is the race alone — no intro card, no ` +
          `outro card — unless the owner asks for one on this specific film. Set beats.${name} to 0.`,
      );
    }
  }
  if (b.race < 300) warn('race beat is under 10s — the axis expansion is the format and it needs room');
  if (b.endcard === 0 && !readFileSync(join(ROOT, 'src', 'charts', 'clib.tsx'), 'utf8').includes('themag8.com')) {
    // With no endcard there is exactly one place the brand appears. If the
    // header ever loses it, the film promotes nothing at all.
    fail('this cut has no endcard, and the persistent header no longer carries themag8.com');
  }

  return out;
};

/* ---------------------------------- run ----------------------------------- */

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = wanted.length ? wanted : CHART_IDS;
let fails = 0;
let warns = 0;

for (const id of ids) {
  const spec = CHART_SPECS[id];
  if (!spec) {
    console.error(`unknown chart "${id}"`);
    process.exit(1);
  }
  const mod = await import(`../src/charts/data/${id}.data.ts`);
  const data: ChartData = mod.DATA;
  const findings = checkChart(spec, data);
  const last = data.dates.length - 1;
  const top = standingsAt(data, last)[0];
  const topLabel = spec.series.find((s) => s.key === top?.key)?.label ?? top?.key;

  console.log(`\n${id}  ${data.dates[0]} → ${data.dates[last]}  ${data.dates.length} points × ${data.series.length} lines`);
  console.log(`  scale ${spec.scale} · ${totalFrames(spec)}f (${(totalFrames(spec) / 30).toFixed(1)}s)`);
  console.log(`  leads: ${topLabel} at ${top?.v === null || top?.v === undefined ? 'n/a' : formatValue(top.v, spec.unit)}`);
  for (const f of findings) {
    console.log(`  ${f.level}  ${f.msg}`);
    if (f.level === 'FAIL') fails++;
    else warns++;
  }
  if (!findings.length) console.log('  clean');
}

console.log(`\n${fails} FAIL · ${warns} WARN across ${ids.length} chart(s)`);
if (fails) process.exit(1);
