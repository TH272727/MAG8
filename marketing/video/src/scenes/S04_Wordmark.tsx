import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Center, Chip, Void} from '../lib/ui';
import {lerp, pop} from '../lib/anim';
import {C, F} from '../theme';

const TICKS = [C.discovery, C.fundamentals, C.macro, C.consensus];

/** S4 — Introducing MAG8: letters racked like instruments. */
export const S04_Wordmark: React.FC = () => {
  const frame = useCurrentFrame();
  const recede = lerp(frame, [134, 162], [0, 1]);
  const introOp = lerp(frame, [26, 36], [0, 1]);
  const introDim = lerp(frame, [62, 74], [1, 0.4]);
  return (
    <Void>
      <Center>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 34,
            opacity: 1 - recede,
            transform: `scale(${1 - recede * 0.05})`,
          }}
        >
          <div style={{opacity: lerp(frame, [6, 18], [0, 1])}}>
            <Chip size={20}>FOUR-LENS RESEARCH DESK</Chip>
          </div>
          <div
            style={{
              fontFamily: F.body,
              fontSize: 36,
              fontWeight: 400,
              color: C.muted,
              opacity: introOp * introDim,
            }}
          >
            Introducing
          </div>
          <div style={{display: 'flex', letterSpacing: '0.08em', marginTop: -6}}>
            {['M', 'A', 'G', '8'].map((ch, i) => {
              const s = pop(frame, 58 + i * 7, 13, 1);
              const op = lerp(frame, [58 + i * 7, 58 + i * 7 + 6], [0, 1]);
              return (
                <span
                  key={ch}
                  style={{
                    fontFamily: F.display,
                    fontSize: 268,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: C.ink,
                    display: 'inline-block',
                    opacity: op,
                    transform: `translateY(${(1 - s) * -95}px) scale(${1.04 - s * 0.04})`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
          <div style={{display: 'flex', gap: 26, marginTop: 8}}>
            {TICKS.map((color, i) => (
              <div
                key={color}
                style={{
                  width: 30,
                  height: 4.5,
                  borderRadius: 3,
                  background: color,
                  opacity: lerp(frame, [98 + i * 4, 108 + i * 4], [0, 0.95]),
                  transform: `translateY(${lerp(frame, [98 + i * 4, 110 + i * 4], [6, 0])}px)`,
                }}
              />
            ))}
          </div>
        </div>
      </Center>
    </Void>
  );
};
