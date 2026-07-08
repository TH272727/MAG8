import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Kinetic, Void} from '../lib/ui';
import {easeOut, lerp, pop, pulse01} from '../lib/anim';
import {C, F} from '../theme';

const CARD = {x: 650, y: 210, w: 620, h: 430};
const LINES = [
  {w: 380, hl: false},
  {w: 500, hl: false},
  {w: 350, hl: true},
  {w: 510, hl: false},
  {w: 300, hl: false},
];

/** S17 — Disclosed and re-checked: the gap gets a chip, the card gets a stamp. */
export const S17_Stamp: React.FC = () => {
  const frame = useCurrentFrame();
  const per = 2 * (CARD.w + CARD.h);
  const draw = lerp(frame, [4, 26], [0, 1], easeOut);
  const hlPulse = 0.55 + 0.45 * Math.sin(frame * 0.14);
  const stamp = pop(frame, 74, 15, 0.5);
  const stampOp = lerp(frame, [74, 79], [0, 1]);
  const chipS = pop(frame, 46, 14, 0.5);
  const toDark = lerp(frame, [138, 150], [0, 1]);

  return (
    <Void light>
      {/* report card */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <rect
          x={CARD.x}
          y={CARD.y}
          width={CARD.w}
          height={CARD.h}
          rx={18}
          fill="#ffffff"
          fillOpacity={Math.min(draw * 1.3, 1)}
          stroke="#c9cfda"
          strokeWidth={2}
          strokeDasharray={per}
          strokeDashoffset={per - per * draw}
          style={{filter: 'drop-shadow(0 24px 60px rgba(11,14,19,0.10))'}}
        />
      </svg>
      {/* headline line + text bars */}
      <div style={{position: 'absolute', left: CARD.x + 44, top: CARD.y + 44}}>
        <div
          style={{
            width: 300,
            height: 20,
            borderRadius: 6,
            background: '#2a3040',
            opacity: lerp(frame, [16, 24], [0, 0.85]),
            marginBottom: 26,
          }}
        />
        {LINES.map((l, i) => {
          const at = 22 + i * 5;
          const highlighted = l.hl && frame >= 40;
          return (
            <div key={i} style={{position: 'relative', marginBottom: 18}}>
              {highlighted && (
                <div
                  style={{
                    position: 'absolute',
                    left: -12,
                    top: -7,
                    width: l.w + 24,
                    height: 28,
                    borderRadius: 8,
                    background: `rgba(224,133,74,${0.12 + 0.07 * hlPulse})`,
                  }}
                />
              )}
              <div
                style={{
                  width: l.w,
                  height: 13,
                  borderRadius: 5,
                  background: highlighted ? '#8a6a52' : '#b9c0cc',
                  opacity: lerp(frame, [at, at + 8], [0, 1]),
                  position: 'relative',
                }}
              />
              {l.hl && (
                <div
                  style={{
                    position: 'absolute',
                    left: l.w + 34,
                    top: -12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: `2px solid ${C.macro}`,
                    background: 'rgba(224,133,74,0.07)',
                    fontFamily: F.mono,
                    fontSize: 16,
                    letterSpacing: '0.1em',
                    color: '#b05f28',
                    opacity: Math.min(chipS * 1.5, 1),
                    transform: `scale(${1.45 - chipS * 0.45})`,
                  }}
                >
                  GAP NOTED
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* the press stamp */}
      <div
        style={{
          position: 'absolute',
          left: CARD.x + CARD.w - 330,
          top: CARD.y + CARD.h - 128,
          transform: `rotate(${-7 + (1 - stamp) * 4}deg) scale(${1.65 - stamp * 0.65})`,
          transformOrigin: 'center',
          opacity: stampOp * 0.92,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 22px',
          borderRadius: 10,
          border: `3.5px solid ${C.whiteInk}`,
          fontFamily: F.mono,
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: C.whiteInk,
        }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24">
          <path d="M 4 12.5 L 9.5 18 L 20 6.5" fill="none" stroke={C.whiteInk} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        RE-CHECKED IN CODE
      </div>

      <div style={{position: 'absolute', left: 0, right: 0, top: 764, display: 'flex', justifyContent: 'center'}}>
        <Kinetic text="Every gap disclosed." delay={92} size={72} color={C.whiteInk} />
      </div>

      {/* fast fade to the void for the chapter flip */}
      <AbsoluteFill style={{background: C.void, opacity: toDark, pointerEvents: 'none'}} />
    </Void>
  );
};
