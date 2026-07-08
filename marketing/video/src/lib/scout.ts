import {rndIn} from './anim';

/** The S5 index field — shared with S6 for continuity. */
export const COLS = 24;
export const ROWS = 7;

export type Block = {x: number; y: number; jitter: number; id: number};

export const BLOCKS: Block[] = Array.from({length: COLS * ROWS}, (_, id) => {
  const c = id % COLS;
  const r = Math.floor(id / COLS);
  return {
    id,
    x: 178 + c * 67,
    y: 442 + r * 80,
    jitter: rndIn(`blk${id}`, 0.45, 0.95),
  };
});

/** The eight blocks the scout lifts, spread across the field. */
export const CHOSEN_IDS = [
  3 * COLS + 2,
  1 * COLS + 5,
  5 * COLS + 7,
  2 * COLS + 10,
  4 * COLS + 12,
  1 * COLS + 15,
  3 * COLS + 18,
  5 * COLS + 21,
];

export const CHOSEN = CHOSEN_IDS.map((id) => BLOCKS[id]).sort((a, b) => a.x - b.x);

export const threadPath = (): string =>
  CHOSEN.map((b, i) => `${i === 0 ? 'M' : 'L'} ${b.x} ${b.y}`).join(' ');
