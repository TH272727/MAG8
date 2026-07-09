import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Eyebrow, Void} from '../lib/ui';
import {BrowserPanel} from '../lib/browser';
import {easeInOut, easeOut, lerp, pop, pulse01} from '../lib/anim';
import {C, F} from '../theme';

const ROW_W = 1460;
const ROW_H = 96;
const ROW_X = (1920 - ROW_W) / 2;

const Redacted: React.FC<{dim?: boolean}> = ({dim}) => (
  <div style={{display: 'flex', gap: 7, alignItems: 'center'}}>
    {[24, 16, 20, 13, 18].map((w, i) => (
      <div
        key={i}
        style={{
          width: w,
          height: 18,
          borderRadius: 4,
          background: dim ? 'rgba(231,234,238,0.4)' : 'rgba(231,234,238,0.85)',
          boxShadow: dim ? undefined : '0 0 8px rgba(231,234,238,0.4)',
        }}
      />
    ))}
  </div>
);

const Arrows: React.FC<{glyphs: [string, string, string]; dim?: boolean}> = ({glyphs, dim}) => (
  <div style={{display: 'flex', gap: 14, fontFamily: F.mono, fontSize: 30, opacity: dim ? 0.65 : 1}}>
    <span style={{color: C.fundamentals}}>{glyphs[0]}</span>
    <span style={{color: C.macro}}>{glyphs[1]}</span>
    <span style={{color: C.consensus}}>{glyphs[2]}</span>
  </div>
);

/** One stylized leaderboard row that draws itself in with plotter hairlines. */
const Row: React.FC<{
  y: number;
  rank: string;
  score: string;
  scoreColor: string;
  draw: number; // 0..1 border trace
  contentAt: number;
  gate: 'pass' | 'caution';
  confluence?: boolean;
  glyphs: [string, string, string];
  dim?: boolean;
  glint?: number; // frame for the confluence chip glint
}> = ({y, rank, score, scoreColor, draw, contentAt, gate, confluence, glyphs, dim, glint}) => {
  const frame = useCurrentFrame();
  const per = 2 * (ROW_W + ROW_H);
  const dash = per * Math.min(draw, 1);
  const cOp = lerp(frame, [contentAt, contentAt + 12], [0, 1]);
  const glintT = glint === undefined ? 0 : pulse01((frame - glint) / 20);
  return (
    <div style={{position: 'absolute', left: ROW_X, top: y, width: ROW_W, height: ROW_H}}>
      <svg width={ROW_W} height={ROW_H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <rect
          x={1}
          y={1}
          width={ROW_W - 2}
          height={ROW_H - 2}
          rx={12}
          fill={C.panel}
          fillOpacity={Math.min(draw * 1.4, 1) * (dim ? 0.7 : 1)}
          stroke={C.hairline2}
          strokeWidth={1.5}
          strokeDasharray={per}
          strokeDashoffset={per - dash}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          padding: '0 36px',
          opacity: cOp * (dim ? 0.6 : 1),
        }}
      >
        <span style={{fontFamily: F.mono, fontSize: 32, color: C.dim}}>{rank}</span>
        <Redacted dim={dim} />
        <div style={{flex: 1}} />
        <Chip
          size={22}
          color={gate === 'pass' ? C.fundamentals : C.macro}
          border={gate === 'pass' ? `${C.fundamentals}66` : `${C.macro}66`}
          bg={gate === 'pass' ? `${C.fundamentals}12` : `${C.macro}12`}
        >
          {gate === 'pass' ? 'GATE PASS' : 'GATE CAUTION'}
        </Chip>
        {confluence && (
          <div style={{position: 'relative'}}>
            <Chip
              size={22}
              color={C.confluence}
              border={`${C.confluence}88`}
              bg={`${C.confluence}${glintT > 0.4 ? '2a' : '10'}`}
              style={{
                boxShadow: `0 0 ${14 + glintT * 22}px ${C.confluence}${glintT > 0.3 ? '55' : '22'}`,
              }}
            >
              CONFLUENCE
            </Chip>
          </div>
        )}
        <Arrows glyphs={glyphs} dim={dim} />
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 45,
            fontWeight: 700,
            color: scoreColor,
            fontVariantNumeric: 'tabular-nums',
            width: 120,
            textAlign: 'right',
            textShadow: dim ? undefined : `0 0 18px ${C.confluence}44`,
          }}
        >
          {score}
        </span>
      </div>
    </div>
  );
};

/** S12 — The leaderboard: the score docks into a row; the real board takes over. */
export const S12_Leaderboard: React.FC = () => {
  const frame = useCurrentFrame();

  // 90.3 docking: starts huge & centered (matching S11's end), shrinks into row one.
  // Lands right-aligned with the other rows' scores (36px row padding, 45px size).
  const dock = lerp(frame, [4, 34], [0, 1], easeInOut);
  const numX = 960 + (ROW_X + ROW_W - 36 - 960) * dock;
  const numY = 540 + (206 + ROW_H / 2 - 540) * dock;
  const numScale = 1 - dock * (1 - 45 / 236);

  const nativeOp = lerp(frame, [96, 122], [1, 0]);
  const realOp = lerp(frame, [100, 124], [0, 1]);

  return (
    <Void>
      <AbsoluteFill style={{opacity: nativeOp}}>
        <div style={{position: 'absolute', left: ROW_X, top: 150, opacity: lerp(frame, [10, 24], [0, 1])}}>
          <Eyebrow>THE LEADERBOARD</Eyebrow>
        </div>
        <Row
          y={206}
          rank="01"
          score=""
          scoreColor={C.confluence}
          draw={lerp(frame, [8, 34], [0, 1], easeInOut)}
          contentAt={26}
          gate="pass"
          confluence
          glyphs={['▲', '▲', '▲']}
          glint={84}
        />
        <Row
          y={326}
          rank="02"
          score="73.9"
          scoreColor="rgba(242,199,92,0.55)"
          draw={lerp(frame, [40, 64], [0, 1], easeInOut)}
          contentAt={52}
          gate="pass"
          glyphs={['▲', '—', '▲']}
          dim
        />
        <Row
          y={446}
          rank="03"
          score="69.5"
          scoreColor="rgba(242,199,92,0.45)"
          draw={lerp(frame, [56, 80], [0, 1], easeInOut)}
          contentAt={68}
          gate="caution"
          glyphs={['▲', '─', '▼']}
          dim
        />
        {/* the docking score (drawn above the row so it lands into place) */}
        <div
          style={{
            position: 'absolute',
            left: numX,
            top: numY,
            transform: `translate(-100%, -50%) scale(${Math.max(numScale, 45 / 236)})`,
            transformOrigin: 'right center',
            fontFamily: F.mono,
            fontSize: 236,
            fontWeight: 700,
            color: C.confluence,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 ${40 - dock * 25}px ${C.confluence}55`,
          }}
        >
          90.3
        </div>
      </AbsoluteFill>

      {/* the real board */}
      <AbsoluteFill style={{opacity: realOp}}>
        <BrowserPanel
          shot="rankings.png"
          label="MAG8 · RANKINGS"
          x={210}
          y={120}
          w={1500}
          h={830}
          pan={[-50, -330]}
          panWindow={[104, 178]}
          appear={100}
          glowColor={C.confluence}
        />
        <div
          style={{
            position: 'absolute',
            left: 210,
            bottom: 62,
            fontFamily: F.mono,
            fontSize: 25,
            letterSpacing: '0.12em',
            color: C.muted,
            opacity: lerp(frame, [126, 140], [0, 1]),
          }}
        >
          THE REAL BOARD · SCORED IN THE OPEN
        </div>
      </AbsoluteFill>
    </Void>
  );
};
