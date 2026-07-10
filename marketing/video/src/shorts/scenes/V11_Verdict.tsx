import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Eyebrow, Void} from '../../lib/ui';
import {VBraid, VEmbers, VNODE, VBRAID_END, VThreads} from '../vbraid';
import {easeInOut, heartbeat, lerp, pop} from '../../lib/anim';
import {C, F} from '../../theme';
import {Redacted} from '../vlib';

const T_OFF = 189; // continue braid phase from V10

const ROW_W = 940;
const ROW_H = 92;
const ROW_X = (1080 - ROW_W) / 2;

const Arrows: React.FC<{glyphs: [string, string, string]; dim?: boolean}> = ({glyphs, dim}) => (
  <div style={{display: 'flex', gap: 10, fontFamily: F.mono, fontSize: 27, opacity: dim ? 0.65 : 1}}>
    <span style={{color: C.fundamentals}}>{glyphs[0]}</span>
    <span style={{color: C.macro}}>{glyphs[1]}</span>
    <span style={{color: C.consensus}}>{glyphs[2]}</span>
  </div>
);

const Row: React.FC<{
  y: number;
  rank: string;
  score: string;
  scoreColor: string;
  draw: number;
  contentAt: number;
  confluence?: boolean;
  glyphs: [string, string, string];
  dim?: boolean;
}> = ({y, rank, score, scoreColor, draw, contentAt, confluence, glyphs, dim}) => {
  const frame = useCurrentFrame();
  const per = 2 * (ROW_W + ROW_H);
  const dash = per * Math.min(draw, 1);
  const cOp = lerp(frame, [contentAt, contentAt + 12], [0, 1]);
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
          gap: 20,
          padding: '0 28px',
          opacity: cOp * (dim ? 0.6 : 1),
        }}
      >
        <span style={{fontFamily: F.mono, fontSize: 29, color: C.muted}}>{rank}</span>
        <Redacted dim={dim} scale={0.92} />
        <div style={{flex: 1}} />
        {confluence && (
          <Chip size={20} color={C.confluence} border={`${C.confluence}88`} bg={`${C.confluence}10`}
            style={{boxShadow: `0 0 14px ${C.confluence}22`}}>
            CONFLUENCE
          </Chip>
        )}
        <Arrows glyphs={glyphs} dim={dim} />
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 39,
            fontWeight: 700,
            color: scoreColor,
            fontVariantNumeric: 'tabular-nums',
            width: 96,
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

/**
 * V11 — verdict: the braid feeds a heartbeat dot, the score lands, then it
 * docks straight into the leaderboard row (S11+S12 compressed, portrait).
 */
export const V11_Verdict: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame + T_OFF;
  const dim = lerp(frame, [16, 38], [1, 0.35]);
  const beat = heartbeat(frame, 24);
  const dotIn = pop(frame, 2, 12, 0.8);
  const groupFade = lerp(frame, [34, 52], [1, 0]);

  // number: lands huge & centered at f46, docks into the row f84–112
  const numIn = pop(frame, 46, 13, 0.9);
  const numOp = lerp(frame, [46, 54], [0, 1]);
  const dock = lerp(frame, [84, 112], [0, 1], easeInOut);
  const ROW1_Y = 840;
  // born at the braid's verdict dot, rises onto the board and takes rank 01
  const numX = 540 + (ROW_X + ROW_W - 28 - 540) * dock;
  const numY = 1450 + (ROW1_Y + ROW_H / 2 - 1450) * dock;
  const numScale = 1 - dock * (1 - 34 / 190);

  const boardOp = lerp(frame, [80, 94], [0, 1]);

  return (
    <Void depth>
      {/* the braid delivering the verdict dot */}
      <AbsoluteFill style={{opacity: groupFade}}>
        <VThreads t={t} reveal={1} calm={1} packets labelOp={0.25 * dim} opacity={dim} />
        <VBraid t={t} reveal={1} opacity={0.55 + 0.45 * dim} />
        <VEmbers t={t} reveal={1} opacity={dim} />
        {[0, 1].map((r) => {
          const ringT = ((frame + r * 12) % 24) / 24;
          return (
            <div
              key={r}
              style={{
                position: 'absolute',
                left: VNODE.x,
                top: VBRAID_END,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: `2px solid ${C.confluence}`,
                transform: `translate(-50%, -50%) scale(${1 + ringT * 2.4})`,
                opacity: (1 - ringT) * 0.4 * dotIn,
              }}
            />
          );
        })}
        <div
          style={{
            position: 'absolute',
            left: VNODE.x,
            top: VBRAID_END,
            width: 34,
            height: 34,
            borderRadius: 999,
            background: C.confluence,
            transform: `translate(-50%, -50%) scale(${dotIn * (1 + beat * 0.22)})`,
            boxShadow: `0 0 26px ${C.confluence}aa, 0 0 70px ${C.confluence}44`,
          }}
        />
      </AbsoluteFill>

      {/* the board assembling around the docking score */}
      <AbsoluteFill style={{opacity: boardOp}}>
        <div style={{position: 'absolute', left: ROW_X, top: 766}}>
          <Eyebrow>THE LEADERBOARD</Eyebrow>
        </div>
        <Row
          y={ROW1_Y}
          rank="01"
          score=""
          scoreColor={C.confluence}
          draw={lerp(frame, [84, 108], [0, 1], easeInOut)}
          contentAt={98}
          confluence
          glyphs={['▲', '▲', '▲']}
        />
        <Row
          y={ROW1_Y + 116}
          rank="02"
          score="73.9"
          scoreColor="rgba(242,199,92,0.55)"
          draw={lerp(frame, [100, 122], [0, 1], easeInOut)}
          contentAt={110}
          glyphs={['▲', '—', '▲']}
          dim
        />
        <Row
          y={ROW1_Y + 232}
          rank="03"
          score="69.5"
          scoreColor="rgba(242,199,92,0.45)"
          draw={lerp(frame, [112, 134], [0, 1], easeInOut)}
          contentAt={122}
          glyphs={['▲', '─', '▼']}
          dim
        />
        <div
          style={{
            position: 'absolute',
            left: ROW_X,
            top: ROW1_Y + 380,
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.muted,
            opacity: lerp(frame, [126, 140], [0, 1]),
          }}
        >
          GATES CHECKED · SCORES RE-VERIFIED IN CODE
        </div>
      </AbsoluteFill>

      {/* the score itself */}
      {frame >= 46 && (
        <div
          style={{
            position: 'absolute',
            left: numX,
            top: numY,
            transform: `translate(${dock > 0 ? '-100%' : '-50%'}, -50%) scale(${Math.max(
              numScale * (0.72 + Math.min(numIn, 1) * 0.28),
              34 / 190,
            )})`,
            transformOrigin: dock > 0 ? 'right center' : 'center',
            fontFamily: F.mono,
            fontSize: 190,
            fontWeight: 700,
            color: C.confluence,
            fontVariantNumeric: 'tabular-nums',
            opacity: numOp,
            textShadow: `0 0 ${40 - dock * 25}px ${C.confluence}55, 0 0 120px ${C.confluence}22`,
          }}
        >
          90.3
        </div>
      )}
    </Void>
  );
};
