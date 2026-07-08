/**
 * Timing tables for the fun campaign shorts (1080×1920 @30fps) — snappy
 * meme-format episodes (~27–30s) that catch attention and hand off to the
 * brand. Same contract as the other timelines: this file is the single
 * source of truth for scene order/duration, and scripts/gen-score-fun.ts
 * imports it to place musical hits. Keep erasable-TS only (plain consts).
 */
export type SceneDef = {id: string; frames: number};
export type FunId = 'eightball' | 'groupchat' | 'gate' | 'redflags';

export const FUN: Record<FunId, SceneDef[]> = {
  /** "Not a magic 8-ball" — shake the toy, get toy answers, meet the desk. */
  eightball: [
    {id: 'E1_Ask', frames: 135},
    {id: 'E2_Shake', frames: 225},
    {id: 'E3_Toys', frames: 135},
    {id: 'E4_Desk', frames: 216},
    {id: 'E5_End', frames: 150},
  ],
  /** The group chat melts down over a ticker; the desk answers quietly. */
  groupchat: [
    {id: 'G1_Chat', frames: 246},
    {id: 'G2_Cut', frames: 96},
    {id: 'G3_Line', frames: 114},
    {id: 'G4_Desk', frames: 216},
    {id: 'G5_End', frames: 150},
  ],
  /** The bouncer bit — automatic vetoes at the velvet rope. */
  gate: [
    {id: 'B1_Queue', frames: 150},
    {id: 'B2_Checks', frames: 330},
    {id: 'B3_Line', frames: 108},
    {id: 'B4_Board', frames: 156},
    {id: 'B5_End', frames: 150},
  ],
  /** Dating-app red flags — value traps get swiped left. */
  redflags: [
    {id: 'R1_Swipe1', frames: 168},
    {id: 'R2_Swipe2', frames: 168},
    {id: 'R3_Keeper', frames: 186},
    {id: 'R4_Desk', frames: 192},
    {id: 'R5_End', frames: 150},
  ],
};

export const FUN_IDS: FunId[] = ['eightball', 'groupchat', 'gate', 'redflags'];

export const funScenes = (id: FunId): SceneDef[] => FUN[id];

export const funTotal = (id: FunId): number =>
  FUN[id].reduce((a, s) => a + s.frames, 0);

export const funSceneStart = (id: FunId, sceneId: string): number => {
  let acc = 0;
  for (const s of FUN[id]) {
    if (s.id === sceneId) return acc;
    acc += s.frames;
  }
  throw new Error(`unknown scene ${sceneId} in fun short ${id}`);
};

export const funSceneFrames = (id: FunId, sceneId: string): number => {
  const s = FUN[id].find((x) => x.id === sceneId);
  if (!s) throw new Error(`unknown scene ${sceneId} in fun short ${id}`);
  return s.frames;
};
