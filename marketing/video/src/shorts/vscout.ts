import {rndIn} from '../lib/anim';

/** The V03 portrait index field — shared with V04 for continuity. */
export const VCOLS = 12;
export const VROWS = 12;

export type VBlock = {x: number; y: number; jitter: number; id: number};

export const VBLOCKS: VBlock[] = Array.from({length: VCOLS * VROWS}, (_, id) => {
  const c = id % VCOLS;
  const r = Math.floor(id / VCOLS);
  return {
    id,
    x: 122 + c * 76,
    y: 600 + r * 74,
    jitter: rndIn(`vblk${id}`, 0.45, 0.95),
  };
});

/** The eight the scout lifts, spread across the field. */
export const VCHOSEN_IDS = [
  2 * VCOLS + 2,
  1 * VCOLS + 8,
  4 * VCOLS + 5,
  3 * VCOLS + 10,
  6 * VCOLS + 1,
  7 * VCOLS + 7,
  9 * VCOLS + 3,
  10 * VCOLS + 9,
];

export const VCHOSEN = VCHOSEN_IDS.map((id) => VBLOCKS[id]).sort((a, b) => a.y - b.y);

export const vThreadPath = (): string =>
  VCHOSEN.map((b, i) => `${i === 0 ? 'M' : 'L'} ${b.x} ${b.y}`).join(' ');
