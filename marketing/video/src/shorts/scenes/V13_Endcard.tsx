import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Chip, Void} from '../../lib/ui';
import {lerp, pop, pulse01} from '../../lib/anim';
import {C, F} from '../../theme';
import {LENS, useShort} from '../vlib';

/** V13 — endcard: mark, wordmark, this short's lens tag, the disclaimer. */
export const V13_Endcard: React.FC = () => {
  const frame = useCurrentFrame();
  const short = useShort();
  const meta = LENS[short];
  const markIn = pop(frame, 6, 14, 1);
  const beat = Math.max(pulse01((frame - 56) / 26), pulse01((frame - 132) / 26));
  const fadeOut = lerp(frame, [152, 165], [0, 1]);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            marginTop: 520,
            opacity: Math.min(markIn * 1.3, 1),
            transform: `scale(${0.82 + markIn * 0.18})`,
            filter:
              'drop-shadow(0 0 1px rgba(231,234,238,0.62)) drop-shadow(0 0 6px rgba(231,234,238,0.26)) drop-shadow(0 0 18px rgba(231,234,238,0.10))',
          }}
        >
          <Img src={staticFile('brand/mark.png')} style={{width: 140, height: 140}} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 34,
            opacity: lerp(frame, [22, 40], [0, 1]),
          }}
        >
          <span
            style={{
              fontFamily: F.display,
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: C.ink,
              lineHeight: 1,
            }}
          >
            MAG8
          </span>
          <span
            style={{
              display: 'inline-block',
              width: 20,
              height: 20,
              borderRadius: 99,
              background: C.confluence,
              marginLeft: 2,
              transform: `scale(${1 + beat * 0.4})`,
              boxShadow: `0 0 ${16 + beat * 30}px ${C.confluence}88`,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 32,
            fontFamily: F.body,
            fontSize: 33,
            fontWeight: 400,
            color: C.muted,
            opacity: lerp(frame, [42, 58], [0, 1]),
          }}
        >
          The next trillion-dollar leaderboard.
        </div>

        <div style={{marginTop: 46, opacity: lerp(frame, [68, 84], [0, 1])}}>
          <Chip color={meta.color} border={`${meta.color}55`} bg={`${meta.color}0e`} size={17}>
            THIS EPISODE · {meta.chip}
          </Chip>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 190,
            fontFamily: F.mono,
            fontSize: 16,
            letterSpacing: '0.16em',
            color: C.dim,
            opacity: lerp(frame, [92, 108], [0, 1]),
          }}
        >
          RESEARCH, NOT INVESTMENT ADVICE
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: fadeOut, pointerEvents: 'none'}} />
    </Void>
  );
};
