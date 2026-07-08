/**
 * Single source of truth for scene order and duration (frames @ 30fps).
 * scripts/gen-score.ts imports this to place musical hits — keep erasable-TS
 * only (plain const, no enums) so Node can strip types natively.
 */
export type SceneDef = {
  id: string;
  frames: number;
};

/* 2026-07-08 pacing pass: text-heavy scenes hold ~0.5–0.7s longer so the
 * lines can actually be read (viewer feedback). Scene-internal beats keep
 * their absolute frames; only the tail holds grew — except S03/S07/S08/S09/
 * S17/S21, whose exit keyframes moved out by the same amount in their files. */
export const SCENES: SceneDef[] = [
  {id: 'S01_Search', frames: 150},
  {id: 'S02_Noise', frames: 150},
  {id: 'S03_Trash', frames: 180},
  {id: 'S04_Wordmark', frames: 165},
  {id: 'S05_Scout', frames: 180},
  {id: 'S06_Lanes', frames: 180},
  {id: 'S07_Fundamentals', frames: 165},
  {id: 'S08_Macro', frames: 165},
  {id: 'S09_Consensus', frames: 165},
  {id: 'S10_Convergence', frames: 180},
  {id: 'S11_Verdict', frames: 180},
  {id: 'S12_Leaderboard', frames: 195},
  {id: 'S13_Mission', frames: 195},
  {id: 'S14_Receipts', frames: 180},
  {id: 'S15_Blind', frames: 165},
  {id: 'S16_Disagree', frames: 168},
  {id: 'S17_Stamp', frames: 165},
  {id: 'S18_Alignment', frames: 186},
  {id: 'S19_Archive', frames: 153},
  {id: 'S20_Method', frames: 150},
  {id: 'S21_Endcard', frames: 225},
];

export const sceneStart = (id: string): number => {
  let acc = 0;
  for (const s of SCENES) {
    if (s.id === id) return acc;
    acc += s.frames;
  }
  throw new Error(`unknown scene ${id}`);
};

export const TOTAL_FRAMES = SCENES.reduce((a, s) => a + s.frames, 0);
