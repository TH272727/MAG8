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
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHART_IDS, CHART_JOBS, CHART_SPECS} from '../src/charts/jobs.ts';
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

  /**
   * ---- the x axis has to keep one pace ----
   *
   * Points are placed by INDEX, not by date: step n and step n+1 are the same
   * number of pixels apart whether they are a quarter or a decade apart in the
   * world. So an irregular date grid is the window defect wearing a different
   * hat — the axis whose entire job is to represent time passing misstates its
   * own step, with every value real and no error anywhere.
   *
   * A single odd gap is a publisher's hole (BLS did not publish October 2025,
   * and three films carry that one skipped month). Those are worth saying out
   * loud but not worth blocking a re-render over. A RUN of them is something
   * else: the Fed's Z.1 accounts are ANNUAL before 1952 and quarterly after, in
   * the same series with no field saying so, and drawn as filed the first six
   * years of that chart ran at four times the speed of the following seventy —
   * with year labels placed at quarterly spacing to match. That is a different
   * publishing regime inside one series and the run has to start after it.
   */
  {
    const day = (d: string) => Date.parse(d) / 86400000;
    const gaps: number[] = [];
    for (let i = 1; i < data.dates.length; i++) gaps.push(day(data.dates[i]) - day(data.dates[i - 1]));
    if (gaps.length >= 8) {
      const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
      const odd = gaps.map((g, i) => (g < median * 0.6 || g > median * 1.6 ? i : -1)).filter((i) => i >= 0);
      let run = 0;
      let longest = 0;
      for (let i = 1; i < odd.length; i++) {
        run = odd[i] === odd[i - 1] + 1 ? run + 1 : 0;
        longest = Math.max(longest, run + 1);
      }
      if (longest >= 3) {
        const from = data.dates[odd[0]];
        const to = data.dates[odd[odd.length - 1] + 1];
        fail(
          `the date grid changes pace: ${longest} consecutive steps between ${from} and ${to} are not ` +
            `the ${median}-day step the rest of the run uses. Points are placed by index, so that ` +
            `stretch would animate at a different speed from the rest of the film. Start the run after ` +
            `the regime change with the job's \`from\`.`,
        );
      } else if (odd.length) {
        warn(
          `${odd.length} irregular step(s) in the date grid (e.g. ${data.dates[odd[0]]} → ` +
            `${data.dates[odd[0] + 1]}, ${gaps[odd[0]]}d against a ${median}d median) — a publisher's ` +
            `hole, drawn at the width of a normal step.`,
        );
      }
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
        /**
         * ...and one last question, which is the one that actually separates a
         * bad parse from a bad month: IS THIS A VALUE THE SERIES VISITS AT
         * OTHER TIMES?
         *
         * A blank field read as zero lands somewhere the series never otherwise
         * goes — the CPI collapse this check was written for reads −100% on a
         * line that lives between 0 and +96%. A violent month lands somewhere
         * the line has been or will be: the Nikkei fell 13% in March 2026 and
         * recovered it in April (corroborated inside the source bars' own
         * high/low), and 31% above the 1989 base is a level it passed through
         * on the way up months earlier.
         *
         * So an excursion INSIDE the range the rest of the series occupies is
         * reported rather than blocked. It still gets said out loud, because
         * "check the source row" is exactly the right instruction — it is what
         * found this one — but it no longer stops a true chart from rendering.
         */
        const others = v.filter((x, j): x is number => x !== null && Math.abs(j - i) > 1);
        const lo = Math.min(...others);
        const hi = Math.max(...others);
        const visitedElsewhere = others.length > 8 && b >= lo && b <= hi;
        const where = `series "${s.key}" jumps to ${b} at ${data.dates[i]} and returns (neighbours ${a} → ${c})`;
        /**
         * A declared excursion (spec.knownExcursions) is reported, never
         * blocked. The one event this exists for is a price that went NEGATIVE
         * for a single session: it is real, it is the subject of the film, and
         * it can never satisfy the "visits this level elsewhere" test, because
         * nothing else in the series is anywhere near it. Undeclared spikes are
         * unaffected — they still FAIL.
         */
        const declared = (spec.knownExcursions ?? []).find(
          (k) => k.key === s.key && k.date === data.dates[i],
        );
        if (declared) {
          warn(
            `${where}: DECLARED by the spec — ${declared.why}. Reported, not blocked; the source ` +
              `row is the author's claim to have checked.`,
          );
        } else if (visitedElsewhere) {
          warn(
            `${where}: a large one-point excursion, but to a level this line occupies at other ` +
              `times (${lo.toFixed(1)} … ${hi.toFixed(1)}), so it reads as a real move rather than a ` +
              `parse artefact. Check the source row anyway.`,
          );
        } else {
          fail(
            `${where}: a one-point excursion that large, to a level the series never otherwise ` +
              `reaches, is a parsing artefact far more often than it is data. Check the source row ` +
              `before publishing.`,
          );
          break;
        }
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

  /**
   * ---- the receipts have to fit on their line ----
   *
   * The source line is 21px mono at 0.12em tracking inside the 960px portrait
   * safe width, which is about 63 characters; measured against real renders,
   * 62 sits on one line and 67 wraps. A wrap there does not truncate anything,
   * it just drops an orphan ("09-06") under the credit and reads as broken
   * furniture under an otherwise finished frame — and it is invisible in a
   * downscaled contact sheet, so it needs to be arithmetic rather than an eye.
   * The pull stamp is a fixed 20 characters, so the budget belongs to the label.
   */
  {
    const stamp = ' · PULLED 0000-00-00'.length;
    const budget = 62;
    if (data.sourceLabel.length + stamp > budget) {
      fail(
        `the source line is ${data.sourceLabel.length + stamp} characters ("${data.sourceLabel}" plus the ` +
          `pull stamp) against a ${budget}-character line — it will wrap and leave an orphan under the ` +
          `credit. Shorten sourceLabel to ${budget - stamp} characters or fewer and re-fetch.`,
      );
    }
  }

  /**
   * ---- the title has to say what the film is about ----
   *
   * OWNER RULE (2026-09-07), and the reason this is a FAIL rather than taste:
   * `the-gap-that-closed` opened on the words "The gap that closed". Every
   * number on screen was right, the subtitle said "Life expectancy at birth, in
   * years", and none of that helps — the first text a viewer reads is the 62px
   * title, and a viewer who cannot tell what they are watching scrolls before
   * they reach the 31px line under it. "The viewer has to know right away what
   * they're watching."
   *
   * A machine cannot judge whether a phrase is clear. What it CAN check is that
   * the spec's own declared `subject` — the measured thing, in plain words —
   * actually appears in the title. That turns a taste rule into an arithmetic
   * one: a title made only of story words shares nothing with "life expectancy
   * at birth" and fails. It is defeatable by writing a dishonest `subject`,
   * which is true of every other declared field here.
   */
  {
    const STOP = new Set([
      'the', 'and', 'for', 'with', 'what', 'who', 'how', 'has', 'have', 'had', 'that', 'this',
      'each', 'most', 'many', 'since', 'from', 'into', 'onto', 'over', 'under', 'across',
      'was', 'were', 'been', 'being', 'are', 'its', 'his', 'her', 'their', 'they', 'you',
      'not', 'but', 'all', 'any', 'one', 'two', 'per', 'via', 'out', 'off', 'own', 'did',
      'does', 'day', 'year', 'years', 'every', 'about', 'than', 'then', 'when', 'where',
      'which', 'while', 'after', 'before', 'more', 'less', 'much', 'made', 'make',
    ]);
    // Tokens of three letters or more, singular-ised, so "markets" matches
    // "market" and "borrows" matches "borrow".
    const words = (s: string) =>
      new Set(
        (s.toLowerCase().match(/[a-z]+/g) ?? [])
          .filter((w) => w.length >= 3 && !STOP.has(w))
          .map((w) => w.replace(/(?:ies)$/, 'y').replace(/(?:es|s)$/, '')),
      );

    if (!spec.subject || !spec.subject.trim()) {
      fail(
        'no `subject` declared. Say what the film measures, in plain words a stranger ' +
          "understands — \"life expectancy at birth\", not \"the gap that closed\".",
      );
    } else {
      const inTitle = words(spec.title);
      const shared = [...words(spec.subject)].filter((w) => inTitle.has(w));
      if (!shared.length) {
        fail(
          `the title "${spec.title.replace(/\n/g, ' / ')}" does not name its subject ` +
            `("${spec.subject}"). The first text a viewer reads has to tell them what they are ` +
            `watching — lead with the subject, then the story ("Life expectancy: / the gap that ` +
            `closed"). Nothing in the subtitle rescues a title that reads as a riddle.`,
        );
      }
    }

    /**
     * And it has to FIT. The title is 62px display inside the 960px portrait
     * safe width. A plain character count is too crude here — "Eight different
     * cities." is 23 characters and 612px, while "$200,000 in 2000." is 17
     * characters and 534px, because digits and capitals are half again as wide
     * as an `i`. So width is estimated per character and calibrated against
     * those two measured frames.
     */
    const WIDE = /[A-Z0-9$@&%WwMm]/;
    const NARROW = /[ilftj.,;:'’!|]/;
    const emWidth = (line: string) =>
      [...line].reduce((sum, ch) => {
        if (ch === ' ') return sum + 0.25;
        if (NARROW.test(ch)) return sum + 0.28;
        if (WIDE.test(ch)) return sum + 0.62;
        return sum + 0.56;
      }, 0);

    const TITLE_PX = 62;
    const SAFE_PX = 960;
    for (const line of spec.title.split('\n')) {
      const px = Math.round(emWidth(line) * TITLE_PX);
      if (px > SAFE_PX) {
        fail(
          `the title line "${line}" is about ${px}px wide at 62px against a ${SAFE_PX}px safe ` +
            `width — it will wrap to a third line or run under the frame edge. Shorten it.`,
        );
      }
    }
  }

  /**
   * ---- the photograph needs its papers ----
   *
   * A backdrop is the one thing in a chart film that this project did not make,
   * so it is the one thing that can carry someone else's rights into a branded
   * film with a live waitlist behind it. The rule is public domain or CC0 only —
   * not because other free licences are worse, but because CC BY and CC BY-SA
   * oblige an attribution ON THE FRAME, and the single line of receipts under a
   * chart belongs to the data. scripts/chart-backdrop.ts enforces that at fetch
   * time and writes the licence to CREDITS.json; this re-checks it at render
   * time, because a file can be dropped into the folder by hand and a rule that
   * only runs at fetch time is a rule with a hole in it.
   */
  if (spec.backdrop) {
    const dir = join(ROOT, 'public', 'backdrops');
    const img = join(dir, spec.backdrop.file);
    const creditsPath = join(dir, 'CREDITS.json');
    if (!existsSync(img)) {
      fail(`backdrop "${spec.backdrop.file}" is not in public/backdrops — run: node scripts/chart-backdrop.ts --get ${spec.id} "File:…"`);
    } else if (!existsSync(creditsPath)) {
      fail('public/backdrops/CREDITS.json is missing — no backdrop has provenance');
    } else {
      const credits = JSON.parse(readFileSync(creditsPath, 'utf8')) as Record<string, {licence?: string; source?: string}>;
      const c = credits[spec.backdrop.file];
      if (!c) {
        fail(`backdrop "${spec.backdrop.file}" has no entry in CREDITS.json — a picture with no origin is no more publishable than a figure with none`);
      } else if (!/^(public domain|cc0|cc[- ]?0|no restrictions)/i.test(c.licence ?? '')) {
        fail(
          `backdrop "${spec.backdrop.file}" is licensed "${c.licence}". Only public domain and CC0 ` +
            `may sit under a MAG8 film — anything else obliges a credit on the frame.`,
        );
      } else if (!/^https?:\/\//.test(c.source ?? '')) {
        fail(`backdrop "${spec.backdrop.file}" has no source URL on file`);
      }
    }
    const s = spec.backdrop.strength;
    if (s !== undefined && (s < 0.04 || s > 0.25)) {
      fail(`backdrop strength ${s} is outside 0.04–0.25 — past a quarter the photograph competes with the lines, which are the point`);
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

  /**
   * ---- an author-chosen end date has to be the SUBJECT, not a preference ----
   *
   * `to` is the one option in this engine that can manufacture the exact defect
   * the format exists to police. The best-known chart in this genre was
   * fact-checked and lost on a WINDOW, not on a number, and an end date chosen
   * by the author is the shortest path to the same failure: stop a race on the
   * frame where a favoured line happens to lead and every value on screen is
   * still true.
   *
   * The comment in job.ts says "legitimate only when the window IS the
   * subject". A comment is an honour system, so this is the check: if a film
   * cuts its data short, the period it cuts to must be NAMED IN THE FILM'S OWN
   * COPY, where a viewer can see it and hold the author to it. A cut nobody is
   * told about fails.
   */
  const job = CHART_JOBS[spec.id] as {to?: string} | undefined;
  if (job?.to) {
    const year = job.to.slice(0, 4);
    const copy = `${spec.title} ${spec.subtitle ?? ''} ${spec.hook.question} ${spec.hook.kicker ?? ''}`;
    if (!copy.includes(year)) {
      fail(
        `the dataset is cut short at ${job.to}, but neither the title nor the subtitle names ${year}. ` +
          `An end date is legitimate only when the window IS the subject, and the viewer has to be told ` +
          `which window they are looking at — otherwise a race can be stopped on a flattering frame with ` +
          `every value on screen still true.`,
      );
    } else {
      warn(
        `window deliberately cut at ${job.to} — later observations exist and are excluded. The copy names ` +
          `${year}, so the viewer is told. Check that the period is the subject and not a preference.`,
      );
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
