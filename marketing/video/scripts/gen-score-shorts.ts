/**
 * Procedural scores for the three vertical lens shorts — same synthesis
 * language as gen-score.ts (no samples, no external assets), one WAV per
 * short, every hit placed off src/shorts/timeline.ts.
 * Run: node scripts/gen-score-shorts.ts   (Node 24 strips types natively)
 */
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  SHORT_IDS,
  shortSceneStart,
  shortSceneFrames,
  shortTotal,
} from '../src/shorts/timeline.ts';
import type {ShortId} from '../src/shorts/timeline.ts';

const SR = 48000;
const FPS = 30;

type Env = {a?: number; d?: number; s?: number; r?: number; curve?: number};

/** A self-contained stereo track with the gen-score synth toolkit. */
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

  return {tone, kick, tick, pop, impact, riser, pad, finalize, rnd};
};

const A2 = 110, C3 = 130.81, D3 = 146.83, E3 = 164.81, G3 = 196, A3 = 220,
  B3 = 246.94, C4 = 261.63, CS4 = 277.18, D4 = 293.66, E4 = 329.63;

const BEAT = 60 / 104;

const here = dirname(fileURLToPath(import.meta.url));

for (const short of SHORT_IDS as ShortId[]) {
  const total = shortTotal(short);
  const trk = createTrack(total);
  const {tone, kick, tick, pop, impact, riser, pad} = trk;
  const f2t = (sceneId: string, frame = 0) => (shortSceneStart(short, sceneId) + frame) / FPS;
  const sceneDur = (sceneId: string) => shortSceneFrames(short, sceneId) / FPS;

  /* ------------------------------ spine open ------------------------------ */
  // V01 — room tone, hype pops piling up, clatter, thud, quiet under the thesis
  pad(f2t('V01_Hook'), 5.5, [A2 * 0.5, A2 * 0.5 * 1.005], 0.035, {a: 1.6});
  for (let i = 0; i < 14; i++) pop(f2t('V01_Hook', 8 + i * 4.2), 0.04 + i * 0.003);
  for (let i = 0; i < 10; i++) tick(f2t('V01_Hook', 76 + i * 2.8), 0.02, 2600, trk.rnd() - 0.5);
  kick(f2t('V01_Hook', 98), 0.22, 70, 40, 0.4);
  pad(f2t('V01_Hook', 112), 2.6, [A2, E3], 0.045, {a: 1.0});

  // V02 — warm swell landing as MAG8 racks in
  pad(f2t('V02_Intro', 8), 4.4, [A2, E3, B3, C4], 0.085, {a: 1.3, curve: 1.1});
  [24, 31, 38, 45].forEach((f, i) => tick(f2t('V02_Intro', f), 0.035, 1900 + i * 240));
  kick(f2t('V02_Intro', 45), 0.12, 60, 42, 0.32);
  [58, 62, 66, 70].forEach((f) => tick(f2t('V02_Intro', f), 0.02, 3000));

  /* --------------------------- the groove backbone ------------------------ */
  const grooveStart = f2t('V03_Scout');
  const grooveEnd = f2t('V13_Endcard') - 0.05;
  const fuseT = f2t('V10_Fusion', 108);
  for (let t = grooveStart, b = 0; t < grooveEnd; t += BEAT, b++) {
    const gain =
      t < f2t('V04_Lanes') ? 0.55 :
      t < fuseT ? 0.78 :
      t < f2t('V11_Verdict') ? 0.55 : 0.95;
    kick(t, 0.13 * gain);
    if (b % 2 === 1) tick(t, 0.012 * gain, 6100);
    if (b % 4 === 2) tone(t, 0.3, A2 / 2, 0.07 * gain, {a: 0.01, curve: 2});
  }

  // V03 — sonar pings as the beam passes the eight chosen names
  [20, 28, 37, 45, 54, 62, 71, 79].forEach((f) => {
    tone(f2t('V03_Scout', f), 0.5, 1240, 0.028, {a: 0.004, curve: 3}, 0.3);
    tone(f2t('V03_Scout', f), 0.5, 1860, 0.012, {a: 0.004, curve: 3}, -0.3);
  });
  pad(f2t('V03_Scout'), sceneDur('V03_Scout'), [A2], 0.05, {a: 0.8});

  // V04 — three lane tones entering separately; a soft accent on the pick
  tone(f2t('V04_Lanes', 52), 3.0, E4, 0.02, {a: 0.5}, -0.6);
  tone(f2t('V04_Lanes', 60), 2.8, G3, 0.02, {a: 0.5}, 0);
  tone(f2t('V04_Lanes', 68), 2.6, B3, 0.02, {a: 0.5}, 0.6);
  pad(f2t('V04_Lanes'), sceneDur('V04_Lanes'), [C3], 0.05, {a: 0.8});
  kick(f2t('V04_Lanes', 120), 0.1, 90, 50, 0.3);
  tick(f2t('V04_Lanes', 120), 0.03, 2400);

  /* ------------------------------ deep chapter ---------------------------- */
  if (short === 'fundamentals') {
    const root = G3 / 2;
    for (const sc of ['VF1_Books', 'VF2_Quality', 'VF3_Traps', 'VF4_PricedIn', 'VF5_Scenarios']) {
      pad(f2t(sc), sceneDur(sc), [root * (sc === 'VF4_PricedIn' ? 1.5 : 1)], 0.045, {a: 0.9});
    }
    // VF1 — abacus ticks as the ledger fills, gauge sweep
    [34, 38, 42, 46, 50, 54, 58].forEach((f, i) => tick(f2t('VF1_Books', f + i), 0.02, 2300 + (i % 3) * 500));
    [46, 54, 62, 70, 78].forEach((f) => tick(f2t('VF1_Books', f), 0.024, 3100));
    tone(f2t('VF1_Books', 66), 1.4, 740, 0.02, {a: 0.02, curve: 2}, 0.2, 0.35);
    // VF2 — nine checklist ticks (one dull miss), zone needle slide
    Array.from({length: 9}).forEach((_, i) => {
      const f = 34 + i * 7;
      if (i === 6) tone(f2t('VF2_Quality', f), 0.18, 320, 0.03, {a: 0.004, curve: 2.4});
      else tick(f2t('VF2_Quality', f), 0.028, 3100 + i * 60);
    });
    tone(f2t('VF2_Quality', 96), 1.1, 520, 0.022, {a: 0.02}, 0, 0.5);
    kick(f2t('VF2_Quality', 128), 0.09, 120, 70, 0.16);
    // VF3 — five drops; traps thud low, passes ping bright
    [30, 37, 44, 51, 58].forEach((f, i) => {
      const land = f + 36;
      const trap = i === 1 || i === 3;
      if (trap) {
        kick(f2t('VF3_Traps', land), 0.12, 130, 60, 0.2);
        tone(f2t('VF3_Traps', land + 6), 0.4, 196, 0.03, {a: 0.006, curve: 2.4});
      } else {
        tick(f2t('VF3_Traps', land), 0.03, 3600);
        tone(f2t('VF3_Traps', land + 4), 0.5, 1240, 0.02, {a: 0.004, curve: 3}, 0.2);
      }
    });
    // VF4 — two rising bars, then the gap shimmer
    tone(f2t('VF4_PricedIn', 36), 1.0, 420, 0.025, {a: 0.03}, -0.3, 0.25);
    tone(f2t('VF4_PricedIn', 72), 1.2, 420, 0.03, {a: 0.03}, 0.3, 0.55);
    for (let k = 0; k < 8; k++) {
      tone(f2t('VF4_PricedIn', 116) + trk.rnd() * 0.06, 1.2 + trk.rnd() * 0.8, 1400 + trk.rnd() * 2600, 0.012, {a: 0.004, curve: 2.6}, trk.rnd() * 1.4 - 0.7);
    }
    // VF5 — three scenario dots, EV roll, three source stamps
    [30, 44, 58].forEach((f, i) => tone(f2t('VF5_Scenarios', f + 4), 0.4, 520 + i * 180, 0.022, {a: 0.006, curve: 2.4}, i - 1));
    tone(f2t('VF5_Scenarios', 84), 2.0, E4, 0.026, {a: 0.4});
    [108, 118, 128].forEach((f) => {
      kick(f2t('VF5_Scenarios', f), 0.05, 150, 95, 0.09);
      tick(f2t('VF5_Scenarios', f), 0.02, 2500);
    });
  }

  if (short === 'macro') {
    // the strategic heartbeat under the whole chapter
    for (const sc of ['VM1_Board', 'VM2_Players', 'VM3_Paths', 'VM4_Horizons', 'VM5_Asymmetry']) {
      pad(f2t(sc), sceneDur(sc), [D3], 0.05, {a: 0.9});
      const frames = shortSceneFrames(short, sc);
      for (let f = 24; f < frames - 12; f += 56) {
        tone(f2t(sc, f), 1.6, D3 / 2, 0.05, {a: 0.06, curve: 1.8});
      }
    }
    // VM1 — arcs whoosh + type ticks
    tone(f2t('VM1_Board', 20), 2.6, 240, 0.02, {a: 0.5}, -0.4, 0.6);
    tone(f2t('VM1_Board', 40), 2.6, 300, 0.018, {a: 0.5}, 0.4, 0.5);
    // VM2 — six card thunks, then map dots popping
    Array.from({length: 6}).forEach((_, i) => {
      kick(f2t('VM2_Players', 32 + i * 16), 0.07, 140, 85, 0.1);
      tick(f2t('VM2_Players', 32 + i * 16), 0.02, 2300);
    });
    tone(f2t('VM2_Players', 168), 0.8, 520, 0.02, {a: 0.02}, 0, 0.4);
    Array.from({length: 6}).forEach((_, i) => tick(f2t('VM2_Players', 180 + i * 8), 0.026, 2900 + i * 140, (i % 3) - 1));
    // VM3 — plotter ratchet as branches draw, ignition, beads
    for (let f = 14; f < 96; f += 4.5) tick(f2t('VM3_Paths', f), 0.013, 4300, 0.2);
    for (let f = 92; f < 128; f += 3) tick(f2t('VM3_Paths', f), 0.011, 5200, -0.2);
    riser(f2t('VM3_Paths', 150), 1.8, 0.04);
    impact(f2t('VM3_Paths', 150), 0.55);
    pad(f2t('VM3_Paths', 152), 3.4, [D3, A3, D4], 0.05, {a: 0.3, curve: 1.4});
    // VM4 — four horizon dots climbing
    [34, 51, 68, 85].forEach((f, i) => tone(f2t('VM4_Horizons', f + 4), 0.5, 440 * Math.pow(1.19, i), 0.024, {a: 0.006, curve: 2.4}, i * 0.3 - 0.45));
    // VM5 — dial sweep + the kill-condition stamp press
    tone(f2t('VM5_Asymmetry', 28), 1.3, 480, 0.022, {a: 0.03}, 0, 0.7);
    kick(f2t('VM5_Asymmetry', 150), 0.16, 120, 70, 0.18);
    tick(f2t('VM5_Asymmetry', 150), 0.03, 1600);
    pad(f2t('VM5_Asymmetry', 156), 2.8, [D3, 370], 0.03, {a: 0.4, curve: 1.6});
  }

  if (short === 'consensus') {
    for (const sc of ['VC1_Street', 'VC2_Desks', 'VC3_Band', 'VC4_BullBear', 'VC5_Flag']) {
      pad(f2t(sc), sceneDur(sc), [E3 / 2], 0.045, {a: 0.9});
    }
    // VC1 — scattered plucks warming up
    for (let i = 0; i < 12; i++) {
      tone(f2t('VC1_Street', 28 + i * 5.5), 0.4, 520 + trk.rnd() * 340, 0.016, {a: 0.006, curve: 2.4}, trk.rnd() - 0.5);
    }
    // VC2 — eight desk thunks + verify ticks
    Array.from({length: 8}).forEach((_, i) => {
      kick(f2t('VC2_Desks', 28 + i * 13), 0.06, 140, 85, 0.1);
      tick(f2t('VC2_Desks', 42 + i * 13), 0.02, 3400, (i % 3) - 1);
    });
    // VC3 — plucks converging into one sustained tone at the merge
    Array.from({length: 8}).forEach((_, i) => tone(f2t('VC3_Band', 26 + i * 7), 0.4, 480 + i * 55, 0.017, {a: 0.006, curve: 2.4}, (i % 3) - 1));
    tone(f2t('VC3_Band', 88), 2.6, E4, 0.032, {a: 0.5});
    kick(f2t('VC3_Band', 108), 0.08, 100, 55, 0.24);
    // VC4 — two soft chord hits, bull brighter, bear darker
    pad(f2t('VC4_BullBear', 28), 2.6, [E3, B3, E4], 0.045, {a: 0.2, curve: 1.5});
    pad(f2t('VC4_BullBear', 54), 2.6, [E3, G3, B3], 0.045, {a: 0.2, curve: 1.7});
    // VC5 — drift tension + the flag stamp
    riser(f2t('VC5_Flag', 82), 1.9, 0.035);
    kick(f2t('VC5_Flag', 82), 0.14, 120, 70, 0.18);
    tick(f2t('VC5_Flag', 82), 0.03, 1600);
    pad(f2t('VC5_Flag', 96), 2.4, [A3, D4, E4], 0.032, {a: 0.6});
  }

  /* ------------------------------ spine close ----------------------------- */
  // V10 — riser into the fusion, impact, major lift
  pad(f2t('V10_Fusion'), 4.5, [E3 / 2], 0.05, {a: 0.8});
  riser(fuseT, 2.6, 0.06);
  impact(fuseT, 1);
  pad(f2t('V10_Fusion', 110), 4.2, [A2, E3, A3, CS4], 0.06, {a: 0.3, curve: 1.4});

  // V11 — heartbeat dot, the score lands, board ratchets in
  for (let k = 0; k < 2; k++) kick(f2t('V11_Verdict', 4 + k * 24), 0.14, 74, 46, 0.3);
  pad(f2t('V11_Verdict', 46), 3.0, [A2, E3, CS4, E4], 0.075, {a: 0.15, curve: 1.6});
  kick(f2t('V11_Verdict', 46), 0.2, 88, 44, 0.4);
  for (const w of [[84, 108], [100, 122], [112, 134]] as Array<[number, number]>) {
    for (let f = w[0]; f < w[1]; f += 4) tick(f2t('V11_Verdict', f), 0.013, 4300, 0.2);
  }

  // V12 — wire ticks + stamp presses under the real UI
  pad(f2t('V12_Receipts'), 6.4, [D3, A3, D4], 0.045, {a: 1.6});
  for (let i = 0; i < 8; i++) tick(f2t('V12_Receipts', 16 + i * 11), 0.02, 3300, 0.4);
  for (let i = 0; i < 4; i++) {
    kick(f2t('V12_Receipts', 62 + i * 9), 0.05, 150, 95, 0.09);
    tick(f2t('V12_Receipts', 62 + i * 9), 0.018, 2500);
  }

  // V13 — resolve and decay
  pad(f2t('V13_Endcard', 12), 5.2, [A2, E3, A3, CS4, E4], 0.075, {a: 1.0, curve: 1.2});
  kick(f2t('V13_Endcard', 56), 0.13, 70, 44, 0.35);
  kick(f2t('V13_Endcard', 68), 0.07, 64, 42, 0.3);
  kick(f2t('V13_Endcard', 132), 0.14, 70, 44, 0.4);
  pad(f2t('V13_Endcard', 84), 3.2, [A2 / 2, A2], 0.045, {a: 0.9});

  const out = join(here, '..', 'public', 'audio', `score-${short}.wav`);
  const res = trk.finalize(out);
  console.log(
    `score-${short}.wav written: ${res.mb.toFixed(1)} MB, ${res.dur.toFixed(1)}s, peak norm ×${res.norm.toFixed(2)}`,
  );
}
