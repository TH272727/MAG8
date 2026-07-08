import {interpolate, random, spring} from 'remotion';
import {FPS} from '../theme';

/** Clamped interpolate — the 99% case. */
export const lerp = (
  frame: number,
  range: [number, number],
  out: [number, number],
  easing?: (t: number) => number,
) =>
  interpolate(frame, range, out, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** Fifth-order smooth — buttery pans. */
export const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Snappy UI spring (chips, glyph landings). */
export const pop = (frame: number, delay = 0, damping = 12, mass = 0.7) =>
  spring({frame: frame - delay, fps: FPS, config: {damping, mass, stiffness: 130}});

/** Softer spring for big set pieces. */
export const settle = (frame: number, delay = 0) =>
  spring({frame: frame - delay, fps: FPS, config: {damping: 16, mass: 1, stiffness: 90}});

/** Deterministic 0..1 from any seed. */
export const rnd = (seed: string | number) => random(seed);

/** Deterministic value in [lo, hi). */
export const rndIn = (seed: string | number, lo: number, hi: number) =>
  lo + random(seed) * (hi - lo);

/** 0→1→0 triangle window with easing, for pulses. */
export const pulse01 = (t: number) => Math.sin(Math.PI * Math.min(Math.max(t, 0), 1));

/** Heartbeat: sharp attack, slow decay. period + frame → 0..1 */
export const heartbeat = (frame: number, periodFrames: number, phase = 0) => {
  const t = ((frame + phase) % periodFrames) / periodFrames;
  return t < 0.12 ? easeOut(t / 0.12) : 1 - easeIn(Math.min((t - 0.12) / 0.88, 1));
};

/** Blink: on/off cursor with duty cycle. */
export const blink = (frame: number, periodFrames = 16) =>
  frame % periodFrames < periodFrames * 0.55;
