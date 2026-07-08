/**
 * Single source of truth for scene order and duration (frames @ 30fps).
 * scripts/gen-score.ts imports this to place musical hits — keep erasable-TS
 * only (plain const, no enums) so Node can strip types natively.
 */
export type SceneDef = {
  id: string;
  frames: number;
};

export const SCENES: SceneDef[] = [
  {id: 'S01_Search', frames: 150},
  {id: 'S02_Noise', frames: 150},
  {id: 'S03_Trash', frames: 165},
  {id: 'S04_Wordmark', frames: 165},
  {id: 'S05_Scout', frames: 165},
  {id: 'S06_Lanes', frames: 165},
  {id: 'S07_Fundamentals', frames: 150},
  {id: 'S08_Macro', frames: 150},
  {id: 'S09_Consensus', frames: 150},
  {id: 'S10_Convergence', frames: 180},
  {id: 'S11_Verdict', frames: 165},
  {id: 'S12_Leaderboard', frames: 180},
  {id: 'S13_Mission', frames: 180},
  {id: 'S14_Receipts', frames: 165},
  {id: 'S15_Blind', frames: 150},
  {id: 'S16_Disagree', frames: 150},
  {id: 'S17_Stamp', frames: 150},
  {id: 'S18_Alignment', frames: 165},
  {id: 'S19_Archive', frames: 135},
  {id: 'S20_Method', frames: 150},
  {id: 'S21_Endcard', frames: 210},
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
