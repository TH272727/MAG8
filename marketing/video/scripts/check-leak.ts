/**
 * White-label gate for film sources: everything under src/ must speak the
 * public lens vocabulary only (scout / fundamentals / macro / consensus /
 * compile / verify). Pattern mirrors the repo-wide leak probe in /CLAUDE.md.
 * Gate for ANY change to films: run before rendering or publishing.
 * Run: node scripts/check-leak.ts   (exit 1 on any hit)
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEAK =
  /stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b/i;

const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css|json|html|svg|txt|md)$/i.test(name)) files.push(p);
  }
};
walk(join(ROOT, 'src'));

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
