import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Center, Void} from '../lib/ui';
import {BUBBLES, Bubble, SearchBar} from '../lib/setpieces';
import {lerp, pop, rndIn} from '../lib/anim';

/**
 * S2 — The answer is noise: the crowd screams past itself and buries the
 * question. Denser wave than v1, with a creep-zoom and a shake that grows
 * with the pile — the room gets loud.
 */
export const S02_Noise: React.FC = () => {
  const frame = useCurrentFrame();
  const creep = lerp(frame, [0, 150], [1, 1.07]);
  const shakeAmp = lerp(frame, [36, 140], [0, 5]);
  const jx = rndIn(`nx${frame}`, -1, 1) * shakeAmp;
  const jy = rndIn(`ny${frame}`, -1, 1) * shakeAmp * 0.7;
  return (
    <Void depth>
      <AbsoluteFill style={{transform: `translate(${jx}px, ${jy}px) scale(${creep})`}}>
        <Center>
          <SearchBar done appear={-99} />
        </Center>
        {BUBBLES.map((b) => {
          const delay = 8 + b.order * 5;
          const s = pop(frame, delay, 11, 0.9);
          return (
            <Bubble
              key={b.text}
              spec={b}
              progress={s}
              wobblePhase={(frame / 30) * 2.1 + b.order * 1.7}
            />
          );
        })}
      </AbsoluteFill>
    </Void>
  );
};
