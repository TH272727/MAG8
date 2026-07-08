import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Center, Void} from '../lib/ui';
import {BUBBLES, Bubble, SearchBar} from '../lib/setpieces';
import {lerp, pop} from '../lib/anim';

/** S2 — The answer is noise: hype bubbles bury the question. */
export const S02_Noise: React.FC = () => {
  const frame = useCurrentFrame();
  const creep = lerp(frame, [0, 150], [1, 1.045]);
  return (
    <Void depth>
      <AbsoluteFill style={{transform: `scale(${creep})`}}>
        <Center>
          <SearchBar done appear={-99} />
        </Center>
        {BUBBLES.map((b) => {
          const delay = 10 + b.order * 7;
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
