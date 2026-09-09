/**
 * White-label gate for film sources: everything that can put text on a frame
 * must speak the public lens vocabulary only (scout / fundamentals / macro /
 * consensus / compile / verify). Pattern mirrors the repo-wide leak probe in
 * /CLAUDE.md. Gate for ANY change to films: run before rendering or publishing.
 * Run: node scripts/check-leak.ts   (exit 1 on any hit)
 *
 * IT WALKS TWO TREES, and the second one is why the extension list grew.
 * `../manim/scenes` holds Python scenes that render captions straight onto a
 * frame, and the original walker matched neither the directory nor `.py` — so
 * a caption there would have gone to screen without this gate ever seeing it.
 * The venv and the render scratch directory are skipped: a dependency's source
 * is not film copy, and scanning several thousand library files would bury a
 * real hit in noise.
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEAK =
  /stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b/i;

const SKIP = new Set(['.venv', '.work', 'node_modules', '__pycache__', 'media', 'out']);

const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css|json|html|svg|txt|md|py)$/i.test(name)) files.push(p);
  }
};
walk(join(ROOT, 'src'));

// The manim scene tree. Absent on a checkout that has not set it up, which is
// fine — but if the directory exists, every scene in it is film copy.
const MANIM = join(ROOT, '..', 'manim', 'scenes');
if (existsSync(MANIM)) walk(MANIM);

let hits = 0;
for (const f of files) {
  readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (LEAK.test(line)) {
        hits++;
        console.log(`${relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
      }
    });
}

if (hits) {
  console.error(`\nLEAK: ${hits} hit(s) — film sources must stay white-label.`);
  process.exit(1);
}
console.log(`clean — ${files.length} files scanned, 0 hits`);
