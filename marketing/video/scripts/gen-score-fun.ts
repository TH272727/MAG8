/**
 * Procedural scores for the fun campaign shorts — same synthesis language as
 * gen-score.ts / gen-score-shorts.ts (no samples, no external assets), one
 * WAV per short, every hit placed off src/fun/timeline.ts.
 * Run: node scripts/gen-score-fun.ts   (Node 24 strips types natively)
 */
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FUN_IDS, funSceneStart, funSceneFrames, funTotal} from '../src/fun/timeline.ts';
import type {FunId} from '../src/fun/timeline.ts';

const SR = 48000;
const FPS = 30;

type Env = {a?: number; d?: number; s?: number; r?: number; curve?: number};

/** A self-contained stereo track with the shared synth toolkit. */
const createTrack = (totalFrames: number) => {
  const DUR = totalFrames / FPS + 0.5;
  const N = Math.ceil(DUR * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  let seed = 0x9e3779b9;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

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

  const tick = (t0: number, amp = 0.03, base = 3800, pan = 0) => {
    for (let k = 0; k < 3; k++) {
      tone(t0, 0.03 + k * 0.008, base * (1 + k * 0.53 + rnd() * 0.1), amp / (k + 1.5), {a: 0.001, curve: 3}, pan);
    }
  };

  const pop = (t0: number, amp = 0.05) => {
    const f = 620 + rnd() * 320;
    tone(t0, 0.09, f, amp, {a: 0.012, curve: 2}, rnd() * 1.2 - 0.6);
    tone(t0, 0.07, f * 2.01, amp * 0.3, {a: 0.012, curve: 2.5}, rnd() * 1.2 - 0.6);
  };

  const impact = (t0: number, amp = 1) => {
    kick(t0, 0.34 * amp, 95, 38, 0.5);
    tone(t0, 1.6, 55, 0.16 * amp, {a: 0.005, curve: 1.6});
    tone(t0, 1.2, 110, 0.08 * amp, {a: 0.005, curve: 1.8});
    for (let k = 0; k < 14; k++) {
      const f = 1150 + rnd() * 3400;
      tone(t0 + rnd() * 0.05, 1.7 + rnd() * 1.4, f, 0.014 * amp, {a: 0.004, curve: 2.6}, rnd() * 1.6 - 0.8);
    }
  };

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

  const pad = (t0: number, dur: number, freqs: number[], amp: number, env: Env = {}) => {
    for (const f of freqs) {
      tone(t0, dur, f * (1 + (rnd() - 0.5) * 0.0024), amp, {a: env.a ?? dur * 0.3, curve: env.curve ?? 1.3}, -0.45);
      tone(t0, dur, f * (1 + (rnd() - 0.5) * 0.0024), amp, {a: env.a ?? dur * 0.3, curve: env.curve ?? 1.3}, 0.45);
      tone(t0, dur, f * 2.003, amp * 0.22, {a: env.a ?? dur * 0.35, curve: env.curve ?? 1.5}, 0);
    }
  };

  /** Synth crowd ("walla") — voice-ish chirp clusters, crescendo + shouts. */
  const walla = (t0: number, dur: number, peak: number) => {
    const voices = Math.floor(dur * 24);
    for (let i = 0; i < voices; i++) {
      const u = Math.pow(rnd(), 0.6);
      const tv = t0 + u * dur * 0.92;
      const g = peak * (0.22 + 0.78 * u);
      const f0 = 150 + rnd() * 210;
      const pan = rnd() * 1.6 - 0.8;
      let ts = tv;
      const syll = 2 + Math.floor(rnd() * 3);
      for (let s = 0; s < syll; s++) {
        const d = 0.05 + rnd() * 0.09;
        const drift = (rnd() - 0.5) * 0.5;
        tone(ts, d, f0 * (1 + (rnd() - 0.5) * 0.24), g * 0.5, {a: 0.012, curve: 1.6}, pan, drift);
        tone(ts, d, f0 * (3 + rnd() * 2.5), g * 0.3, {a: 0.012, curve: 2}, pan, drift);
        tone(ts, d * 0.8, f0 * (6 + rnd() * 4), g * 0.12, {a: 0.008, curve: 2.4}, pan, drift);
        ts += d * (0.8 + rnd() * 0.5);
      }
    }
    for (let k = 0; k < Math.max(2, Math.floor(dur * 1.6)); k++) {
      const tv = t0 + (0.35 + 0.62 * rnd()) * dur;
      const f0 = 220 + rnd() * 260;
      const pan = rnd() * 1.4 - 0.7;
      tone(tv, 0.22 + rnd() * 0.18, f0, peak * 0.8, {a: 0.02, curve: 1.4}, pan, 0.35 + rnd() * 0.4);
      tone(tv, 0.2, f0 * 2.8, peak * 0.32, {a: 0.02, curve: 2}, pan, 0.3);
    }
  };

  const finalize = (outPath: string) => {
    const fadeIn = Math.floor(0.35 * SR);
    const fadeOutStart = Math.floor((totalFrames / FPS - 1.1) * SR);
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
    mkdirSync(dirname(outPath), {recursive: true});
    writeFileSync(outPath, bytes);
    return {mb: bytes.length / 1e6, dur: DUR, norm};
  };

  return {tone, kick, tick, pop, impact, riser, pad, walla, finalize, rnd};
};

const A2 = 110, C3 = 130.81, E3 = 164.81, G3 = 196, A3 = 220,
  B3 = 246.94, CS4 = 277.18, D4 = 293.66, E4 = 329.63;

const BEAT = 60 / 104;

const here = dirname(fileURLToPath(import.meta.url));

for (const id of FUN_IDS as FunId[]) {
  const total = funTotal(id);
  const trk = createTrack(total);
  const {tone, kick, tick, pop, impact, riser, pad, walla} = trk;
  const f2t = (sceneId: string, frame = 0) => (funSceneStart(id, sceneId) + frame) / FPS;
  const sceneDur = (sceneId: string) => funSceneFrames(id, sceneId) / FPS;

  /** The three lens chips stamp in, then the verdict lands.
   * `dark` flips the resolve chord minor — for desks that FAIL the candidate. */
  const deskCues = (sc: string, at: number, stag: number, verdictAt: number, big = 0.6, dark = false) => {
    [0, 1, 2].forEach((i) => {
      kick(f2t(sc, at + i * stag), 0.07, 140, 85, 0.1);
      tick(f2t(sc, at + i * stag), 0.024, 2400 + i * 300);
    });
    riser(f2t(sc, verdictAt), 1.6, 0.045);
    impact(f2t(sc, verdictAt), big);
    pad(f2t(sc, verdictAt + 2), 3.2, dark ? [A2, C3, E3, A3] : [A2, E3, A3, CS4], 0.055, {a: 0.3, curve: 1.4});
    // a light groove carries from the verdict to the end of the film
    for (let t = f2t(sc, verdictAt), b = 0; t < total / FPS - 1.4; t += BEAT, b++) {
      kick(t, 0.1);
      if (b % 2 === 1) tick(t, 0.01, 6100);
    }
  };

  /** Shared endcard resolve (168f since the waitlist CTA landed). */
  const endcard = (sc: string) => {
    pad(f2t(sc, 12), 5.0, [A2, E3, A3, CS4, E4], 0.075, {a: 1.0, curve: 1.2});
    kick(f2t(sc, 56), 0.13, 70, 44, 0.35);
    kick(f2t(sc, 68), 0.07, 64, 42, 0.3);
    tick(f2t(sc, 86), 0.02, 3200); // the waitlist CTA lands
    pad(f2t(sc, 88), 2.4, [E3, A3, E4], 0.04, {a: 0.3, curve: 1.4});
    kick(f2t(sc, 124), 0.14, 70, 44, 0.4);
    pad(f2t(sc, 84), 3.0, [A2 / 2, A2], 0.045, {a: 0.9});
    kick(f2t(sc, 150), 0.1, 70, 44, 0.35);
  };

  if (id === 'eightball') {
    // E1 — room tone, the chip, the toy thuds in
    pad(f2t('E1_Ask'), 6.5, [A2 * 0.5, A2 * 0.5 * 1.005], 0.035, {a: 1.6});
    pop(f2t('E1_Ask', 10), 0.05);
    tick(f2t('E1_Ask', 42), 0.022, 2600); // ticker swap $NVDA → $TSLA
    tick(f2t('E1_Ask', 72), 0.02, 2200); // → the redacted "next one"
    kick(f2t('E1_Ask', 62), 0.24, 60, 34, 0.5); // rubber thud
    tick(f2t('E1_Ask', 62), 0.02, 1400);
    tick(f2t('E1_Ask', 98), 0.02, 3000);
    // E2 — three rattles, three wah-wah non-answers
    [14, 82, 150].forEach((s, ci) => {
      for (let i = 0; i < 10; i++) {
        tick(f2t('E2_Shake', s + i * 1.8), 0.022, 2200 + trk.rnd() * 2400, trk.rnd() - 0.5);
      }
      const t = f2t('E2_Shake', s + 24);
      tone(t, 0.32, 392, 0.03, {a: 0.02, curve: 1.6});
      tone(t + 0.18, 0.5, ci === 2 ? 349 : 311, 0.028, {a: 0.02, curve: 1.6});
    });
    tone(f2t('E2_Shake', 202), 0.22, 220, 0.03, {a: 0.004, curve: 2.4}); // "helpful."
    pad(f2t('E2_Shake'), sceneDur('E2_Shake'), [A2 * 0.5], 0.03, {a: 1.2});
    // E3 — the roll, the can
    [24, 32, 40, 48].forEach((f) => tick(f2t('E3_Toys', f), 0.018, 900, 0.2));
    kick(f2t('E3_Toys', 64), 0.2, 90, 46, 0.4); // into the can
    pad(f2t('E3_Toys', 72), 2.8, [A2, E3], 0.05, {a: 0.8});
    // E4 — the desk answers
    deskCues('E4_Desk', 54, 20, 140);
    tick(f2t('E4_Desk', 176), 0.02, 3000);
    endcard('E5_End');
  }

  if (id === 'groupchat') {
    // G1 — message pops accelerate; the room starts to roar
    pad(f2t('G1_Chat'), 8, [A2 * 0.5, A2 * 0.5 * 1.005], 0.035, {a: 1.8});
    [12, 30, 54, 78, 100, 122, 142, 156, 168, 188, 204].forEach((f, i) => {
      pop(f2t('G1_Chat', f), 0.032 + i * 0.0024);
    });
    [30, 54, 188].forEach((f) => {
      for (let k = 0; k < 3; k++) tick(f2t('G1_Chat', f - 20 + k * 6), 0.012, 4200, 0.3);
    });
    walla(f2t('G1_Chat', 150), 3.1, 0.05);
    tone(f2t('G1_Chat', 212), 1.1, 55, 0.045, {a: 0.15, curve: 1.4}); // rumble
    // G2 — the hard cut IS the joke: near-silence, then one low pad
    pad(f2t('G2_Cut', 30), 2.2, [A2 * 0.5], 0.03, {a: 0.8});
    // G3 — the thesis
    pad(f2t('G3_Line', 6), 3.2, [A3, D4, E4], 0.032, {a: 1.2});
    tick(f2t('G3_Line', 10), 0.02, 2800);
    // G4 — the desk answers
    deskCues('G4_Desk', 60, 20, 146);
    tick(f2t('G4_Desk', 182), 0.02, 3000);
    endcard('G5_End');
  }

  if (id === 'gate') {
    // the club thumps outside from the first frame to the end of the checks
    const clubEnd = f2t('B3_Line') - 0.05;
    for (let t = f2t('B1_Queue'), b = 0; t < clubEnd; t += BEAT, b++) {
      kick(t, 0.11, 64, 38, 0.26);
      if (b % 2 === 1) tick(t, 0.008, 5200);
    }
    pad(f2t('B1_Queue'), sceneDur('B1_Queue') + sceneDur('B2_Checks'), [A2 * 0.5], 0.035, {a: 2});
    tick(f2t('B1_Queue', 12), 0.025, 2600);
    [18, 25, 32, 39, 46].forEach((f) => pop(f2t('B1_Queue', f), 0.035));
    // B2 — five checks
    [0, 1, 2, 3, 4].forEach((i) => {
      const s = 16 + i * 62;
      const passv = i === 0 || i === 3;
      pop(f2t('B2_Checks', s + 4), 0.03);
      tone(f2t('B2_Checks', s + 16), 0.55, 480, 0.022, {a: 0.05, curve: 1.6}, 0, 0.75); // scan sweep
      if (passv) {
        tone(f2t('B2_Checks', s + 34), 0.5, 1240, 0.03, {a: 0.004, curve: 3}, 0.2);
        tick(f2t('B2_Checks', s + 34), 0.03, 3600);
      } else {
        // the buzz — stacked low cluster + thud
        tone(f2t('B2_Checks', s + 34), 0.42, 108, 0.05, {a: 0.004, curve: 1.2});
        tone(f2t('B2_Checks', s + 34), 0.42, 162, 0.032, {a: 0.004, curve: 1.2});
        tone(f2t('B2_Checks', s + 34), 0.38, 216, 0.02, {a: 0.004, curve: 1.2});
        kick(f2t('B2_Checks', s + 36), 0.12, 130, 60, 0.2);
        tick(f2t('B2_Checks', s + 38), 0.025, 1600); // reason stamp
      }
    });
    // B3 — suspended
    pad(f2t('B3_Line', 4), 3.2, [A3, D4, E4], 0.032, {a: 1.2});
    // B4 — the scoring
    for (const [rowAt] of [[48], [66]] as Array<[number]>) {
      for (let f = rowAt; f < rowAt + 12; f += 3) tick(f2t('B4_Board', f), 0.012, 4300, 0.2);
    }
    pad(f2t('B4_Board', 80), 2.6, [E3, B3, E4], 0.045, {a: 0.4});
    tick(f2t('B4_Board', 96), 0.02, 3000);
    endcard('B5_End');
  }

  if (id === 'redflags') {
    const swipe = (sc: string, at: number, up = false) =>
      tone(f2t(sc, at), 0.45, up ? 520 : 900, 0.028, {a: 0.03, curve: 1.8}, up ? 0.3 : -0.3, up ? 0.5 : -0.55);
    // R1 — plucks sour per flag
    pad(f2t('R1_Swipe1'), sceneDur('R1_Swipe1'), [G3 / 2], 0.04, {a: 1});
    [16, 24, 32].forEach((f, i) => tone(f2t('R1_Swipe1', f), 0.4, [392, 494, 587][i], 0.02, {a: 0.006, curve: 2.4}, i - 1));
    [40, 56, 72].forEach((f) => {
      tone(f2t('R1_Swipe1', f), 0.35, 330, 0.024, {a: 0.006, curve: 2});
      tone(f2t('R1_Swipe1', f), 0.35, 349, 0.024, {a: 0.006, curve: 2}); // the clash
    });
    kick(f2t('R1_Swipe1', 112), 0.12, 130, 70, 0.18); // NOPE stamp
    tick(f2t('R1_Swipe1', 112), 0.03, 1600);
    swipe('R1_Swipe1', 134);
    // R2 — same shape, a little louder
    pad(f2t('R2_Swipe2'), sceneDur('R2_Swipe2'), [G3 / 2 * 0.94], 0.04, {a: 1});
    [36, 52, 68].forEach((f) => {
      tone(f2t('R2_Swipe2', f), 0.35, 311, 0.026, {a: 0.006, curve: 2});
      tone(f2t('R2_Swipe2', f), 0.35, 330, 0.026, {a: 0.006, curve: 2});
    });
    kick(f2t('R2_Swipe2', 114), 0.13, 130, 70, 0.18);
    tick(f2t('R2_Swipe2', 114), 0.03, 1600);
    swipe('R2_Swipe2', 136);
    // R3 — the keeper: clean major ticks, a chime on the right-swipe
    pad(f2t('R3_Keeper'), sceneDur('R3_Keeper'), [C3], 0.042, {a: 1});
    [34, 50, 66, 82].forEach((f, i) => {
      tone(f2t('R3_Keeper', f), 0.4, [523.25, 659.25, 783.99, 880][i], 0.02, {a: 0.006, curve: 2.4}, (i % 3) - 1);
      tick(f2t('R3_Keeper', f), 0.02, 3600);
    });
    tick(f2t('R3_Keeper', 120), 0.02, 3000); // "finally."
    pad(f2t('R3_Keeper', 118), 1.8, [E3, B3, E4], 0.04, {a: 0.2, curve: 1.5}); // WORTH A LOOK
    swipe('R3_Keeper', 152, true);
    [0, 1, 2, 3, 4, 5].forEach((k) =>
      tone(f2t('R3_Keeper', 150) + trk.rnd() * 0.08, 0.9 + trk.rnd() * 0.5, 1500 + trk.rnd() * 2000, 0.012, {a: 0.004, curve: 2.6}, trk.rnd() * 1.2 - 0.6),
    );
    // R4 — the desk answers (no confluence here — honest read)
    deskCues('R4_Desk', 56, 18, 132, 0.45);
    tick(f2t('R4_Desk', 166), 0.02, 3000);
    endcard('R5_End');
  }

  if (id === 'naturedoc') {
    // N1 — night air: a low drone and crickets
    pad(f2t('N1_Field'), sceneDur('N1_Field') + 1, [A2 * 0.5, A2 * 0.5 * 1.004], 0.035, {a: 2});
    for (let i = 0; i < 12; i++) {
      tick(f2t('N1_Field', 8 + i * 11 + trk.rnd() * 6), 0.008 + trk.rnd() * 0.006, 5200 + trk.rnd() * 1800, trk.rnd() - 0.5);
    }
    tick(f2t('N1_Field', 26), 0.02, 3000); // caption 1
    tone(f2t('N1_Field', 94), 0.8, 110, 0.03, {a: 0.1, curve: 1.4}); // "the chart is red"
    // N2 — the stampede builds under the narrator
    pad(f2t('N2_Herd'), sceneDur('N2_Herd'), [A2 * 0.5, E3 * 0.5], 0.03, {a: 1.5});
    for (let i = 0; i < 26; i++) {
      const u = i / 26;
      kick(f2t('N2_Herd', 24 + u * u * 150 + i * 2), 0.05 + u * 0.07, 120 - u * 30, 60, 0.16);
    }
    walla(f2t('N2_Herd', 120), 3.4, 0.035); // the herd, roaring faintly
    tick(f2t('N2_Herd', 152), 0.022, 2600); // "the next $NVDA"
    // N3 — over the edge: hooves stop, glissandi fall, the freeze
    for (let i = 0; i < 6; i++) {
      tone(f2t('N3_Cliff', 30 + i * 15), 0.7, 640 - i * 40, 0.02, {a: 0.02, curve: 1.6}, trk.rnd() - 0.5, -0.72);
    }
    kick(f2t('N3_Cliff', 118), 0.16, 96, 40, 0.3); // freeze-frame
    tone(f2t('N3_Cliff', 118), 0.14, 1600, 0.03, {a: 0.002, curve: 3}, 0, -0.85); // scratch
    pad(f2t('N3_Cliff', 124), 1.6, [G3 / 2, D4 / 2], 0.035, {a: 0.2}); // "Magnificent."
    pad(f2t('N3_Cliff', 148), 1.8, [E3 / 2, B3 / 2], 0.04, {a: 0.2}); // "Devastating."
    deskCues('N4_Desk', 54, 18, 136);
    tick(f2t('N4_Desk', 172), 0.02, 3000);
    endcard('N5_End');
  }

  if (id === 'speedrun') {
    // SP1 — chip-tune arps, the countdown, GO
    pad(f2t('SP1_Title'), 4.5, [A2 * 0.5], 0.03, {a: 1.2});
    for (let i = 0; i < 14; i++) {
      tone(f2t('SP1_Title', 8 + i * 7), 0.09, [E3, A3, CS4, E4][i % 4] * 2, 0.016, {a: 0.004, curve: 2.6}, (i % 2) * 0.8 - 0.4);
    }
    [78, 92, 106].forEach((f) => tick(f2t('SP1_Title', f), 0.03, 2200));
    tone(f2t('SP1_Title', 118), 0.3, 1046.5, 0.04, {a: 0.004, curve: 2.2}); // GO
    // SP2 — driving eighths under the clock; dings, the skip, the slam
    const runEnd = f2t('SP2_Run', 298);
    for (let t = f2t('SP2_Run'), b = 0; t < runEnd; t += BEAT / 2, b++) {
      if (b % 2 === 0) kick(t, 0.09, 110, 60, 0.14);
      else tick(t, 0.01, 6400, b % 4 > 1 ? 0.3 : -0.3);
    }
    [14, 40, 76, 141].forEach((f) => {
      tone(f2t('SP2_Run', f), 0.4, 1240, 0.028, {a: 0.004, curve: 3}, 0.2);
      tick(f2t('SP2_Run', f), 0.025, 3600);
    });
    tone(f2t('SP2_Run', 108), 0.4, 108, 0.05, {a: 0.004, curve: 1.2}); // SKIPPED buzz
    tone(f2t('SP2_Run', 108), 0.4, 162, 0.03, {a: 0.004, curve: 1.2});
    kick(f2t('SP2_Run', 110), 0.12, 130, 60, 0.2);
    [0, 1, 2].forEach((k) => tone(f2t('SP2_Run', 145 + k * 3), 0.2, [659.25, 783.99, 987.77][k], 0.02, {a: 0.004, curve: 2.6})); // best segment
    [206, 269].forEach((f) => {
      tone(f2t('SP2_Run', f), 0.35, 330, 0.024, {a: 0.006, curve: 2});
      tone(f2t('SP2_Run', f), 0.35, 349, 0.024, {a: 0.006, curve: 2}); // sour diffs
    });
    riser(f2t('SP2_Run', 300), 1.4, 0.04);
    impact(f2t('SP2_Run', 300), 0.7); // the slam
    tone(f2t('SP2_Run', 306), 0.5, 392, 0.03, {a: 0.02, curve: 1.6}); // sad wah
    tone(f2t('SP2_Run', 314), 0.7, 311, 0.028, {a: 0.02, curve: 1.6});
    for (let k = 0; k < 10; k++) {
      tick(f2t('SP2_Run', 308) + trk.rnd() * 0.8, 0.012, 3000 + trk.rnd() * 3000, trk.rnd() - 0.5); // confetti
    }
    pad(f2t('SP3_Line', 6), 3.4, [A3, D4, E4], 0.032, {a: 1.2});
    tick(f2t('SP3_Line', 48), 0.02, 2800);
    deskCues('SP4_Desk', 48, 16, 118);
    tick(f2t('SP4_Desk', 148), 0.02, 3000);
    endcard('SP5_End');
  }

  if (id === 'replay') {
    // RP1 — the stadium: crowd bed + broadcast sting
    walla(f2t('RP1_Live', 4), 4.2, 0.028);
    pad(f2t('RP1_Live'), sceneDur('RP1_Live'), [A2 * 0.5], 0.03, {a: 1.4});
    [0, 1, 2].forEach((k) => tone(f2t('RP1_Live', 8 + k * 4), 0.24, [A3, CS4, E4][k] * 2, 0.02, {a: 0.006, curve: 2.2}));
    tick(f2t('RP1_Live', 36), 0.02, 2800);
    // RP2 — the play: crowd swells, the top, the drop, the buzzer
    walla(f2t('RP2_Play'), 4.6, 0.05);
    for (let i = 0; i < 18; i++) {
      const u = i / 18;
      kick(f2t('RP2_Play', 8 + u * u * 116 + i * 1.5), 0.05 + u * 0.06, 120, 62, 0.15);
    }
    tick(f2t('RP2_Play', 126), 0.03, 1600); // BUY stamp
    kick(f2t('RP2_Play', 128), 0.14, 130, 60, 0.22);
    tone(f2t('RP2_Play', 136), 1.3, 520, 0.026, {a: 0.02, curve: 1.5}, 0, -0.62); // the drop
    walla(f2t('RP2_Play', 140), 2.2, 0.045); // the "ohhh"
    tone(f2t('RP2_Play', 196), 0.7, 196, 0.06, {a: 0.006, curve: 1.1}); // buzzer
    tone(f2t('RP2_Play', 196), 0.7, 247, 0.045, {a: 0.006, curve: 1.1});
    tick(f2t('RP2_Play', 202), 0.025, 2200); // scorebug flips
    // RP3 — the replay jingle over a slowed world
    [0, 1, 2, 0, 1, 2].forEach((k, i) => {
      tone(f2t('RP3_Replay', 4 + i * 6), 0.3, [E4, CS4, A3][k], 0.022, {a: 0.01, curve: 2}, (i % 2) * 0.7 - 0.35);
    });
    pad(f2t('RP3_Replay', 20), sceneDur('RP3_Replay') / 1.4, [A2 * 0.5, E3 * 0.5], 0.035, {a: 1.6});
    [66, 102].forEach((f) => tone(f2t('RP3_Replay', f), 0.8, 480, 0.018, {a: 0.05, curve: 1.5}, 0.2, 0.5)); // telestrator
    tick(f2t('RP3_Replay', 132), 0.02, 2800);
    tick(f2t('RP3_Replay', 172), 0.02, 3200); // "Frame it."
    deskCues('RP4_Desk', 46, 16, 118);
    tick(f2t('RP4_Desk', 148), 0.02, 3000);
    endcard('RP5_End');
  }

  if (id === 'coldcase') {
    // K1 — noir: dark drone, the folder slap, the typewriter, the stamp
    pad(f2t('K1_File'), sceneDur('K1_File') + 1, [A2 * 0.5, C3 * 0.5, E3 * 0.5], 0.035, {a: 1.8});
    kick(f2t('K1_File', 12), 0.2, 70, 36, 0.4); // the folder lands
    for (let i = 0; i < 11; i++) tick(f2t('K1_File', 30 + i * 2.6), 0.014, 2400 + trk.rnd() * 800, 0.3);
    impact(f2t('K1_File', 78), 0.32); // CONFIDENTIAL
    tick(f2t('K1_File', 100), 0.018, 3000);
    // K2 — heartbeat, pins, the string stings, narration typing
    pad(f2t('K2_Board'), sceneDur('K2_Board'), [A2 * 0.5, C3 * 0.5], 0.032, {a: 2});
    for (let b = 0; b < 8; b++) {
      const t = f2t('K2_Board', 14 + b * 32);
      kick(t, 0.08, 88, 46, 0.16);
      kick(t + 0.32, 0.05, 80, 44, 0.14);
    }
    [18, 62, 106, 150].forEach((f) => pop(f2t('K2_Board', f), 0.04)); // pins
    [44, 88, 132].forEach((f) => tone(f2t('K2_Board', f), 0.8, 660, 0.02, {a: 0.03, curve: 1.6}, 0.2, 0.4)); // string
    for (let i = 0; i < 22; i++) tick(f2t('K2_Board', 172 + i * 1.6), 0.012, 2400 + trk.rnd() * 800, -0.2);
    for (let i = 0; i < 26; i++) tick(f2t('K2_Board', 216 + i * 1.5), 0.012, 2400 + trk.rnd() * 800, -0.2);
    // K3 — the twist: flashlight rise, sour rows, the reveal hit
    pad(f2t('K3_Twist'), 3.5, [A2 * 0.5, C3, E3], 0.04, {a: 1});
    tone(f2t('K3_Twist', 22), 1.6, 300, 0.02, {a: 0.2, curve: 1.4}, 0, 1.2);
    [34, 48, 62].forEach((f) => {
      tone(f2t('K3_Twist', f), 0.4, 330, 0.024, {a: 0.006, curve: 2});
      tone(f2t('K3_Twist', f), 0.4, 349, 0.02, {a: 0.006, curve: 2});
    });
    riser(f2t('K3_Twist', 86), 1.6, 0.04);
    kick(f2t('K3_Twist', 86), 0.16, 90, 42, 0.3); // "the evidence was public"
    deskCues('K4_Desk', 48, 16, 120, 0.6, true); // minor — this one fails
    tick(f2t('K4_Desk', 152), 0.02, 3000);
    endcard('K5_End');
  }

  const out = join(here, '..', 'public', 'audio', `score-fun-${id}.wav`);
  const res = trk.finalize(out);
  console.log(
    `score-fun-${id}.wav written: ${res.mb.toFixed(1)} MB, ${res.dur.toFixed(1)}s, peak norm ×${res.norm.toFixed(2)}`,
  );
}
