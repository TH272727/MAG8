/**
 * Timing tables for the fun campaign shorts (1080×1920 @30fps) — snappy
 * meme-format episodes (~27–30s) that catch attention and hand off to the
 * brand. Same contract as the other timelines: this file is the single
 * source of truth for scene order/duration, and scripts/gen-score-fun.ts
 * imports it to place musical hits. Keep erasable-TS only (plain consts).
 */
export type SceneDef = {id: string; frames: number};
export type FunId =
  | 'eightball'
  | 'groupchat'
  | 'gate'
  | 'redflags'
  | 'naturedoc'
  | 'speedrun'
  | 'replay'
  | 'coldcase'
  | 'dnatest'
  | 'yearbook'
  | 'poker'
  | 'forecast';

/** All endcards are 168f since the waitlist CTA landed (was 150). */
export const FUN: Record<FunId, SceneDef[]> = {
  /** "Not a magic 8-ball" — shake the toy, get toy answers, meet the desk. */
  eightball: [
    {id: 'E1_Ask', frames: 135},
    {id: 'E2_Shake', frames: 225},
    {id: 'E3_Toys', frames: 135},
    {id: 'E4_Desk', frames: 216},
    {id: 'E5_End', frames: 168},
  ],
  /** The group chat melts down over a ticker; the desk answers quietly. */
  groupchat: [
    {id: 'G1_Chat', frames: 246},
    {id: 'G2_Cut', frames: 96},
    {id: 'G3_Line', frames: 114},
    {id: 'G4_Desk', frames: 216},
    {id: 'G5_End', frames: 168},
  ],
  /** The bouncer bit — automatic vetoes at the velvet rope. */
  gate: [
    {id: 'B1_Queue', frames: 150},
    {id: 'B2_Checks', frames: 330},
    {id: 'B3_Line', frames: 108},
    {id: 'B4_Board', frames: 156},
    {id: 'B5_End', frames: 168},
  ],
  /** Dating-app red flags — value traps get swiped left. */
  redflags: [
    {id: 'R1_Swipe1', frames: 168},
    {id: 'R2_Swipe2', frames: 168},
    {id: 'R3_Keeper', frames: 186},
    {id: 'R4_Desk', frames: 192},
    {id: 'R5_End', frames: 168},
  ],
  /** Attenborough bit — the herd chases a ticker straight off a cliff. */
  naturedoc: [
    {id: 'N1_Field', frames: 144},
    {id: 'N2_Herd', frames: 228},
    {id: 'N3_Cliff', frames: 168},
    {id: 'N4_Desk', frames: 186},
    {id: 'N5_End', frames: 168},
  ],
  /** Speedrun HUD — a world-record run at losing money, splits and all. */
  speedrun: [
    {id: 'SP1_Title', frames: 126},
    {id: 'SP2_Run', frames: 336},
    {id: 'SP3_Line', frames: 114},
    {id: 'SP4_Desk', frames: 156},
    {id: 'SP5_End', frames: 168},
  ],
  /** Sports broadcast — buying the exact top, then the instant replay. */
  replay: [
    {id: 'RP1_Live', frames: 138},
    {id: 'RP2_Play', frames: 222},
    {id: 'RP3_Replay', frames: 216},
    {id: 'RP4_Desk', frames: 156},
    {id: 'RP5_End', frames: 168},
  ],
  /** True-crime — the evidence board for a bag that was avoidable. */
  coldcase: [
    {id: 'K1_File', frames: 132},
    {id: 'K2_Board', frames: 264},
    {id: 'K3_Twist', frames: 156},
    {id: 'K4_Desk', frames: 174},
    {id: 'K5_End', frames: 168},
  ],
  /** ENGINE SPECIAL (scout) — the lab sequences the trillion-dollar club's
   * genome, then a tiny unknown matches all six markers. */
  dnatest: [
    {id: 'DN1_Vials', frames: 174},
    {id: 'DN2_Helix', frames: 294},
    {id: 'DN3_Match', frames: 312},
    {id: 'DN4_Desk', frames: 204},
    {id: 'DN5_End', frames: 168},
  ],
  /** ENGINE SPECIAL (scout) — what the giants' yearbook photos looked like
   * before the trillion, and the Class of 2026 page being written now. */
  yearbook: [
    {id: 'Y1_Cover', frames: 180},
    {id: 'Y2_Pages', frames: 276},
    {id: 'Y3_Class', frames: 318},
    {id: 'Y4_Desk', frames: 204},
    {id: 'Y5_End', frames: 168},
  ],
  /** ENGINE SPECIAL (game theory) — the market as a felt table: players
   * scored M×E×C, the pot-committed forced move, priced-wrong pot odds,
   * and the kill condition. */
  poker: [
    {id: 'PK1_Table', frames: 180},
    {id: 'PK2_Reads', frames: 234},
    {id: 'PK3_Forced', frames: 252},
    {id: 'PK4_Odds', frames: 270},
    {id: 'PK5_Desk', frames: 198},
    {id: 'PK6_End', frames: 168},
  ],
  /** ENGINE SPECIAL (game theory) — Channel 8 Market Weather: pressure
   * systems as players, fronts as forced moves, horizon cones, and a
   * severe-asymmetry warning with a public kill condition. */
  forecast: [
    {id: 'WX1_Studio', frames: 234},
    {id: 'WX2_Map', frames: 246},
    {id: 'WX3_Curve', frames: 240},
    {id: 'WX4_Warning', frames: 264},
    {id: 'WX5_Desk', frames: 198},
    {id: 'WX6_End', frames: 168},
  ],
};

export const FUN_IDS: FunId[] = [
  'eightball',
  'groupchat',
  'gate',
  'redflags',
  'naturedoc',
  'speedrun',
  'replay',
  'coldcase',
  'dnatest',
  'yearbook',
  'poker',
  'forecast',
];

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
