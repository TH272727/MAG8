/**
 * Freeze a chart's numbers into src/charts/data/<id>.data.ts.
 *
 *   node scripts/chart-fetch.ts             → every chart
 *   node scripts/chart-fetch.ts mag7-10k    → one
 *   node scripts/chart-fetch.ts mag7-10k --dry   → fetch + report, write nothing
 *
 * Renders never fetch. This script is the only thing that touches the network,
 * so a film re-rendered next year is byte-identical to the one published today
 * and the source line on screen describes a file that actually exists.
 *
 * Both sources are keyless and free, and each wants the OPPOSITE User-Agent —
 * Yahoo rejects anonymous clients, FRED hangs on a spoofed browser one. That is
 * not a typo, it is written down twice in the product's own data layer.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHART_JOBS} from '../src/charts/jobs.ts';
import {DIVIDEND_CLAUSE, FRED_SCALES} from '../src/charts/job.ts';
import type {FetchJob, FredJob, MixedJob, YahooJob} from '../src/charts/job.ts';
import type {ChartData} from '../src/charts/spec.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'charts', 'data');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const wanted = args.filter((a) => !a.startsWith('--'));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

/* ------------------------------- transports ------------------------------- */

async function getText(url: string, headers: Record<string, string>): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(600 * attempt);
    try {
      const res = await fetch(url, {headers, signal: AbortSignal.timeout(20000)});
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} (transient)`);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err instanceof Error && /^HTTP \d+$/.test(err.message)) throw err;
    }
  }
  const cause = lastErr instanceof Error && lastErr.cause instanceof Error ? ` (${lastErr.cause.message})` : '';
  throw new Error(`${lastErr instanceof Error ? lastErr.message : String(lastErr)}${cause}`);
}

/** Yahoo v8 — adjusted closes, the same endpoint the rotation board reads. */
async function yahooSeries(symbol: string, range: string, interval: string) {
  const sym = symbol.toUpperCase().replace(/\./g, '-');
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}` +
    `?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const body = await getText(url, {'User-Agent': 'Mozilla/5.0', Accept: 'application/json'});
  const parsed = JSON.parse(body);
  const res = parsed?.chart?.result?.[0];
  if (!res) throw new Error(parsed?.chart?.error?.description ?? 'no result in the response');
  const stamps: number[] = res.timestamp ?? [];
  const adj: (number | null)[] | undefined = res.indicators?.adjclose?.[0]?.adjclose;
  const raw: (number | null)[] | undefined = res.indicators?.quote?.[0]?.close;
  const values = adj ?? raw;
  if (!values || values.length !== stamps.length) throw new Error('price array did not line up with the date array');
  /**
   * A BAR IS DATED IN ITS OWN EXCHANGE'S TIME, NOT IN UTC.
   *
   * Yahoo stamps each bar at the start of its period in local market time, and
   * `new Date(...).toISOString()` then reads it in UTC. For New York that
   * changes nothing. For Tokyo it moves the stamp BACKWARDS across midnight:
   * the Nikkei's October 1986 bar arrives as 1986-09-30, and month-bucketing
   * files it under September — an entire foreign series shifted one month
   * against its peers, for its whole history, with every value real and nothing
   * anywhere saying so. It is the same family as the duplicate live month bar,
   * and it is silent in exactly the same way.
   *
   * The response carries the offset it was written with, so use it. Every
   * already-published film is US-listed, where the offset changes no date.
   */
  const gmtoffset = Number(res.meta?.gmtoffset ?? 0);
  const localIso = (unixSeconds: number) => iso(unixSeconds + gmtoffset);
  const out = new Map<string, number>();
  for (let i = 0; i < stamps.length; i++) {
    const v = values[i];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out.set(localIso(stamps[i]), v);
  }
  if (!out.size) throw new Error('no usable closes in the response');
  const points = interval === '1mo' ? oneRowPerMonth(out) : out;
  assertCadence(sym, [...points.keys()], interval);
  return {points, adjusted: Boolean(adj)};
}

/**
 * ONE POINT PER MONTH, and the freshest one.
 *
 * Asked for monthly bars, Yahoo returns the month bars AND a live bar stamped
 * with today — so the current month arrives TWICE, three days apart. On the x
 * axis those two readings are a full month-step apart like every other pair, so
 * the last segment of the film draws three days of movement across a month of
 * width: the axis, whose entire job in this format is to represent time
 * passing, quietly misstates its own final step. It is the window defect in
 * miniature, and it is silent — every value is real and every line has the same
 * extra point.
 *
 * The month keeps its freshest reading and is stamped at the month start, which
 * is what the on-screen note ("the final point is the current month in
 * progress") already promises.
 */
function oneRowPerMonth(points: Map<string, number>): Map<string, number> {
  const byMonth = new Map<string, {day: string; v: number}>();
  for (const [day, v] of points) {
    const month = day.slice(0, 7);
    const held = byMonth.get(month);
    if (!held || day > held.day) byMonth.set(month, {day, v});
  }
  return new Map([...byMonth.entries()].sort().map(([m, r]) => [`${m}-01`, r.v]));
}

/**
 * Yahoo SILENTLY COARSENS the interval when the requested range is long enough:
 * ask `range=max&interval=1mo` and a symbol listed in 1980 comes back QUARTERLY
 * while one listed in 1999 comes back monthly — same request, same response
 * shape, no error, no field saying so. Aligned on date against its neighbours,
 * the coarsened symbol then has two holes in every three months and its line
 * draws as a series of long straight chords through a field of curves.
 *
 * Found by reading the frozen output, not by any test: AAPL and MSFT were each
 * missing 114 of 173 months while the other six were complete. So the response
 * is measured rather than trusted — the median gap between stamps must match
 * the cadence that was asked for.
 */
function assertCadence(symbol: string, dates: string[], interval: string) {
  if (dates.length < 8) return;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86400000);
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const band: Record<string, [number, number]> = {'1d': [1, 5], '1wk': [6, 8], '1mo': [26, 33]};
  const want = band[interval];
  if (!want) return;
  if (median < want[0] || median > want[1]) {
    throw new Error(
      `${symbol}: asked for ${interval} bars and got a median gap of ${median} days — ` +
        `the source downgraded the cadence for this symbol. Use an explicit range ` +
        `('15y', '20y') instead of 'max', which triggers this per symbol.`,
    );
  }
}

/** FRED graph CSV — keyless, and it wants an HONEST agent string. */
async function fredSeries(id: string) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;
  const csv = await getText(url, {
    'User-Agent': 'Mag8/1.0 (research desk; +https://themag8.com)',
    Accept: 'text/csv',
  });
  const lines = csv.trim().split(/\r?\n/);
  const out = new Map<string, number>();
  let blanks = 0;
  for (const line of lines.slice(1)) {
    const [d, raw] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) continue;
    // A gap is marked EITHER by "." or by nothing at all, and the difference is
    // not cosmetic: Number(".") is NaN and gets skipped, but **Number("") is 0**
    // and sails through Number.isFinite as a real reading of zero. CPIAUCSL
    // ships `2025-10-01,` — the index that month was never published — and read
    // as a zero it rebased to MINUS ONE HUNDRED PERCENT and drew consumer
    // prices falling off the bottom of the plot. Require a numeral.
    if (!/^-?\d+(\.\d+)?$/.test((raw ?? '').trim())) {
      if ((raw ?? '').trim() === '') blanks++;
      continue;
    }
    out.set(d, Number(raw));
  }
  if (blanks) console.log(`  ${id}: ${blanks} blank observation(s) skipped (published as empty, not as ".")`);
  if (!out.size) throw new Error(`FRED ${id} returned no usable rows`);
  return out;
}

/**
 * Bitcoin's daily market price, from blockchain.com — keyless, and the only
 * free source that reaches back to the beginning.
 *
 * THE ZEROS ARE NOT PRICES. The series starts in January 2009 and reads 0.00
 * every day until 2010-08-18, because until then bitcoin had no market and
 * therefore no price. Read as numbers they are the blank-field trap in its
 * purest form — a rebase against a zero base is an infinity, and a rebase to a
 * zero LATER is minus one hundred percent. They are dropped here, which is also
 * what makes the window honest: the run can only begin on the first day a price
 * existed, and the film has to say so rather than implying a market that wasn't.
 */
async function bitcoinDaily(): Promise<Map<string, number>> {
  const url = 'https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false';
  const body = await getText(url, {
    'User-Agent': 'Mag8/1.0 (research desk; +https://themag8.com)',
    Accept: 'application/json',
  });
  const parsed = JSON.parse(body);
  const rows: {x: number; y: number}[] = parsed?.values ?? [];
  if (!rows.length) throw new Error('blockchain.com returned no price rows');
  const out = new Map<string, number>();
  let zeros = 0;
  for (const r of rows) {
    if (!Number.isFinite(r.y) || r.y <= 0) {
      zeros++;
      continue;
    }
    out.set(iso(r.x), r.y);
  }
  if (!out.size) throw new Error('every bitcoin row was zero or unusable');
  console.log(`  bitcoin  ${out.size} days with a price, ${zeros} earlier day(s) with no market at all`);
  return out;
}

/* -------------------------------- alignment ------------------------------- */

/**
 * Join on DATE, never by position. Two symbols can disagree about which days
 * exist (a holiday, a listing that started later, an index that trades when the
 * funds are shut) and a positional zip silently shifts one series against
 * another for the whole run — a bug this repo has already paid for once.
 */
function alignOnDate(
  cols: {key: string; points: Map<string, number>}[],
  from?: string,
  to?: string,
): {dates: string[]; series: {key: string; values: (number | null)[]}[]} {
  const all = new Set<string>();
  for (const c of cols) for (const d of c.points.keys()) all.add(d);
  const dates = [...all]
    .sort()
    .filter((d) => (!from || d >= from) && (!to || d <= to));
  return {
    dates,
    series: cols.map((c) => ({key: c.key, values: dates.map((d) => c.points.get(d) ?? null)})),
  };
}

/** Keep only the months a slower publisher also reports on. */
function sampleDates(
  dates: string[],
  series: {key: string; values: (number | null)[]}[],
  mode: 'monthly' | 'quarterly' | 'annual',
) {
  const months = mode === 'annual' ? [1] : mode === 'quarterly' ? [1, 4, 7, 10] : null;
  if (!months) return {dates, series};
  const keep: number[] = [];
  dates.forEach((d, i) => {
    if (months.includes(Number(d.slice(5, 7)))) keep.push(i);
  });
  return {
    dates: keep.map((i) => dates[i]),
    series: series.map((s) => ({key: s.key, values: keep.map((i) => s.values[i])})),
  };
}

/** The first date at which EVERY series has a reading. The only honest base. */
function commonBase(dates: string[], series: {key: string; values: (number | null)[]}[]): number {
  for (let i = 0; i < dates.length; i++) {
    if (series.every((s) => s.values[i] !== null)) return i;
  }
  return -1;
}

/**
 * THE ONE THAT MATTERS. Trim the run to the last date on which every series
 * still has a reading.
 *
 * This is the defect that put the best-known chart in this genre in front of a
 * fact-checker: one series had fewer periods than the others, so when the
 * animation ran past its final observation the line simply stopped climbing —
 * and a line that stops climbing while its rivals keep going reads, to every
 * viewer, as the one that won. It is not a rendering bug. It is a data-window
 * bug, so it is fixed here, at the window, where nobody can style around it.
 *
 * Publishers disagree about how current they are by design (federal debt lands
 * a quarter behind the CPI); the cost of honesty is a couple of stale months at
 * the end, and the report says exactly how many were dropped.
 */
function trimToCommonEnd(dates: string[], series: {key: string; values: (number | null)[]}[]) {
  let end = dates.length - 1;
  while (end >= 0 && !series.every((s) => s.values[end] !== null)) end--;
  return {
    dates: dates.slice(0, end + 1),
    series: series.map((s) => ({key: s.key, values: s.values.slice(0, end + 1)})),
    dropped: dates.length - 1 - end,
    lastCommon: dates[end],
  };
}

function rebase(
  dates: string[],
  series: {key: string; values: (number | null)[]}[],
  mode: 'invested' | 'pctChange',
  principal: number,
) {
  const b = commonBase(dates, series);
  if (b === -1) {
    const missing = series
      .filter((s) => s.values.every((v) => v === null))
      .map((s) => s.key)
      .join(', ');
    throw new Error(
      `no date where every series has a reading${missing ? ` (empty: ${missing})` : ''} — ` +
        `a rebased comparison needs one shared start, and rebasing each line to its own ` +
        `first date is the comparison that gets charts fact-checked`,
    );
  }
  const trimmedDates = dates.slice(b);
  const out = series.map((s) => {
    const base = s.values[b] as number;
    return {
      key: s.key,
      values: s.values.slice(b).map((v) =>
        v === null ? null : mode === 'invested' ? (v / base) * principal : (v / base - 1) * 100,
      ),
    };
  });
  return {dates: trimmedDates, series: out, baseDate: dates[b]};
}

/* --------------------------------- drivers -------------------------------- */

async function runYahoo(id: string, job: YahooJob): Promise<ChartData> {
  const cols: {key: string; points: Map<string, number>}[] = [];
  let allAdjusted = true;
  for (const t of job.tickers) {
    const {points, adjusted} = await yahooSeries(t.symbol, job.range, job.interval);
    if (!adjusted) allAdjusted = false;
    cols.push({key: t.key, points});
    console.log(`  ${t.key.padEnd(8)} ${String(points.size).padStart(5)} bars${adjusted ? '' : '  (RAW closes)'}`);
    await sleep(350);
  }
  let {dates, series} = alignOnDate(cols, job.from, job.to);
  const notes: string[] = [];
  let method: string;

  const tail = trimToCommonEnd(dates, series);
  if (tail.dropped > 0) {
    dates = tail.dates;
    series = tail.series;
    console.log(`  tail: dropped ${tail.dropped} date(s) past ${tail.lastCommon} — not every line reaches them`);
    notes.push(`The run ends at ${tail.lastCommon}, the last date every line reports.`);
  }

  if (job.transform === 'raw') {
    method = 'Adjusted closing price, as filed.';
  } else {
    const principal = job.principal ?? 10000;
    const r = rebase(dates, series, job.transform, principal);
    dates = r.dates;
    series = r.series;
    const div = job.dividends ? DIVIDEND_CLAUSE[job.dividends] : '';
    method =
      job.transform === 'invested'
        ? `Value of $${principal.toLocaleString('en-US')} invested on ${r.baseDate}, held${div}.`
        : `Cumulative % change from ${r.baseDate}${div}.`;
    notes.push(`Every line starts on the same date (${r.baseDate}) at the same value.`);
  }

  if (!allAdjusted) notes.push('At least one series is UNADJUSTED — dividends are not reflected in it.');
  if (job.interval === '1mo') notes.push('The final point is the current month in progress, for every line alike.');

  return {
    id,
    fetchedAt: new Date().toISOString().slice(0, 10),
    sourceLabel: job.sourceLabel ?? 'Adjusted closes · Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com',
    method,
    dates,
    series,
    notes,
  };
}

async function runFred(id: string, job: FredJob): Promise<ChartData> {
  const cols: {key: string; points: Map<string, number>}[] = [];
  const conv = job.scale ? FRED_SCALES[job.scale] : null;
  for (const s of job.series) {
    let points = await fredSeries(s.id);
    if (conv) points = new Map([...points].map(([d, v]) => [d, v * conv.factor]));
    cols.push({key: s.key, points});
    console.log(`  ${s.key.padEnd(8)} ${String(points.size).padStart(5)} obs  (${s.id})`);
    await sleep(350);
  }
  let aligned = alignOnDate(cols, job.from, job.to);
  if (job.sample) aligned = sampleDates(aligned.dates, aligned.series, job.sample);
  let {dates, series} = aligned;
  const notes: string[] = [];
  let method = conv
    ? `Series as published, converted from ${conv.from} to ${conv.to}.`
    : 'Series as published, no adjustment.';

  const tail = trimToCommonEnd(dates, series);
  if (tail.dropped > 0) {
    dates = tail.dates;
    series = tail.series;
    console.log(`  tail: dropped ${tail.dropped} date(s) past ${tail.lastCommon} — not every line reaches them`);
    notes.push(`The run ends at ${tail.lastCommon}, the last date every series reports.`);
  }

  if (job.transform !== 'raw') {
    const principal = job.transform === 'invested' ? (job.principal ?? 10000) : 100;
    const r = rebase(dates, series, job.transform, principal);
    dates = r.dates;
    series = r.series;
    if (job.transform === 'invested') {
      const money = `$${principal.toLocaleString('en-US')}`;
      // Deliberately NOT "invested ... held": you do not hold an index, and a
      // house is not a security. The sentence says what the arithmetic did —
      // a sum tracked by a published index — and the spec's subtitle carries
      // what the index leaves out.
      method = `${money} tracked from ${r.baseDate} by the index as published.`;
      notes.push(`Every line starts on the same date (${r.baseDate}) at ${money}.`);
    } else {
      method = `Cumulative % change from ${r.baseDate}.`;
      notes.push(`Every line starts on the same date (${r.baseDate}) at zero.`);
    }
  }
  return {
    id,
    fetchedAt: new Date().toISOString().slice(0, 10),
    sourceLabel: job.sourceLabel ?? 'Federal Reserve Economic Data (FRED)',
    sourceUrl: `https://fred.stlouisfed.org/series/${job.series[0]?.id ?? ''}`,
    method,
    dates,
    series,
    notes,
  };
}

async function runMixed(id: string, job: MixedJob): Promise<ChartData> {
  const cols: {key: string; points: Map<string, number>}[] = [];
  const constants: string[] = [];
  let allAdjusted = true;

  for (const leg of job.legs) {
    if (leg.from === 'yahoo') {
      const {points, adjusted} = await yahooSeries(leg.symbol, job.range, job.interval);
      if (!adjusted) allAdjusted = false;
      cols.push({key: leg.key, points});
      console.log(`  ${leg.key.padEnd(8)} ${String(points.size).padStart(5)} bars  (${leg.symbol})`);
      await sleep(350);
    } else if (leg.from === 'bitcoin') {
      const daily = await bitcoinDaily();
      // Onto the same grid as the market legs BEFORE anything is compared: a
      // monthly bar's value is its month's last close, so the daily series
      // keeps its last reading of each month, stamped at the month start.
      const points = job.interval === '1mo' ? oneRowPerMonth(daily) : daily;
      cols.push({key: leg.key, points});
      console.log(`  ${leg.key.padEnd(8)} ${String(points.size).padStart(5)} points (blockchain.com)`);
    } else {
      constants.push(leg.key);
    }
  }

  let {dates, series} = alignOnDate(cols, job.from, job.to);
  const notes: string[] = [];

  // A constant is defined on every date there is, so it is filled after the
  // real legs have decided what the dates are — it can never widen the window.
  for (const key of constants) series.push({key, values: dates.map(() => 1)});

  const tail = trimToCommonEnd(dates, series);
  if (tail.dropped > 0) {
    dates = tail.dates;
    series = tail.series;
    console.log(`  tail: dropped ${tail.dropped} date(s) past ${tail.lastCommon} — not every line reaches them`);
    notes.push(`The run ends at ${tail.lastCommon}, the last date every line reports.`);
  }

  let method: string;
  if (job.transform === 'raw') {
    method = 'Closing prices, as published.';
  } else {
    const principal = job.principal ?? 10000;
    const r = rebase(dates, series, job.transform, principal);
    dates = r.dates;
    series = r.series;
    const div = job.dividends ? DIVIDEND_CLAUSE[job.dividends] : '';
    method =
      job.transform === 'invested'
        ? `Value of $${principal.toLocaleString('en-US')} put in on ${r.baseDate}, held${div}.`
        : `Cumulative % change from ${r.baseDate}${div}.`;
    notes.push(`Every line starts on the same date (${r.baseDate}) at the same value.`);
  }
  if (!allAdjusted) notes.push('At least one series is UNADJUSTED — dividends are not reflected in it.');
  if (job.interval === '1mo') notes.push('The final point is the current month in progress, for every line alike.');

  return {
    id,
    fetchedAt: new Date().toISOString().slice(0, 10),
    sourceLabel: job.sourceLabel,
    sourceUrl: job.sourceUrl,
    method,
    dates,
    series,
    notes,
  };
}

async function run(id: string, job: FetchJob): Promise<ChartData> {
  if (job.source === 'yahoo') return runYahoo(id, job);
  if (job.source === 'fred') return runFred(id, job);
  if (job.source === 'mixed') return runMixed(id, job);
  return {
    id,
    fetchedAt: new Date().toISOString().slice(0, 10),
    sourceLabel: job.sourceLabel,
    sourceUrl: job.sourceUrl,
    method: job.method,
    dates: job.dates,
    series: job.values,
    notes: job.notes ?? [],
  };
}

/* ---------------------------------- write --------------------------------- */

const emit = (data: ChartData): string => {
  const rows = data.series
    .map((s) => `    {key: ${JSON.stringify(s.key)}, values: [${s.values.map((v) => (v === null ? 'null' : Number(v.toFixed(6)))).join(', ')}]},`)
    .join('\n');
  return `/**
 * FROZEN DATA — generated by scripts/chart-fetch.ts. Do not edit by hand.
 * Re-pull with: node scripts/chart-fetch.ts ${data.id}
 */
import type {ChartData} from '../spec';

export const DATA: ChartData = {
  id: ${JSON.stringify(data.id)},
  fetchedAt: ${JSON.stringify(data.fetchedAt)},
  sourceLabel: ${JSON.stringify(data.sourceLabel)},
  sourceUrl: ${JSON.stringify(data.sourceUrl)},
  method: ${JSON.stringify(data.method)},
  notes: ${JSON.stringify(data.notes ?? [])},
  dates: [${data.dates.map((d) => JSON.stringify(d)).join(', ')}],
  series: [
${rows}
  ],
};
`;
};

const ids = wanted.length ? wanted : Object.keys(CHART_JOBS);
for (const id of ids) {
  const job = CHART_JOBS[id];
  if (!job) {
    console.error(`unknown chart "${id}" — known: ${Object.keys(CHART_JOBS).join(', ')}`);
    process.exit(1);
  }
  console.log(`\n${id} — ${job.source}`);
  const data = await run(id, job);
  const holes = data.series.reduce((n, s) => n + s.values.filter((v) => v === null).length, 0);
  console.log(
    `  → ${data.dates.length} dates × ${data.series.length} series` +
      `${holes ? `, ${holes} hole(s)` : ''}  [${data.dates[0]} → ${data.dates[data.dates.length - 1]}]`,
  );
  console.log(`  method: ${data.method}`);
  if (dry) continue;
  mkdirSync(OUT_DIR, {recursive: true});
  const out = join(OUT_DIR, `${id}.data.ts`);
  writeFileSync(out, emit(data), 'utf8');
  console.log(`  written: src/charts/data/${id}.data.ts`);
}
