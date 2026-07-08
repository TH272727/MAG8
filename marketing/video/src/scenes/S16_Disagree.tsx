import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Kinetic, Void} from '../lib/ui';
import {lerp, pop} from '../lib/anim';
import {C, F} from '../theme';

export const TriUp: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M 50 12 L 92 84 L 8 84 Z" fill={color} rx={8} strokeLinejoin="round" stroke={color} strokeWidth={12} />
  </svg>
);
export const HBar: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <rect x={10} y={42} width={80} height={16} rx={8} fill={color} />
  </svg>
);
export const TriDown: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M 50 88 L 92 16 L 8 16 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth={12} />
  </svg>
);

const GLYPHS = [
  {Comp: TriUp, color: C.fundamentals, x: 640, dy: -18, period: 47},
  {Comp: HBar, color: C.macro, x: 890, dy: 4, period: 61},
  {Comp: TriDown, color: C.consensus, x: 1140, dy: 16, period: 53},
];

/** S16 — Honest disagreement: ▲ ─ ▼, unapologetically unaligned. */
export const S16_Disagree: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void light>
      <div style={{position: 'absolute', left: 0, right: 0, top: 218, display: 'flex', justifyContent: 'center'}}>
        <Kinetic text="When they disagree, you see it." delay={36} size={70} color={C.whiteInk} />
      </div>
      {GLYPHS.map((g, i) => {
        const s = pop(frame, 6 + i * 7, 12, 0.85);
        const beat = 1 + 0.035 * Math.sin((frame / g.period) * Math.PI * 2 + i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: g.x,
              top: 452 + g.dy,
              transform: `scale(${s * beat})`,
              opacity: Math.min(s * 1.4, 1),
            }}
          >
            <g.Comp size={140} color={g.color} />
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 692,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 62,
          fontWeight: 600,
          color: C.whiteMuted,
          fontVariantNumeric: 'tabular-nums',
          opacity: lerp(frame, [92, 108], [0, 1]),
        }}
      >
        61.2
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 790,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 19,
          letterSpacing: '0.14em',
          color: '#9aa2b1',
          opacity: lerp(frame, [104, 118], [0, 1]),
        }}
      >
        NO CONFLUENCE · NO BONUS · THAT'S THE SYSTEM WORKING
      </div>
    </Void>
  );
};
