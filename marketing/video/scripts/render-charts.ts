/**
 * Render every chart film (or the ones named), driven off the registry rather
 * than a hand-kept list in package.json — adding a chart should not mean
 * editing four files.
 *
 *   node scripts/render-charts.ts            → all
 *   node scripts/render-charts.ts mag7-10k   → one
 *
 * Runs the honesty gate first and REFUSES to render a chart that fails it. A
 * render is 966 screenshots; finding out afterwards that the window was wrong
 * is the expensive order to do this in.
 */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHART_IDS, compIdOf} from '../src/charts/jobs.ts';
import {CHART_BATCH_SIZE, relative, resolveChartOut} from './chart-out.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = wanted.length ? wanted : CHART_IDS;

const verify = spawnSync(process.execPath, [join(ROOT, 'scripts', 'chart-verify.ts'), ...ids], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (verify.status !== 0) {
  console.error('\nthe honesty gate failed — nothing rendered');
  process.exit(1);
}

for (const id of ids) {
  const comp = compIdOf(id);
  // Chart films are filed into 25-film batch folders (one YouTube drag each) —
  // resolved BEFORE the render so the folder exists and the log says where the
  // file is going, not where it went.
  const dest = resolveChartOut(id);
  const rel = relative(dest.path);
  console.log(`\nrendering ${comp} → ${rel} …`);
  // `shell: true` is not optional here: spawning npx.cmd directly on Windows
  // returned status 0 having rendered NOTHING — a silent success that produced
  // no file, which is the worst failure mode a build step can have.
  const res = spawnSync(`npx remotion render ${comp} "${rel}"`, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (res.status !== 0) {
    console.error(`\n${comp} did not render (status ${res.status})`);
    process.exit(res.status ?? 1);
  }
  if (!existsSync(dest.path)) {
    console.error(`\n${comp} reported success but wrote no file`);
    process.exit(1);
  }
  const full = dest.slot >= CHART_BATCH_SIZE;
  console.log(
    `  filed in ${dest.batch.name} (${dest.slot}/${CHART_BATCH_SIZE})` +
      (full ? ' — FULL, ready to drag into YouTube; the next chart opens a new folder' : ''),
  );

  // Music goes on here rather than being left to the operator. The composition
  // is silent (see Root.tsx), so a film that skipped this step would be posted
  // in silence next to twenty-six that are not — and the failure is invisible
  // in every still and every frame check this project runs.
  const music = spawnSync(process.execPath, [join(ROOT, 'scripts', 'chart-music.ts'), id], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (music.status !== 0) {
    console.error(`\n${comp} rendered but could not be scored (status ${music.status})`);
    process.exit(music.status ?? 1);
  }
}
