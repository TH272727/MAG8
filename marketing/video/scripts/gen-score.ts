/**
 * Procedural score for "The Signal" — no samples, no external assets.
 * Every hit is placed off src/timeline.ts, so re-timing scenes re-times music.
 * Run: node scripts/gen-score.ts   (Node 24 strips types natively)
 */
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCENES, TOTAL_FRAMES, sceneStart} from '../src/timeline.ts';

const SR = 48000;
const FPS = 30;
const DUR = TOTAL_FRAMES / FPS + 0.5;
const N = Math.ceil(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const f2t = (sceneId: string, frame = 0) => (sceneStart(sceneId) + frame) / FPS;

/* deterministic rng */
let seed = 0x9e3779b9;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Env = {a?: number; d?: number; s?: number; r?: number; curve?: number};

/** Add a sine partial with ADSR-ish envelope. pan ∈ [-1,1]. */
const tone = (
  t0: number,
  dur: number,
  freq: number,
  amp: number,
  env: Env = {},
  pan = 0,
  drift = 0,
) => {
  const {a = 0.01, r = 0.05, curve = 2} = env;
  const start = Math.max(0, Math.floor(t0 * SR));
  const len = Math.floor(dur * SR);
  const phase = rnd() * Math.PI * 2;
  const gl = 0.5 * (1 - pan);
  const gr = 0.5 * (1 + pan);
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= N) break;
    const u = i / len;
    const tSec = i / SR;
    let e: number;
    if (tSec < a) e = tSec / a;
    else e = Math.pow(1 - (u - a / dur) / (1 - a / dur), curve);
    if (u > 1 - r / dur) e *= (1 - u) / (r / dur);
    const f = freq * (1 + drift * u);
    const v = Math.sin(phase + 2 * Math.PI * f * tSec) * amp * Math.max(e, 0);
    L[idx] += v * 2 * gl;
    R[idx] += v * 2 * gr;
  }
};

/** Low kick/thump: pitch-dropping sine. */
const kick = (t0: number, amp = 0.16, f0 = 82, f1 = 44, dur = 0.22) => {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= N || idx < 0) break;
    const u = i / len;
    const f = f0 + (f1 - f0) * Math.min(u * 3, 1);
    const e = Math.pow(1 - u, 2.4);
    const v = Math.sin(2 * Math.PI * f * (i / SR)) * amp * e;
    L[idx] += v;
    R[idx] += v;
  }
};

/** Tiny click/tick: fast-decaying high partial cluster. */
const tick = (t0: number, amp = 0.03, base = 3800, pan = 0) => {
  for (let k = 0; k < 3; k++) {
    tone(t0, 0.03 + k * 0.008, base * (1 + k * 0.53 + rnd() * 0.1), amp / (k + 1.5), {a: 0.001, curve: 3}, pan);
  }
};

/** Notification pop: soft rounded blip. */
const pop = (t0: number, amp = 0.05) => {
  const f = 620 + rnd() * 320;
  tone(t0, 0.09, f, amp, {a: 0.012, curve: 2}, rnd() * 1.2 - 0.6);
  tone(t0, 0.07, f * 2.01, amp * 0.3, {a: 0.012, curve: 2.5}, rnd() * 1.2 - 0.6);
};

/** Warm boom + shimmer for the big moments. */
const impact = (t0: number, amp = 1) => {
  kick(t0, 0.34 * amp, 95, 38, 0.5);
  tone(t0, 1.6, 55, 0.16 * amp, {a: 0.005, curve: 1.6});
  tone(t0, 1.2, 110, 0.08 * amp, {a: 0.005, curve: 1.8});
  for (let k = 0; k < 14; k++) {
    const f = 1150 + rnd() * 3400;
    tone(t0 + rnd() * 0.05, 1.7 + rnd() * 1.4, f, 0.014 * amp, {a: 0.004, curve: 2.6}, rnd() * 1.6 - 0.8);
  }
};

/** Rising tension sweep into a moment. */
const riser = (tEnd: number, dur = 2.4, amp = 0.05) => {
  const start = Math.floor((tEnd - dur) * SR);
  const len = Math.floor(dur * SR);
  const phase = rnd() * 6.28;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= N) continue;
    const u = i / len;
    const f = 180 + 900 * u * u;
    const e = amp * u * u;
    const v = Math.sin(phase + 2 * Math.PI * f * (i / SR)) * e;
    L[idx] += v * 0.9;
    R[idx] += v * 1.1;
  }
};

/** Sustained pad chord: detuned partials, wide. */
const pad = (t0: number, dur: number, freqs: number[], amp: number, env: Env = {}) => {
  for (const f of freqs) {
    tone(t0, dur, f * (1 + (rnd() - 0.5) * 0.0024), amp, {a: env.a ?? dur * 0.3, curve: env.curve ?? 1.3}, -0.45);
    tone(t0, dur, f * (1 + (rnd() - 0.5) * 0.0024), amp, {a: env.a ?? dur * 0.3, curve: env.curve ?? 1.3}, 0.45);
    tone(t0, dur, f * 2.003, amp * 0.22, {a: env.a ?? dur * 0.35, curve: env.curve ?? 1.5}, 0);
  }
};

const A2 = 110, C3 = 130.81, D3 = 146.83, E3 = 164.81, G3 = 196, A3 = 220,
  B3 = 246.94, C4 = 261.63, CS4 = 277.18, D4 = 293.66, E4 = 329.63, A4 = 440, E5 = 659.25;

/* ============================ arrangement ============================ */

// Chapter 1 — room tone + noise
pad(f2t('S01_Search'), 15.5, [A2 * 0.5, A2 * 0.5 * 1.005], 0.035, {a: 3});
// typing implied; first pulse only in S2 as pops crowd in
for (let i = 0; i < 12; i++) pop(f2t('S02_Noise', 12 + i * 8), 0.045 + i * 0.0035);
for (let i = 0; i < 8; i++) pop(f2t('S02_Noise', 100 + i * 5.5), 0.028);
// bubbles clatter into the can — muffled thud when the can swallows
for (let i = 0; i < 12; i++) tick(f2t('S03_Trash', 18 + i * 3.4), 0.02, 2600, rnd() - 0.5);
kick(f2t('S03_Trash', 60), 0.22, 70, 40, 0.4);
pad(f2t('S03_Trash', 76), 4.5, [A2, E3], 0.045, {a: 1.2});

// Chapter 2 — one warm swell landing as MAG8 racks in
pad(f2t('S04_Wordmark', 20), 5.4, [A2, E3, B3, C4], 0.085, {a: 1.6, curve: 1.1});
kick(f2t('S04_Wordmark', 58), 0.12, 60, 42, 0.32);
[58, 65, 72, 79].forEach((f, i) => tick(f2t('S04_Wordmark', f), 0.035, 1900 + i * 240));

// Chapter 3 — the groove builds. Beat = 104bpm.
const BEAT = 60 / 104;
const grooveStart = f2t('S05_Scout');
const grooveEnd = f2t('S15_Blind');
for (let t = grooveStart, b = 0; t < grooveEnd - 0.05; t += BEAT, b++) {
  const chapterGain = t < f2t('S07_Fundamentals') ? 0.55 : t < f2t('S10_Convergence') ? 0.8 : t < f2t('S12_Leaderboard') ? 0.9 : 1;
  kick(t, 0.13 * chapterGain);
  if (b % 2 === 1) tick(t, 0.012 * chapterGain, 6100);
  if (b % 4 === 2) tone(t, 0.3, A2 / 2, 0.07 * chapterGain, {a: 0.01, curve: 2});
}
// scene-root bass drift: A → C → G → D → E climb into fusion
const bassLine: Array<[string, number]> = [
  ['S05_Scout', A2],
  ['S06_Lanes', C3],
  ['S07_Fundamentals', G3 / 2],
  ['S08_Macro', D3],
  ['S09_Consensus', E3 / 2],
];
for (const [sc, f] of bassLine) pad(f2t(sc), SCENES.find((s) => s.id === sc)!.frames / FPS, [f], 0.05, {a: 0.8});

// sonar pings as the beam lifts each chosen block (S5)
const CHOSEN_X = [312, 513, 647, 848, 982, 1183, 1384, 1585];
for (const x of CHOSEN_X) {
  const f = 16 + ((x - 40) / (1880 - 40)) * 80;
  tone(f2t('S05_Scout', f), 0.5, 1240, 0.028, {a: 0.004, curve: 3}, 0.3);
  tone(f2t('S05_Scout', f), 0.5, 1860, 0.012, {a: 0.004, curve: 3}, -0.3);
}
// three lane tones (S6): green/copper/teal enter separately, never syncing
tone(f2t('S06_Lanes', 66), 3.2, E4, 0.02, {a: 0.5}, -0.6);
tone(f2t('S06_Lanes', 78), 3.0, G3, 0.02, {a: 0.5}, 0);
tone(f2t('S06_Lanes', 90), 2.8, B3, 0.02, {a: 0.5}, 0.6);

// lens motifs
[16, 20, 24, 28, 32, 36, 40].forEach((f, i) => tick(f2t('S07_Fundamentals', f + i), 0.02, 2300 + (i % 3) * 500)); // abacus
[46, 55, 64, 73, 82].forEach((f) => tick(f2t('S07_Fundamentals', f), 0.028, 3100)); // checklist
tone(f2t('S08_Macro', 50), 2.8, D3 / 2, 0.075, {a: 0.4, curve: 1.6}); // strategic heartbeat under
[84, 96, 108, 120, 132].forEach((f) => tone(f2t('S08_Macro', f), 0.35, 740, 0.016, {a: 0.01, curve: 2.4}, 0.2));
for (let i = 0; i < 13; i++) tone(f2t('S09_Consensus', 10 + i * 3.4), 0.4, 520 + rnd() * 340, 0.017, {a: 0.006, curve: 2.4}, rnd() - 0.5); // plucks
tone(f2t('S09_Consensus', 78), 2.4, E4, 0.032, {a: 0.5}); // converge to one sustained tone

// S10 — the fusion
riser(f2t('S10_Convergence', 124), 2.8, 0.06);
impact(f2t('S10_Convergence', 124), 1);
pad(f2t('S10_Convergence', 126), 4.5, [A2, E3, A3, CS4], 0.06, {a: 0.3, curve: 1.4}); // major lift
// S11 — heartbeat dot + score lands
for (let k = 0; k < 5; k++) kick(f2t('S11_Verdict', 4 + k * 24), 0.14, 74, 46, 0.3);
pad(f2t('S11_Verdict', 146), 3.2, [A2, E3, CS4, E4], 0.075, {a: 0.15, curve: 1.6});
kick(f2t('S11_Verdict', 146), 0.2, 88, 44, 0.4);

// Chapter 4 — product groove details
for (const w of [[8, 34], [40, 64], [56, 80]] as Array<[number, number]>) {
  for (let f = w[0]; f < w[1]; f += 4) tick(f2t('S12_Leaderboard', f), 0.013, 4300, 0.2); // plotter ratchet
}
tick(f2t('S12_Leaderboard', 84), 0.05, 5200); // chip glint
for (let i = 0; i < 10; i++) tick(f2t('S13_Mission', 26 + i * 13), 0.024, 3300, 0.5); // wire
for (let i = 0; i < 8; i++) {
  kick(f2t('S14_Receipts', 62 + i * 8), 0.05, 150, 95, 0.09); // stamp presses
  tick(f2t('S14_Receipts', 62 + i * 8), 0.02, 2500);
}
pad(f2t('S12_Leaderboard'), 18, [D3, A3, D4], 0.045, {a: 2});

// Chapter 5 — white: airy, no kick
pad(f2t('S15_Blind'), 15, [A3, C4, E4, E5], 0.035, {a: 2.5, curve: 1.1});
// three independent motifs that never sync
[0, 1, 2].forEach((k) => {
  const base = [E4, G3 * 2, B3 * 2][k];
  for (let i = 0; i < 4; i++) {
    tone(f2t('S15_Blind', 24 + i * (34 + k * 9) + k * 12), 0.7, base * (1 + (i % 2) * 0.122), 0.016, {a: 0.08}, k - 1);
  }
});
pad(f2t('S16_Disagree'), 10, [A3, D4, E4], 0.032, {a: 1.8}); // suspended, unresolved
tick(f2t('S17_Stamp', 46), 0.035, 2900);
kick(f2t('S17_Stamp', 74), 0.16, 120, 70, 0.18); // press-thunk
tick(f2t('S17_Stamp', 74), 0.03, 1600);

// Chapter 6 — anthem
const anthemStart = f2t('S18_Alignment');
const anthemEnd = f2t('S21_Endcard', 40);
for (let t = anthemStart, b = 0; t < anthemEnd; t += BEAT, b++) {
  kick(t, 0.15);
  if (b % 2 === 1) tick(t, 0.014, 6100);
  if (b % 4 === 2) tone(t, 0.3, A2 / 2, 0.08, {a: 0.01, curve: 2});
}
// slot-reel clicks decelerating per reel
[{s: 6, land: 48}, {s: 11, land: 64}, {s: 16, land: 82}].forEach((reel, ri) => {
  let f = reel.s;
  let dt = 2.2;
  while (f < reel.land) {
    tick(f2t('S18_Alignment', f), 0.02, 3600 + ri * 300, ri - 1);
    f += dt;
    dt *= 1.18;
  }
  kick(f2t('S18_Alignment', reel.land), 0.09, 130, 80, 0.12);
});
impact(f2t('S18_Alignment', 82), 0.8); // the snap + gold ignition
pad(f2t('S18_Alignment', 84), 4.5, [A2, E3, A3, CS4], 0.055, {a: 0.4});
[19, 31, 43, 55, 67].forEach((f) => tick(f2t('S19_Archive', f), 0.03, 2200)); // filing
pad(f2t('S19_Archive'), 9, [D3, A3, D4], 0.05, {a: 1.4});
pad(f2t('S20_Method', 10), 4, [E3, B3, E4], 0.05, {a: 1});
pad(f2t('S20_Method', 58), 5, [A2, E3, A3, CS4, E4], 0.07, {a: 0.2, curve: 1.5}); // "Method." lands
[88, 95, 102, 109].forEach((f) => tick(f2t('S20_Method', f), 0.018, 3000));
tone(f2t('S20_Method', 124), 0.8, A4 * 2, 0.02, {a: 0.005, curve: 3}); // gold dot ping

// endcard resolve
pad(f2t('S21_Endcard', 20), 6.5, [A2, E3, A3, CS4, E4], 0.075, {a: 1.2, curve: 1.2});
kick(f2t('S21_Endcard', 62), 0.13, 70, 44, 0.35); // heartbeat
kick(f2t('S21_Endcard', 74), 0.07, 64, 42, 0.3);
kick(f2t('S21_Endcard', 168), 0.14, 70, 44, 0.4); // one last soft thump
pad(f2t('S21_Endcard', 100), 3.6, [A2 / 2, A2], 0.045, {a: 1});

/* ======================= master: fade + normalize ======================= */
const fadeIn = Math.floor(0.4 * SR);
const fadeOutStart = Math.floor((TOTAL_FRAMES / FPS - 1.2) * SR);
for (let i = 0; i < N; i++) {
  let g = 1;
  if (i < fadeIn) g = i / fadeIn;
  if (i > fadeOutStart) g *= Math.max(1 - (i - fadeOutStart) / (N - fadeOutStart), 0);
  L[i] *= g;
  R[i] *= g;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const target = Math.pow(10, -3.5 / 20);
const norm = peak > 0 ? target / peak : 1;

const bytes = Buffer.alloc(44 + N * 4);
bytes.write('RIFF', 0);
bytes.writeUInt32LE(36 + N * 4, 4);
bytes.write('WAVEfmt ', 8);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20);
bytes.writeUInt16LE(2, 22);
bytes.writeUInt32LE(SR, 24);
bytes.writeUInt32LE(SR * 4, 28);
bytes.writeUInt16LE(4, 32);
bytes.writeUInt16LE(16, 34);
bytes.write('data', 36);
bytes.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * norm));
  const r = Math.max(-1, Math.min(1, R[i] * norm));
  bytes.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  bytes.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'audio', 'score.wav');
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, bytes);
console.log(`score.wav written: ${(bytes.length / 1e6).toFixed(1)} MB, ${DUR.toFixed(1)}s, peak norm ×${norm.toFixed(2)}`);
