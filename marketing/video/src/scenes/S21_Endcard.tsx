import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Void, WaitlistCta} from '../lib/ui';
import {lerp, pop, pulse01} from '../lib/anim';
import {C, F} from '../theme';

/** S21 — Endcard: the mark, the wordmark, one last heartbeat. No URL yet. */
export const S21_Endcard: React.FC = () => {
  const frame = useCurrentFrame();
  const markIn = pop(frame, 8, 14, 1);
  const beat = Math.max(pulse01((frame - 62) / 26), pulse01((frame - 168) / 26));
  const fadeOut = lerp(frame, [211, 225], [0, 1]);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        {/* the four-blade mark, ink-rimmed (never gold) */}
        <div
          style={{
            marginTop: 262,
            opacity: Math.min(markIn * 1.3, 1),
            transform: `scale(${0.82 + markIn * 0.18})`,
            filter:
              'drop-shadow(0 0 1px rgba(231,234,238,0.62)) drop-shadow(0 0 6px rgba(231,234,238,0.26)) drop-shadow(0 0 18px rgba(231,234,238,0.10))',
          }}
        >
          <Img src={staticFile('brand/mark.png')} style={{width: 148, height: 148}} />
        </div>

        {/* wordmark with the gold-dot period */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 30,
            opacity: lerp(frame, [26, 44], [0, 1]),
          }}
        >
          <span
            style={{
              fontFamily: F.display,
              fontSize: 172,
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
              width: 22,
              height: 22,
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
            marginTop: 34,
            fontFamily: F.body,
            fontSize: 42,
            fontWeight: 400,
            color: C.muted,
            opacity: lerp(frame, [48, 66], [0, 1]),
          }}
        >
          The next trillion-dollar leaderboard.
        </div>

        <div style={{marginTop: 62}}>
          <WaitlistCta at={92} size={56} />
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 96,
            fontFamily: F.mono,
            fontSize: 22,
            letterSpacing: '0.16em',
            color: C.muted,
            opacity: lerp(frame, [108, 124], [0, 1]),
          }}
        >
          RESEARCH, NOT INVESTMENT ADVICE
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: fadeOut, pointerEvents: 'none'}} />
    </Void>
  );
};
