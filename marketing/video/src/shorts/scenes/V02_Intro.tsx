import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Center, Chip, Kinetic, Void} from '../../lib/ui';
import {lerp, pop} from '../../lib/anim';
import {C, F} from '../../theme';

const TICKS = [C.discovery, C.fundamentals, C.macro, C.consensus];

/** V02 — Introducing MAG8, portrait cut of S04 + the one-line system promise. */
export const V02_Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const recede = lerp(frame, [139, 150], [0, 0.5]);
  return (
    <Void>
      <Center>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 40,
            opacity: 1 - recede,
            transform: `scale(${1 - recede * 0.05})`,
          }}
        >
          <div style={{opacity: lerp(frame, [6, 18], [0, 1])}}>
            <Chip size={19}>FOUR-LENS RESEARCH DESK</Chip>
          </div>
          <div style={{display: 'flex', letterSpacing: '0.08em'}}>
            {['M', 'A', 'G', '8'].map((ch, i) => {
              const s = pop(frame, 24 + i * 7, 13, 1);
              const op = lerp(frame, [24 + i * 7, 30 + i * 7], [0, 1]);
              return (
                <span
                  key={ch}
                  style={{
                    fontFamily: F.display,
                    fontSize: 216,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: C.ink,
                    display: 'inline-block',
                    opacity: op,
                    transform: `translateY(${(1 - s) * -85}px) scale(${1.04 - s * 0.04})`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
          <div style={{display: 'flex', gap: 24}}>
            {TICKS.map((color, i) => (
              <div
                key={color}
                style={{
                  width: 30,
                  height: 4.5,
                  borderRadius: 3,
                  background: color,
                  opacity: lerp(frame, [58 + i * 4, 68 + i * 4], [0, 0.95]),
                  transform: `translateY(${lerp(frame, [58 + i * 4, 70 + i * 4], [6, 0])}px)`,
                }}
              />
            ))}
          </div>
          <div style={{marginTop: 10}}>
            <Kinetic
              text={'One scout. Three lenses.\nOne verdict.'}
              delay={80}
              size={46}
              weight={500}
              color={C.muted}
              lineHeight={1.35}
            />
          </div>
        </div>
      </Center>
    </Void>
  );
};
