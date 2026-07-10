import React, {useEffect, useState} from 'react';
import {Composition, Series, continueRender, delayRender, Audio, staticFile} from 'remotion';
import {FPS, H, W} from './theme';
import {SCENES, TOTAL_FRAMES} from './timeline';
import {loadAllFonts} from './lib/fonts';
import {SHORT_IDS, VH, VW, shortScenes, shortTotal} from './shorts/timeline';
import type {ShortId} from './shorts/timeline';
import {ShortCtx} from './shorts/vlib';
import {FUN_IDS, funScenes, funTotal} from './fun/timeline';
import type {FunId} from './fun/timeline';

import {E1_Ask, E2_Shake, E3_Toys, E4_Desk, E5_End} from './fun/scenes/eightball';
import {G1_Chat, G2_Cut, G3_Line, G4_Desk, G5_End} from './fun/scenes/groupchat';
import {B1_Queue, B2_Checks, B3_Line, B4_Board, B5_End} from './fun/scenes/gate';
import {R1_Swipe1, R2_Swipe2, R3_Keeper, R4_Desk, R5_End} from './fun/scenes/redflags';
import {N1_Field, N2_Herd, N3_Cliff, N4_Desk, N5_End} from './fun/scenes/naturedoc';
import {SP1_Title, SP2_Run, SP3_Line, SP4_Desk, SP5_End} from './fun/scenes/speedrun';
import {RP1_Live, RP2_Play, RP3_Replay, RP4_Desk, RP5_End} from './fun/scenes/replay';
import {K1_File, K2_Board, K3_Twist, K4_Desk, K5_End} from './fun/scenes/coldcase';
import {DN1_Vials, DN2_Helix, DN3_Match, DN4_Desk, DN5_End} from './fun/scenes/dnatest';
import {Y1_Cover, Y2_Pages, Y3_Class, Y4_Desk, Y5_End} from './fun/scenes/yearbook';
import {PK1_Table, PK2_Reads, PK3_Forced, PK4_Odds, PK5_Desk, PK6_End} from './fun/scenes/poker';
import {WX1_Studio, WX2_Map, WX3_Curve, WX4_Warning, WX5_Desk, WX6_End} from './fun/scenes/forecast';

import {V01_Hook} from './shorts/scenes/V01_Hook';
import {V02_Intro} from './shorts/scenes/V02_Intro';
import {V03_Scout} from './shorts/scenes/V03_Scout';
import {V04_Lanes} from './shorts/scenes/V04_Lanes';
import {V10_Fusion} from './shorts/scenes/V10_Fusion';
import {V11_Verdict} from './shorts/scenes/V11_Verdict';
import {V12_Receipts} from './shorts/scenes/V12_Receipts';
import {V13_Endcard} from './shorts/scenes/V13_Endcard';
import {VF1_Books, VF2_Quality, VF3_Traps, VF4_PricedIn, VF5_Scenarios} from './shorts/scenes/VF_Fundamentals';
import {VM1_Board, VM2_Players, VM3_Paths, VM4_Horizons, VM5_Asymmetry} from './shorts/scenes/VM_Macro';
import {VC1_Street, VC2_Desks, VC3_Band, VC4_BullBear, VC5_Flag} from './shorts/scenes/VC_Consensus';

import {S01_Search} from './scenes/S01_Search';
import {S02_Noise} from './scenes/S02_Noise';
import {S03_Trash} from './scenes/S03_Trash';
import {S04_Wordmark} from './scenes/S04_Wordmark';
import {S05_Scout} from './scenes/S05_Scout';
import {S06_Lanes} from './scenes/S06_Lanes';
import {S07_Fundamentals} from './scenes/S07_Fundamentals';
import {S08_Macro} from './scenes/S08_Macro';
import {S09_Consensus} from './scenes/S09_Consensus';
import {S10_Convergence} from './scenes/S10_Convergence';
import {S11_Verdict} from './scenes/S11_Verdict';
import {S12_Leaderboard} from './scenes/S12_Leaderboard';
import {S13_Mission} from './scenes/S13_Mission';
import {S14_Receipts} from './scenes/S14_Receipts';
import {S15_Blind} from './scenes/S15_Blind';
import {S16_Disagree} from './scenes/S16_Disagree';
import {S17_Stamp} from './scenes/S17_Stamp';
import {S18_Alignment} from './scenes/S18_Alignment';
import {S19_Archive} from './scenes/S19_Archive';
import {S20_Method} from './scenes/S20_Method';
import {S21_Endcard} from './scenes/S21_Endcard';

const REGISTRY: Record<string, React.FC> = {
  S01_Search,
  S02_Noise,
  S03_Trash,
  S04_Wordmark,
  S05_Scout,
  S06_Lanes,
  S07_Fundamentals,
  S08_Macro,
  S09_Consensus,
  S10_Convergence,
  S11_Verdict,
  S12_Leaderboard,
  S13_Mission,
  S14_Receipts,
  S15_Blind,
  S16_Disagree,
  S17_Stamp,
  S18_Alignment,
  S19_Archive,
  S20_Method,
  S21_Endcard,
};

/** Blocks rendering until the vendored brand fonts are registered. */
const WithFonts: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [handle] = useState(() => delayRender('brand fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadAllFonts()
      .then(() => {
        if (alive) setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        // Render with fallbacks rather than hanging forever.
        console.error('font load failed', e);
        if (alive) setReady(true);
        continueRender(handle);
      });
    return () => {
      alive = false;
    };
  }, [handle]);
  return ready ? <>{children}</> : null;
};

const TheSignal: React.FC = () => (
  <WithFonts>
    <Series>
      {SCENES.map((s) => {
        const Scene = REGISTRY[s.id];
        return (
          <Series.Sequence key={s.id} durationInFrames={s.frames} name={s.id}>
            <Scene />
          </Series.Sequence>
        );
      })}
    </Series>
    <Audio src={staticFile('audio/score.wav')} />
  </WithFonts>
);

/* ------------------------- the three lens shorts ------------------------- */

const SHORT_REGISTRY: Record<string, React.FC> = {
  V01_Hook,
  V02_Intro,
  V03_Scout,
  V04_Lanes,
  V10_Fusion,
  V11_Verdict,
  V12_Receipts,
  V13_Endcard,
  VF1_Books,
  VF2_Quality,
  VF3_Traps,
  VF4_PricedIn,
  VF5_Scenarios,
  VM1_Board,
  VM2_Players,
  VM3_Paths,
  VM4_Horizons,
  VM5_Asymmetry,
  VC1_Street,
  VC2_Desks,
  VC3_Band,
  VC4_BullBear,
  VC5_Flag,
};

const makeShort = (short: ShortId): React.FC => {
  const TheShort: React.FC = () => (
    <WithFonts>
      <ShortCtx.Provider value={short}>
        <Series>
          {shortScenes(short).map((s) => {
            const Scene = SHORT_REGISTRY[s.id];
            return (
              <Series.Sequence key={s.id} durationInFrames={s.frames} name={s.id}>
                <Scene />
              </Series.Sequence>
            );
          })}
        </Series>
        <Audio src={staticFile(`audio/score-${short}.wav`)} />
      </ShortCtx.Provider>
    </WithFonts>
  );
  return TheShort;
};

const SHORT_COMPS = SHORT_IDS.map((short) => ({
  short,
  id: `Short-${short[0].toUpperCase()}${short.slice(1)}`,
  Comp: makeShort(short),
}));

/* --------------------------- the fun campaign --------------------------- */

const FUN_REGISTRY: Record<string, React.FC> = {
  E1_Ask,
  E2_Shake,
  E3_Toys,
  E4_Desk,
  E5_End,
  G1_Chat,
  G2_Cut,
  G3_Line,
  G4_Desk,
  G5_End,
  B1_Queue,
  B2_Checks,
  B3_Line,
  B4_Board,
  B5_End,
  R1_Swipe1,
  R2_Swipe2,
  R3_Keeper,
  R4_Desk,
  R5_End,
  N1_Field,
  N2_Herd,
  N3_Cliff,
  N4_Desk,
  N5_End,
  SP1_Title,
  SP2_Run,
  SP3_Line,
  SP4_Desk,
  SP5_End,
  RP1_Live,
  RP2_Play,
  RP3_Replay,
  RP4_Desk,
  RP5_End,
  K1_File,
  K2_Board,
  K3_Twist,
  K4_Desk,
  K5_End,
  DN1_Vials,
  DN2_Helix,
  DN3_Match,
  DN4_Desk,
  DN5_End,
  Y1_Cover,
  Y2_Pages,
  Y3_Class,
  Y4_Desk,
  Y5_End,
  PK1_Table,
  PK2_Reads,
  PK3_Forced,
  PK4_Odds,
  PK5_Desk,
  PK6_End,
  WX1_Studio,
  WX2_Map,
  WX3_Curve,
  WX4_Warning,
  WX5_Desk,
  WX6_End,
};

const makeFun = (id: FunId): React.FC => {
  const TheFun: React.FC = () => (
    <WithFonts>
      <Series>
        {funScenes(id).map((s) => {
          const Scene = FUN_REGISTRY[s.id];
          return (
            <Series.Sequence key={s.id} durationInFrames={s.frames} name={s.id}>
              <Scene />
            </Series.Sequence>
          );
        })}
      </Series>
      <Audio src={staticFile(`audio/score-fun-${id}.wav`)} />
    </WithFonts>
  );
  return TheFun;
};

const FUN_COMPS = FUN_IDS.map((id) => ({
  id,
  compId: `Fun-${id[0].toUpperCase()}${id.slice(1)}`,
  Comp: makeFun(id),
}));

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="TheSignal"
      component={TheSignal}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={W}
      height={H}
    />
    {SHORT_COMPS.map(({short, id, Comp}) => (
      <Composition
        key={id}
        id={id}
        component={Comp}
        durationInFrames={shortTotal(short)}
        fps={FPS}
        width={VW}
        height={VH}
      />
    ))}
    {FUN_COMPS.map(({id, compId, Comp}) => (
      <Composition
        key={compId}
        id={compId}
        component={Comp}
        durationInFrames={funTotal(id)}
        fps={FPS}
        width={VW}
        height={VH}
      />
    ))}
    {SCENES.map((s) => {
      const Scene = REGISTRY[s.id];
      const Wrapped: React.FC = () => (
        <WithFonts>
          <Scene />
        </WithFonts>
      );
      return (
        <Composition
          key={s.id}
          id={s.id.replace('_', '-')}
          component={Wrapped}
          durationInFrames={s.frames}
          fps={FPS}
          width={W}
          height={H}
        />
      );
    })}
  </>
);
