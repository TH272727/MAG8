/**
 * Procedural scores for the chart films — same synthesis language as
 * gen-score.ts / gen-score-shorts.ts / gen-score-fun.ts (no samples, no external
 * assets, no spend), one WAV per chart, every hit placed off the chart's own
 * frame budget so a re-cut and its score can never drift apart.
 *
 *   node scripts/gen-score-chart.ts            → every chart
 *   node scripts/gen-score-chart.ts mag7-10k   → one
 *
 * The format wants a bed that BUILDS: the race is one long crescendo with a
 * tick on every year boundary, so the ear learns the passage of time the same
 * way the big date teaches it to the eye.
 */
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CHART_IDS, CHART_SPECS} from '../src/charts/jobs.ts';
import {beatsOf, totalFrames} from '../src/charts/spec.ts';

const SR = 48000;
const FPS = 30;
const here = dirname(fileURLToPath(import.meta.url));

type Env = {a?: number; r?: number; curve?: number};

const createTrack = (totalF: number) => {
  const DUR = totalF / FPS + 0.5;
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

  const tone = (t0: number, dur: number, freq: number, amp: number, env: Env = {}, pan = 0, drift = 0) => {
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
      const v = Math.sin(2 * Math.PI * f * (i / SR)) * amp * Math.pow(1 - u, 2.4);
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
      tone(t0 + rnd() * 0.05, 1.7 + rnd() * 1.4, 1150 + rnd() * 3400, 0.014 * amp, {a: 0.004, curve: 2.6}, rnd() * 1.6 - 0.8);
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
      const v = Math.sin(phase + 2 * Math.PI * (180 + 900 * u * u) * (i / SR)) * amp * u * u;
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
    const fadeOutStart = Math.floor((totalF / FPS - 1.1) * SR);
    for (let i = 0; i < N; i++) {
      let g = 1;
      if (i < fadeIn) g = i / fadeIn;
      if (i > fadeOutStart) g *= Math.max(1 - (i - fadeOutStart) / (N - fadeOutStart), 0);
      L[i] *= g;
      R[i] *= g;
    }
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const norm = peak > 0 ? Math.pow(10, -3.5 / 20) / peak : 1;
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
      bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
      bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
    }
    mkdirSync(dirname(outPath), {recursive: true});
    writeFileSync(outPath, bytes);
    return {mb: bytes.length / 1e6, dur: DUR, norm};
  };

  return {tone, kick, tick, pop, impact, riser, pad, finalize, rnd};
};

const A2 = 110, C3 = 130.81, E3 = 164.81, G3 = 196, A3 = 220, CS4 = 277.18, D4 = 293.66, E4 = 329.63;

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
for (const id of ids.length ? ids : CHART_IDS) {
  const spec = CHART_SPECS[id];
  if (!spec) {
    console.error(`unknown chart "${id}"`);
    process.exit(1);
  }
  const b = beatsOf(spec);
  const total = totalFrames(spec);
  const t = (f: number) => f / FPS;
  const trk = createTrack(total);

  const raceStart = b.hook;
  const raceEnd = raceStart + b.race;
  const payoff = raceEnd;
  const endcard = payoff + b.payoff;
  /** The frame the chart actually finishes drawing — clib holds it for 46. */
  const settled = raceEnd - 46;

  // Hook — one low swell, the question landing, the shrink. Skipped in the
  // default cut, which has no hook beat at all.
  if (b.hook > 0) {
    trk.pad(t(0), t(b.hook) + 0.6, [A2, E3], 0.038, {a: 0.5});
    trk.kick(t(4), 0.2, 88, 40, 0.42);
    trk.tone(t(4), 1.5, 82, 0.05, {a: 0.006, curve: 1.5});
    trk.tick(t(58), 0.022, 3000);
  }

  /*
   * Race — the whole film in the default cut, so the bed has to carry it alone:
   * a chord that climbs a fifth every quarter of the run, a kick that firms up
   * as the lines separate, and a tick every ~1.5s standing in for the years
   * going by. It opens ON the downbeat rather than fading in from a card.
   */
  const chords = [
    [C3, G3],
    [C3, G3, A3],
    [A2, E3, A3],
    [A3, CS4, E4],
  ];
  const quarter = b.race / 4;
  chords.forEach((ch, i) => {
    trk.pad(t(raceStart + i * quarter), t(quarter) + 0.8, ch, 0.03 + i * 0.004, {a: 1.2});
  });
  if (b.hook === 0) {
    // Open on a mark, not on a fade — a scroller meets the film mid-motion.
    trk.kick(t(raceStart + 2), 0.18, 86, 40, 0.4);
    trk.tone(t(raceStart + 2), 1.4, 82, 0.045, {a: 0.006, curve: 1.5});
  }
  for (let f = raceStart + 6; f < settled - 6; f += 15) {
    const u = (f - raceStart) / b.race;
    trk.kick(t(f), 0.075 + u * 0.07, 78, 40, 0.24);
  }
  for (let f = raceStart + 30; f < settled - 20; f += 45) {
    const u = (f - raceStart) / b.race;
    trk.tick(t(f), 0.014 + u * 0.014, 2600 + u * 1400, (trk.rnd() - 0.5) * 1.2);
  }
  trk.riser(t(settled), 2.6, 0.05);

  /*
   * The landing. With no payoff card and no endcard, the last thing the ear
   * gets is the chart arriving: one soft impact as the final point lands, then
   * a chord left ringing under the held frame. That held frame is the loop
   * point, so the tail resolves rather than trailing off unfinished.
   */
  trk.impact(t(settled), b.payoff > 0 ? 0.4 : 0.5);
  trk.pad(t(settled), t(raceEnd - settled) + 1.4, [A3, CS4, E4], 0.036, {a: 0.5});
  trk.tick(t(settled + 16), 0.02, 3200);

  // Payoff — the impact, a pop per standing, the winner's figure.
  if (b.payoff > 0) {
    trk.impact(t(payoff), 0.55);
    trk.pad(t(payoff), t(b.payoff) + 0.8, [A3, CS4, E4], 0.034, {a: 0.7});
    for (let i = 0; i < 8; i++) trk.pop(t(payoff + 26 + i * 5), 0.028);
    trk.kick(t(payoff + 80), 0.18, 84, 42, 0.34);
    trk.tone(t(payoff + 80), 1.1, 165, 0.04, {a: 0.005, curve: 1.5});
    trk.tick(t(payoff + 96), 0.02, 3200);
  }

  // Endcard — the mark, the wordmark, the address, the ask.
  if (b.endcard > 0) {
    trk.pad(t(endcard), t(b.endcard) + 0.4, [A2, E3, A3], 0.036, {a: 1.0});
    trk.kick(t(endcard + 6), 0.16, 80, 40, 0.36);
    trk.tone(t(endcard + 22), 0.9, 220, 0.03, {a: 0.02, curve: 1.6});
    trk.tick(t(endcard + 52), 0.02, 3000);
    trk.tone(t(endcard + 70), 0.7, D4, 0.026, {a: 0.02, curve: 1.7});
    trk.pop(t(endcard + 92), 0.05);
    trk.pad(t(endcard + 92), 3.0, [A3, CS4, E4], 0.034, {a: 0.6});
    trk.tick(t(endcard + 126), 0.018, 3000);
  }

  const out = join(here, '..', 'public', 'audio', `score-chart-${id}.wav`);
  const res = trk.finalize(out);
  console.log(`score-chart-${id}.wav written: ${res.mb.toFixed(1)} MB, ${res.dur.toFixed(1)}s, peak norm x${res.norm.toFixed(2)}`);
}
