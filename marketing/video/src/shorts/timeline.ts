/**
 * Timing tables for the three vertical lens shorts (1080×1920 @ 30fps).
 * Same contract as src/timeline.ts: this file is the single source of truth
 * for scene order/duration, and scripts/gen-score-shorts.ts imports it to
 * place musical hits. Keep erasable-TS only (plain consts) for Node.
 *
 * Every short tells the WHOLE MAG8 story (hook → name → scout → blind lanes
 * → fusion → verdict → real UI → endcard) and spends its middle chapter deep
 * inside ONE lens. Text-heavy beats get long holds by design (readers first).
 */
export type SceneDef = {id: string; frames: number};
export type ShortId = 'fundamentals' | 'macro' | 'consensus';

export const VW = 1080;
export const VH = 1920;

/** Shared opening spine: the problem, the name, the system.
 * 2026-07-08 intro pass: V01 grew +120f — the question now pops huge, holds
 * ~2.4s, shrinks into the pill, and THEN the screaming flood starts. */
const SPINE_OPEN: SceneDef[] = [
  {id: 'V01_Hook', frames: 300},
  {id: 'V02_Intro', frames: 150},
  {id: 'V03_Scout', frames: 150},
  {id: 'V04_Lanes', frames: 150},
];

/** Shared closing spine: fusion, verdict, receipts, endcard. */
const SPINE_CLOSE: SceneDef[] = [
  {id: 'V10_Fusion', frames: 189},
  {id: 'V11_Verdict', frames: 165},
  {id: 'V12_Receipts', frames: 195},
  {id: 'V13_Endcard', frames: 165},
];

/** The specialized middle chapter, one per lens. */
const DEEP: Record<ShortId, SceneDef[]> = {
  fundamentals: [
    {id: 'VF1_Books', frames: 165},
    {id: 'VF2_Quality', frames: 180},
    {id: 'VF3_Traps', frames: 180},
    {id: 'VF4_PricedIn', frames: 195},
    {id: 'VF5_Scenarios', frames: 180},
  ],
  macro: [
    {id: 'VM1_Board', frames: 165},
    {id: 'VM2_Players', frames: 255},
    {id: 'VM3_Paths', frames: 270},
    {id: 'VM4_Horizons', frames: 165},
    {id: 'VM5_Asymmetry', frames: 195},
  ],
  consensus: [
    {id: 'VC1_Street', frames: 165},
    {id: 'VC2_Desks', frames: 210},
    {id: 'VC3_Band', frames: 210},
    {id: 'VC4_BullBear', frames: 180},
    {id: 'VC5_Flag', frames: 156},
  ],
};

export const SHORT_IDS: ShortId[] = ['fundamentals', 'macro', 'consensus'];

export const shortScenes = (short: ShortId): SceneDef[] => [
  ...SPINE_OPEN,
  ...DEEP[short],
  ...SPINE_CLOSE,
];

export const shortTotal = (short: ShortId): number =>
  shortScenes(short).reduce((a, s) => a + s.frames, 0);

export const shortSceneStart = (short: ShortId, id: string): number => {
  let acc = 0;
  for (const s of shortScenes(short)) {
    if (s.id === id) return acc;
    acc += s.frames;
  }
  throw new Error(`unknown scene ${id} in short ${short}`);
};

export const shortSceneFrames = (short: ShortId, id: string): number => {
  const s = shortScenes(short).find((x) => x.id === id);
  if (!s) throw new Error(`unknown scene ${id} in short ${short}`);
  return s.frames;
};
