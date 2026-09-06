/**
 * Where a chart film is written, and how the folders fill.
 *
 * OWNER RULE (2026-09-05): chart films live apart from the other marketing
 * films, in numbered batch folders holding at most 25 videos each. The number
 * is not arbitrary — YouTube's upload dialog takes 25 files in one drag, so a
 * full folder is exactly one drag and there is never a batch to count out by
 * hand. When a folder fills, the next one is created; nothing is ever moved
 * between folders afterwards, because a folder that has already been dragged
 * must keep meaning what it meant that day.
 *
 *   out/charts/batch-01/chart-<id>.mp4
 *   out/charts/batch-02/…
 *
 * A RE-RENDER IS NOT A NEW FILM. If `chart-<id>.mp4` already exists in any
 * batch, it re-renders in place — otherwise fixing a typo in an old chart would
 * consume a slot in the current folder and leave two copies of one film to
 * upload.
 */
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** One YouTube drag. Changing this does not re-file anything already written. */
export const CHART_BATCH_SIZE = 25;

export const CHARTS_DIR = join(ROOT, 'out', 'charts');

const batchName = (n: number) => `batch-${String(n).padStart(2, '0')}`;
const batchNumber = (name: string) => {
  const m = /^batch-(\d+)$/.exec(name);
  return m ? Number(m[1]) : null;
};

export type Batch = {n: number; name: string; dir: string; films: string[]};

/** Every batch folder that exists, in order, with the films each holds. */
export const batches = (): Batch[] => {
  if (!existsSync(CHARTS_DIR)) return [];
  return readdirSync(CHARTS_DIR, {withFileTypes: true})
    .filter((e) => e.isDirectory() && batchNumber(e.name) !== null)
    .map((e) => {
      const dir = join(CHARTS_DIR, e.name);
      return {
        n: batchNumber(e.name) as number,
        name: e.name,
        dir,
        films: readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4')).sort(),
      };
    })
    .sort((a, b) => a.n - b.n);
};

/** `chart-<id>.mp4` → the batch already holding it, if any. */
export const batchHolding = (file: string): Batch | null =>
  batches().find((b) => b.films.includes(file)) ?? null;

/**
 * The path this chart should render to, creating the folder if needed.
 * Returns the absolute path plus the batch it landed in and how full that
 * batch now is, so the driver can say where the file went.
 */
export const resolveChartOut = (id: string): {file: string; path: string; batch: Batch; slot: number} => {
  const file = `chart-${id}.mp4`;

  const held = batchHolding(file);
  if (held) {
    return {file, path: join(held.dir, file), batch: held, slot: held.films.indexOf(file) + 1};
  }

  const all = batches();
  const open = all.length && all[all.length - 1].films.length < CHART_BATCH_SIZE ? all[all.length - 1] : null;
  const target = open ?? {
    n: (all.length ? all[all.length - 1].n : 0) + 1,
    name: batchName((all.length ? all[all.length - 1].n : 0) + 1),
    dir: join(CHARTS_DIR, batchName((all.length ? all[all.length - 1].n : 0) + 1)),
    films: [] as string[],
  };
  mkdirSync(target.dir, {recursive: true});
  return {file, path: join(target.dir, file), batch: target, slot: target.films.length + 1};
};

/** Path relative to marketing/video, for printing and for remotion's argv. */
export const relative = (path: string) => path.slice(ROOT.length + 1).split('\\').join('/');

/* ------------------------------ `chart:made` ------------------------------ */

if (process.argv[1] && process.argv[1].endsWith('chart-out.ts')) {
  const all = batches();
  if (!all.length) {
    console.log('no chart films yet — out/charts/ is empty');
  }
  let total = 0;
  for (const b of all) {
    total += b.films.length;
    const full = b.films.length >= CHART_BATCH_SIZE ? '  FULL — ready to drag' : '';
    console.log(`\n${b.name}  ${b.films.length}/${CHART_BATCH_SIZE}${full}`);
    for (const f of b.films) console.log(`  ${f.replace(/^chart-|\.mp4$/g, '')}`);
  }
  console.log(`\n${total} chart film(s) across ${all.length} batch folder(s).`);
  console.log('Read this list BEFORE brainstorming — a new chart has to be a story none of these told.');
}
