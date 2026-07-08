import React, {useEffect, useState} from 'react';
import {Composition, Series, continueRender, delayRender, Audio, staticFile} from 'remotion';
import {FPS, H, W} from './theme';
import {SCENES, TOTAL_FRAMES} from './timeline';
import {loadAllFonts} from './lib/fonts';

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
