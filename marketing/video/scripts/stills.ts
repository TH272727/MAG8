/**
 * Key-frame stills + encode-path frame sequences for review WITHOUT a full render.
 * Bundles once, then renders straight from the bundle:
 *
 *   node scripts/stills.ts <CompId>              → 12 evenly spaced stills (fresh DOM per frame)
 *   node scripts/stills.ts <CompId> 30,300,800   → exact frames
 *   node scripts/stills.ts <CompId> seq 100-160  → sequential frames through the ENCODE path
 *                                                  (one reused DOM, concurrency 1) — the only way
 *                                                  to catch stuck-style bugs like the Kinetic
 *                                                  ghost-word (fresh stills can't reproduce them).
 *
 * Output: out/stills/<CompId>/f%06d.png   (seq → out/stills/<CompId>/seq-<from>-<to>/)
 * Run: node scripts/stills.ts …   (Node 24 strips types natively)
 */
import {mkdirSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderFrames, renderStill, selectComposition} from '@remotion/renderer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Keep in sync with remotion.config.ts — the programmatic API does not read it.
// System Chrome via chrome-for-testing: storage.googleapis.com is blackholed on
// this network (no headless-shell download) and Edge's headless is hollow.
const BROWSER = {
  browserExecutable: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  chromeMode: 'chrome-for-testing',
} as const;

const [compId, mode, range] = process.argv.slice(2);
if (!compId) {
  console.error('usage: node scripts/stills.ts <CompId> [f1,f2,… | seq <from>-<to>]');
  process.exit(1);
}

console.log('bundling src/index.ts …');
const serveUrl = await bundle({entryPoint: join(ROOT, 'src', 'index.ts')});
const composition = await selectComposition({serveUrl, id: compId, ...BROWSER});
const last = composition.durationInFrames - 1;
console.log(`${compId}: ${composition.durationInFrames}f @ ${composition.fps}fps, ${composition.width}×${composition.height}`);

if (mode === 'seq') {
  const m = /^(\d+)-(\d+)$/.exec(range ?? '');
  if (!m) {
    console.error('seq needs <from>-<to>, e.g. seq 100-160');
    process.exit(1);
  }
  const from = Math.min(Number(m[1]), last);
  const to = Math.max(from, Math.min(Number(m[2]), last));
  const outputDir = join(ROOT, 'out', 'stills', compId, `seq-${from}-${to}`);
  rmSync(outputDir, {recursive: true, force: true});
  mkdirSync(outputDir, {recursive: true});
  await renderFrames({
    composition,
    serveUrl,
    outputDir,
    imageFormat: 'png',
    frameRange: [from, to],
    concurrency: 1, // one page, strictly sequential — the DOM-reuse path
    onStart: () => console.log(`encode-path frames ${from}–${to} …`),
    onFrameUpdate: (n) => {
      if (n % 30 === 0) console.log(`  ${n}/${to - from + 1}`);
    },
    ...BROWSER,
  });
  console.log(`done → ${outputDir}`);
} else {
  const frames = mode
    ? mode.split(',').map((s) => Math.max(0, Math.min(Number(s.trim()), last)))
    : Array.from({length: 12}, (_, i) => Math.round(((i + 0.5) / 12) * last));
  const outDir = join(ROOT, 'out', 'stills', compId);
  mkdirSync(outDir, {recursive: true});
  for (const frame of frames) {
    const output = join(outDir, `f${String(frame).padStart(6, '0')}.png`);
    await renderStill({composition, serveUrl, output, frame, imageFormat: 'png', ...BROWSER});
    console.log(`still → ${output}`);
  }
}
