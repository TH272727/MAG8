import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Kinetic, Panel, Void} from '../lib/ui';
import {easeOut, lerp, pulse01} from '../lib/anim';
import {C, F} from '../theme';

const WEEKS = [
  {label: 'WEEK 24', score: '71.2', y: 758, dim: 0.4, at: 6},
  {label: 'WEEK 25', score: '68.5', y: 664, dim: 0.52, at: 18},
  {label: 'WEEK 26', score: '74.9', y: 570, dim: 0.64, at: 30},
  {label: 'WEEK 27', score: '81.6', y: 476, dim: 0.8, at: 42},
  {label: 'WEEK 28', score: '90.3', y: 382, dim: 1, at: 54},
];

/** S19 — On the record: the archive builds like strata. */
export const S19_Archive: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void>
      {WEEKS.map((w, i) => {
        const t = lerp(frame, [w.at, w.at + 16], [0, 1], easeOut);
        const newest = i === WEEKS.length - 1;
        const glow = newest ? pulse01((frame - 104) / 22) : 0;
        return (
          <Panel
            key={w.label}
            style={{
              position: 'absolute',
              left: 360,
              top: w.y + (1 - t) * -340,
              width: 1200,
              height: 82,
              opacity: t * w.dim,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 38px',
              boxSizing: 'border-box',
              boxShadow: glow > 0.15 ? `0 0 ${glow * 40}px ${C.confluence}22` : undefined,
              borderColor: glow > 0.15 ? `${C.confluence}44` : undefined,
            }}
          >
            <span style={{fontFamily: F.mono, fontSize: 27, letterSpacing: '0.14em', color: C.muted}}>
              {w.label}
            </span>
            <div style={{flex: 1, margin: '0 34px', display: 'flex', gap: 8}}>
              {[110, 70, 90, 50].map((bw, k) => (
                <div key={k} style={{width: bw * (0.7 + w.dim * 0.3), height: 10, borderRadius: 4, background: C.hairline2, opacity: 0.5}} />
              ))}
            </div>
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 36,
                fontWeight: 700,
                color: C.confluence,
                opacity: 0.35 + w.dim * 0.65,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {w.score}
            </span>
          </Panel>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 170, display: 'flex', justifyContent: 'center'}}>
        <Kinetic text="Every run. On the record." delay={72} size={72} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 902,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 25,
          letterSpacing: '0.13em',
          color: C.dim,
          opacity: lerp(frame, [90, 104], [0, 1]),
        }}
      >
        SAME RUBRIC · SAME UNIVERSE · EVERY WEEK
      </div>
    </Void>
  );
};
