/**
 * Fetch a chart film's backdrop photograph from Wikimedia Commons.
 *
 *   node scripts/chart-backdrop.ts --find "empty times square 2020"
 *   node scripts/chart-backdrop.ts --get pizza-day "File:Pizza slice (1).jpg"
 *
 * WHY A SCRIPT AND NOT A DOWNLOAD. Three things have to be true of a photograph
 * that sits under a MAG8 film, and none of them survives being done by hand:
 *
 * 1. THE LICENCE. This is a real financial product with a live waitlist, not a
 *    mood board, so the only licences accepted here are PUBLIC DOMAIN and CC0.
 *    That is deliberately stricter than "free to use": CC BY and CC BY-SA are
 *    free too, and both oblige an attribution that would have to appear ON THE
 *    FRAME. A chart film has one small line of receipts and it belongs to the
 *    data. Refusing anything but PD/CC0 is what keeps that line honest and the
 *    frame clean, so the check is in code rather than in someone's memory.
 * 2. THE PROVENANCE. What was downloaded, from where, by whom, under what, on
 *    what day — written to public/backdrops/CREDITS.json next to the file. A
 *    picture with no origin is no more publishable than a figure with none.
 * 3. THE FREEZE. The render never fetches. The image is committed like the
 *    frozen datasets are, so a re-render in a year is the same film.
 *
 * WHAT TO ACTUALLY SEARCH FOR (owner's verdict on the first three backdrops, and now a
 * rule): a SCENE, not a product shot. The Tokyo skyline and the trading floor were
 * "general enough, but relevant enough"; a studio close-up of a pizza slice was the
 * weakest of the three and wanted "a more general photo like a pizza delivery man".
 * At fifteen percent opacity behind a scrim, a place with people and depth in it still
 * reads as a photograph; an object on a white sweep has nothing for the eye to resolve
 * and reads as a smudge. Search for the story's WORLD — a street, a floor, a skyline,
 * a queue — rather than the story's noun. Add `filetype:bitmap` or Commons will hand
 * you twenty scanned PDFs whose text happens to contain the words.
 *
 * Keyless and free, like every other source in this pipeline.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'backdrops');
const CREDITS = join(OUT_DIR, 'CREDITS.json');
const UA = 'Mag8/1.0 (research desk; +https://themag8.com)';
const API = 'https://commons.wikimedia.org/w/api.php';

/** The only licences a MAG8 film may carry under it. See the note above. */
const ALLOWED = [/^public domain$/i, /^cc0$/i, /^cc[- ]?0/i, /^no restrictions$/i];

const strip = (s: string | undefined): string => (s ?? '').replace(/<[^>]*>/g, '').trim();

type Info = {
  title: string;
  licence: string;
  author: string;
  descriptionUrl: string;
  thumburl: string;
  width: number;
  height: number;
};

const readInfo = (page: any): Info | null => {
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata ?? {};
  return {
    title: page.title,
    licence: strip(m.LicenseShortName?.value) || '(none stated)',
    author: strip(m.Artist?.value) || '(unstated)',
    descriptionUrl: ii.descriptionurl ?? '',
    thumburl: ii.thumburl ?? ii.url,
    width: ii.width,
    height: ii.height,
  };
};

async function api(params: Record<string, string>): Promise<any> {
  const url = `${API}?${new URLSearchParams({...params, format: 'json'})}`;
  const res = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(30000)});
  if (!res.ok) throw new Error(`Commons API HTTP ${res.status}`);
  return res.json();
}

async function find(query: string) {
  const j = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: '1600',
  });
  const pages = Object.values(j?.query?.pages ?? {}) as any[];
  const rows = pages.map(readInfo).filter((r): r is Info => r !== null);
  const ok = rows.filter((r) => ALLOWED.some((re) => re.test(r.licence)));
  console.log(`\n${rows.length} result(s), ${ok.length} usable (public domain or CC0):\n`);
  for (const r of ok) {
    console.log(`  ${r.licence.padEnd(16)} ${String(r.width).padStart(5)}x${r.height}  ${r.title}`);
    console.log(`      by ${r.author}`);
  }
  const rejected = rows.filter((r) => !ok.includes(r));
  if (rejected.length) {
    console.log(`\n  rejected (licence would oblige an on-frame credit): ${[...new Set(rejected.map((r) => r.licence))].join(', ')}`);
  }
}

async function get(id: string, title: string) {
  const j = await api({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: '1600',
  });
  const pages = Object.values(j?.query?.pages ?? {}) as any[];
  const info = readInfo(pages[0]);
  if (!info) throw new Error(`Commons has no image called ${title}`);
  if (!ALLOWED.some((re) => re.test(info.licence))) {
    throw new Error(
      `"${info.title}" is ${info.licence}. Only public domain and CC0 are accepted — anything ` +
        `else obliges an attribution on the frame, and the one line of receipts on a chart film ` +
        `belongs to the data. Pick another image.`,
    );
  }
  const res = await fetch(info.thumburl, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(45000)});
  if (!res.ok) throw new Error(`image download HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 20000) throw new Error(`only ${bytes.length} bytes came back — that is not the photograph`);
  mkdirSync(OUT_DIR, {recursive: true});
  const file = `${id}.jpg`;
  writeFileSync(join(OUT_DIR, file), bytes);

  const credits = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, 'utf8')) : {};
  credits[file] = {
    chart: id,
    title: info.title,
    author: info.author,
    licence: info.licence,
    source: info.descriptionUrl,
    fetchedAt: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);

  console.log(`\n  ${info.title}`);
  console.log(`  ${info.licence} · by ${info.author}`);
  console.log(`  ${(bytes.length / 1024).toFixed(0)} KB → public/backdrops/${file}`);
  console.log(`  provenance recorded in public/backdrops/CREDITS.json\n`);
}

const args = process.argv.slice(2);
if (args[0] === '--find') {
  await find(args.slice(1).join(' '));
} else if (args[0] === '--get') {
  await get(args[1], args.slice(2).join(' '));
} else {
  console.log('usage: chart-backdrop.ts --find "<query>" | --get <chart-id> "File:<name>"');
  process.exit(1);
}
