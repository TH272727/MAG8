/**
 * Music for the chart films.
 *
 * Chart films used to carry the same thing every other film here carries: a
 * procedural score synthesised by `scripts/gen-score-chart.ts` — no samples, no
 * assets, no spend, a tick on every year boundary so the ear learns the passage
 * of time the way the big date teaches it to the eye. It is a good score for a
 * film someone chose to press play on, and it does not survive a feed. The
 * owner supplied licensed music instead (2026-09-07) and asked for that to be
 * the only sound in these films, so the synthetic bed is unwired in Root.tsx
 * and this script puts the real music on.
 *
 * TWO STAGES, deliberately separate:
 *
 *   --extract   pull the audio out of the source videos in music/sources/,
 *               normalise nothing, and record where the best window sits.
 *               Runs once per new source. Writes music/library.json.
 *
 *   (default)   assign a track to every rendered chart film and mux it on.
 *               Idempotent — re-running does not change any film's music.
 *
 * WHY POST-RENDER RATHER THAN A REMOTION <Audio>: a render is 690 frames and
 * takes minutes; the music is a container-level operation that takes about a
 * second and never touches a pixel. Baking it into the composition would mean
 * re-rendering twenty-six finished films to change a bed, and would put an
 * audio decision inside the pipeline whose gates are all about the honesty of
 * the numbers. The video stream is STREAM-COPIED, never re-encoded, so the
 * picture in the film after this step is bit-for-bit the picture that came out
 * of the renderer.
 *
 * THE ASSIGNMENT IS RANDOM ONCE, THEN FIXED FOREVER. `music/assignments.json`
 * is committed and append-only in spirit: a film that already has a track keeps
 * it, because a film that has been posted must keep sounding like itself, and
 * re-rolling on every run would mean the copy on YouTube and the copy in the
 * folder are different videos. New films take the least-used track, so the
 * spread stays even as the batch fills. `--reroll <id>` is the deliberate
 * override.
 *
 * ALL EXISTING SOUND IS DISCARDED. The mux maps `0:v` and the new `1:a` only,
 * so whatever audio a film arrived with is gone — which is the point, and also
 * why the operation is safe to repeat on a film that has already been scored.
 *
 * LICENSING is the owner's, recorded per track in library.json and not checked
 * here. The chart films go out on YouTube, TikTok, Instagram and Facebook, all
 * of which run Content ID; a track nobody licensed does not fail this script,
 * it fails on the platform, days later, as a claim.
 *
 *   node scripts/chart-music.ts --extract        # build the library
 *   node scripts/chart-music.ts                  # score every chart film
 *   node scripts/chart-music.ts mag7-10k         # just this one
 *   node scripts/chart-music.ts --reroll pizza-day
 *   node scripts/chart-music.ts --list           # who got what
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {batches} from './chart-out.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MUSIC_DIR = join(ROOT, 'music');
const SOURCES_DIR = join(MUSIC_DIR, 'sources');
const LIBRARY = join(MUSIC_DIR, 'library.json');
const ASSIGNMENTS = join(MUSIC_DIR, 'assignments.json');

/** Loudness target. -14 LUFS is what the streaming platforms normalise to, and
 *  there is no voiceover to duck under, so the music sits at full music level. */
const TARGET_LUFS = -14;
const TRUE_PEAK = -1.5;
/** Long enough not to click, short enough not to waste the opening. */
const FADE_IN = 0.4;
/** The film ends on the final data point; the music should land, not be cut. */
const FADE_OUT = 1.5;

type Track = {
  id: string;
  file: string;
  /** The source video it came out of, kept so a track can always be traced. */
  source: string;
  /** Seconds of audio available. */
  duration: number;
  /** Where the excerpt starts — chosen by energy, see pickWindow(). */
  offset: number;
  /** Owner's note on where the music is from and what licence covers it. */
  licence: string;
};

type Library = {tracks: Track[]};
type Assignments = Record<string, string>;

/* --------------------------------- shell --------------------------------- */

const ff = (args: string[]): string => {
  // ffmpeg writes everything interesting to stderr — volumedetect's mean level,
  // loudnorm's measurement JSON, all of it. execFileSync hands back stdout
  // ALONE, which silently returns an empty string for every measurement this
  // script makes and made all eight tracks report their loudest passage at
  // 0s. spawnSync is used purely to get both streams.
  const res = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  return `${res.stdout ?? ''}${res.stderr ?? ''}`;
};

const ffprobe = (args: string[]): string =>
  execFileSync('ffprobe', ['-v', 'error', ...args], {encoding: 'utf8'}).trim();

/**
 * First number in an ffprobe reading.
 *
 * `-of csv=p=0` on a single field still emits the field SEPARATOR, so a video
 * stream 23 seconds long comes back as the string "23.000000," and `Number()`
 * of that is NaN — which then travelled all the way into ffmpeg as `-t NaN`
 * and surfaced as loudnorm "reporting nothing measurable", three steps from
 * the actual fault. Parse the number out rather than trusting the shape.
 */
const probeNumber = (args: string[]): number => {
  const raw = ffprobe(args);
  const m = /-?\d+(?:\.\d+)?/.exec(raw);
  if (!m) throw new Error(`ffprobe returned no number: ${JSON.stringify(raw)}`);
  return Number(m[0]);
};

const durationOf = (path: string): number =>
  probeNumber(['-show_entries', 'format=duration', '-of', 'default=nw=1', path]);

/**
 * How long the PICTURE runs.
 *
 * Not the same as the container's duration: a chart film rendered with the old
 * procedural score is 23.000s of video under 23.061s of audio, and the format
 * reports the longer of the two. Measuring the film that way put the music's
 * fade-out 0.06s past the last frame, so it was still fading when the picture
 * stopped. The video stream is the film.
 */
const videoDurationOf = (path: string): number =>
  probeNumber(['-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'default=nw=1', path]);

const hasAudio = (path: string): boolean =>
  ffprobe(['-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path]).length > 0;

/* ------------------------------- the library ------------------------------ */

const readLibrary = (): Library =>
  existsSync(LIBRARY) ? JSON.parse(readFileSync(LIBRARY, 'utf8')) : {tracks: []};

const readAssignments = (): Assignments =>
  existsSync(ASSIGNMENTS) ? JSON.parse(readFileSync(ASSIGNMENTS, 'utf8')) : {};

const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

/**
 * Mean volume of one window, in dBFS. `volumedetect` reports over whatever it
 * is fed, so the window is cut first and the filter reads only that.
 */
const windowLoudness = (path: string, start: number, length: number): number => {
  const out = ff([
    '-ss', String(start),
    '-t', String(length),
    '-i', path,
    '-map', '0:a:0',
    '-af', 'volumedetect',
    '-f', 'null',
    '-',
  ]);
  const m = /mean_volume:\s*(-?\d+(?:\.\d+)?) dB/.exec(out);
  return m ? Number(m[1]) : -Infinity;
};

/**
 * Where to start the excerpt.
 *
 * A track's opening is usually its quietest part — an intro, a single
 * instrument, a count-in — and a twenty-three second film that opens there
 * spends a third of its runtime on the least interesting bar of the music. So
 * the window is chosen by energy: the loudest run of `length` seconds is where
 * the arrangement is fullest, which is nearly always the part a listener would
 * recognise. Deterministic, and recorded in library.json so it never moves.
 *
 * Tracks shorter than the film start at zero and are looped at mux time.
 */
const pickWindow = (path: string, duration: number, length: number): number => {
  if (duration <= length + 1) return 0;
  const step = 5;
  let best = 0;
  let bestDb = -Infinity;
  // Leave the last window's worth of the track reachable but stop before the
  // outro fade, which is loud in arrangement and quiet in level.
  for (let start = 0; start + length <= duration; start += step) {
    const db = windowLoudness(path, start, length);
    if (db > bestDb) {
      bestDb = db;
      best = start;
    }
  }
  return best;
};

const extract = (filmLength: number) => {
  if (!existsSync(SOURCES_DIR)) {
    console.error(`no source videos — put them in ${SOURCES_DIR.slice(ROOT.length + 1)}`);
    process.exit(1);
  }
  const sources = readdirSync(SOURCES_DIR)
    .filter((f) => /\.(mp4|mov|mkv|webm|m4a|mp3|wav)$/i.test(f))
    .sort();
  if (!sources.length) {
    console.error(`no source videos in ${SOURCES_DIR.slice(ROOT.length + 1)}`);
    process.exit(1);
  }

  const existing = readLibrary();
  const bySource = new Map(existing.tracks.map((t) => [t.source, t]));
  const tracks: Track[] = [];

  for (const source of sources) {
    const srcPath = join(SOURCES_DIR, source);
    if (!hasAudio(srcPath)) {
      console.log(`  ${source} — no audio stream, skipped`);
      continue;
    }
    const id = source.replace(/\.[^.]+$/, '');
    const file = `${id}.m4a`;
    const out = join(MUSIC_DIR, file);

    // The source audio is already AAC in an mp4; copying it out rather than
    // re-encoding keeps the only generation loss in this whole chain at the
    // single encode the mux does.
    ff(['-y', '-i', srcPath, '-map', '0:a:0', '-c:a', 'copy', '-movflags', '+faststart', out]);

    const duration = durationOf(out);
    const prior = bySource.get(source);
    // An offset already chosen is kept — re-extracting must not silently move
    // the excerpt under films that have already been scored with it.
    const offset = prior ? prior.offset : pickWindow(out, duration, filmLength);

    tracks.push({
      id,
      file,
      source,
      duration: Number(duration.toFixed(3)),
      offset,
      licence: prior?.licence ?? 'owner-supplied — licensed or royalty-free',
    });
    console.log(
      `  ${id}  ${duration.toFixed(1)}s  → excerpt from ${offset}s` +
        (duration <= filmLength ? '  (shorter than the film — will loop)' : ''),
    );
  }

  writeJson(LIBRARY, {tracks});
  console.log(`\n${tracks.length} track(s) → ${LIBRARY.slice(ROOT.length + 1)}`);
};

/* ------------------------------ the assignment ---------------------------- */

/** FNV-1a. Only used to shuffle deterministically and to break ties. */
const hash = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

/**
 * Give every film a track, changing nothing that already has one.
 *
 * Films are considered in hash order rather than alphabetical, so the spread
 * across the library does not follow the batch listing, and each unassigned
 * film takes whichever track is currently least used — which keeps twenty-six
 * films over eight tracks at three or four each instead of letting a plain hash
 * clump five onto one track and none onto another.
 */
const assign = (films: string[], tracks: Track[], current: Assignments): Assignments => {
  const next: Assignments = {...current};
  const known = new Set(tracks.map((t) => t.id));
  // A track deleted from the library releases its films rather than pinning
  // them to a file that is no longer there.
  for (const [film, track] of Object.entries(next)) {
    if (!known.has(track)) delete next[film];
  }

  const uses = new Map(tracks.map((t) => [t.id, 0]));
  for (const track of Object.values(next)) uses.set(track, (uses.get(track) ?? 0) + 1);

  const pending = films.filter((f) => !next[f]).sort((a, b) => hash(a) - hash(b));
  for (const film of pending) {
    const pick = [...tracks].sort((a, b) => {
      const d = (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0);
      return d !== 0 ? d : hash(`${film}:${a.id}`) - hash(`${film}:${b.id}`);
    })[0];
    next[film] = pick.id;
    uses.set(pick.id, (uses.get(pick.id) ?? 0) + 1);
  }
  return next;
};

/* --------------------------------- the mux -------------------------------- */

/**
 * Measure, then apply. Single-pass loudnorm works from a running estimate and
 * pumps audibly on a short excerpt; two-pass measures the whole clip first and
 * applies one fixed correction, so twenty-six films come out at the same level
 * rather than merely near it.
 */
const measure = (track: Track, start: number, length: number, chain: string) => {
  const out = ff([
    '-ss', String(start),
    '-t', String(length),
    '-i', join(MUSIC_DIR, track.file),
    '-map', '0:a:0',
    '-af', `${chain},loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK}:LRA=11:print_format=json`,
    '-f', 'null',
    '-',
  ]);
  const m = /\{[^{}]*"input_i"[\s\S]*?\}/.exec(out);
  if (!m) throw new Error(`loudnorm reported nothing measurable for ${track.id}`);
  return JSON.parse(m[0]) as Record<string, string>;
};

const score = (filmPath: string, track: Track, length: number) => {
  const loops = track.duration <= length ? Math.ceil(length / track.duration) + 1 : 1;
  const start = loops > 1 ? 0 : track.offset;

  // Fades sit before the normaliser so the measurement describes the audio that
  // actually ships, silence at the edges included.
  const chain = [
    `afade=t=in:st=0:d=${FADE_IN}`,
    `afade=t=out:st=${(length - FADE_OUT).toFixed(3)}:d=${FADE_OUT}`,
  ].join(',');

  const m = measure(track, start, length, chain);
  const applied =
    `${chain},loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK}:LRA=11` +
    `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;

  const tmp = `${filmPath}.scoring.mp4`;
  ff([
    '-y',
    '-i', filmPath,
    ...(loops > 1 ? ['-stream_loop', String(loops)] : []),
    '-ss', String(start),
    '-t', String(length),
    '-i', join(MUSIC_DIR, track.file),
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-af', applied,
    // The picture is never touched. Whatever the renderer produced is what
    // ships; this step only ever adds a sound track to the container.
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    '-ac', '2',
    '-shortest',
    '-movflags', '+faststart',
    tmp,
  ]);
  if (!existsSync(tmp)) throw new Error(`ffmpeg wrote nothing for ${filmPath}`);
  // Replace only once the new file exists, so an interrupted run leaves the
  // finished film intact rather than a half-written one.
  rmSync(filmPath);
  renameSync(tmp, filmPath);
};

/* ---------------------------------- main ---------------------------------- */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const wanted = args.filter((a) => !a.startsWith('--'));

mkdirSync(MUSIC_DIR, {recursive: true});

// Every chart film is the same length; read it rather than assume it, so a
// future spec with a different runtime is scored correctly.
const allFilms = batches().flatMap((b) =>
  b.films.map((f) => ({id: f.replace(/^chart-|\.mp4$/g, ''), path: join(b.dir, f)})),
);
if (!allFilms.length) {
  console.error('no chart films rendered yet — nothing to score');
  process.exit(1);
}
const filmLength = Number(videoDurationOf(allFilms[0].path).toFixed(3));

if (flag('--extract')) {
  console.log(`extracting music from ${SOURCES_DIR.slice(ROOT.length + 1)} …\n`);
  extract(filmLength);
  process.exit(0);
}

const library = readLibrary();
if (!library.tracks.length) {
  console.error('the library is empty — run `node scripts/chart-music.ts --extract` first');
  process.exit(1);
}

let assignments = readAssignments();

if (flag('--reroll')) {
  for (const id of wanted) {
    const was = assignments[id];
    delete assignments[id];
    // Re-assigning from the least-used track would hand it straight back if it
    // is also the least used, so the old one is held out for this pass.
    const others = library.tracks.filter((t) => t.id !== was);
    assignments = assign([id], others.length ? others : library.tracks, assignments);
    console.log(`${id}: ${was ?? '—'} → ${assignments[id]}`);
  }
}

assignments = assign(allFilms.map((f) => f.id), library.tracks, assignments);
writeJson(ASSIGNMENTS, assignments);

if (flag('--list')) {
  const byTrack = new Map<string, string[]>();
  for (const [film, track] of Object.entries(assignments)) {
    byTrack.set(track, [...(byTrack.get(track) ?? []), film]);
  }
  for (const t of library.tracks) {
    const films = (byTrack.get(t.id) ?? []).sort();
    console.log(`\n${t.id}  ${t.duration.toFixed(1)}s from ${t.offset}s  —  ${films.length} film(s)`);
    for (const f of films) console.log(`  ${f}`);
  }
  process.exit(0);
}

const targets = wanted.length ? allFilms.filter((f) => wanted.includes(f.id)) : allFilms;
if (!targets.length) {
  console.error(`no chart film matched: ${wanted.join(', ')}`);
  process.exit(1);
}

const byId = new Map(library.tracks.map((t) => [t.id, t]));
console.log(`scoring ${targets.length} film(s) at ${filmLength}s, ${TARGET_LUFS} LUFS …\n`);
for (const film of targets) {
  const track = byId.get(assignments[film.id]);
  if (!track) throw new Error(`no track assigned to ${film.id}`);
  score(film.path, track, filmLength);
  console.log(`  ${film.id.padEnd(26)} ← ${track.id}`);
}
console.log(`\ndone — ${targets.length} film(s) scored, picture untouched.`);
