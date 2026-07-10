import React from 'react';
import {noise2D} from '@remotion/noise';
import {C} from '../theme';
import {lerp, rndIn, smooth} from '../lib/anim';
import {VH, VW} from './timeline';

/**
 * Vertical transposition of lib/braid.tsx for the 9:16 shorts: the four
 * signal threads ignite along the TOP edge and flow DOWN into one node;
 * the gold braid weaves on downward from it. Same visual grammar, portrait.
 */
export const VNODE = {x: 540, y: 1010};
export const VBRAID_END = 1450;

export const VTHREADS = [
  {color: C.discovery, x0: 216, label: 'TRILLION-DNA', seed: 71},
  {color: C.fundamentals, x0: 432, label: 'FUNDAMENTALS', seed: 137},
  {color: C.macro, x0: 648, label: 'GAME THEORY', seed: 211},
  {color: C.consensus, x0: 864, label: 'CONSENSUS', seed: 307},
];

const PTS = 96;

export const vThreadPoints = (
  ti: number,
  t: number,
  calm: number,
): Array<[number, number]> => {
  const {x0, seed} = VTHREADS[ti];
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < PTS; i++) {
    const u = i / (PTS - 1);
    const y = u * VNODE.y;
    const blend = smooth(Math.min(Math.max((u - 0.42) / 0.55, 0), 1));
    const base = x0 + (VNODE.x - x0) * blend;
    const amp = 30 * (1 - blend) * (1 - calm) * Math.min(u * 6, 1);
    const x = base + noise2D(`vth${seed}`, u * 7.2, t * 0.02) * amp;
    pts.push([x, y]);
  }
  return pts;
};

const pointAt = (pts: Array<[number, number]>, p: number): [number, number] => {
  const f = Math.min(Math.max(p, 0), 1) * (pts.length - 1);
  const i = Math.floor(f);
  const frac = f - i;
  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
};

const toPolyline = (pts: Array<[number, number]>, upto: number) =>
  pts
    .slice(0, Math.max(2, Math.floor(upto * pts.length)))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

/** The four converging threads, falling from the top edge. */
export const VThreads: React.FC<{
  t: number;
  reveal: number;
  calm: number;
  packets: boolean;
  labelOp?: number;
  opacity?: number;
}> = ({t, reveal, calm, packets, labelOp = 0, opacity = 1}) => (
  <svg width={VW} height={VH} style={{position: 'absolute', inset: 0, opacity}}>
    {VTHREADS.map((th, ti) => {
      const pts = vThreadPoints(ti, t, calm);
      const line = toPolyline(pts, reveal);
      return (
        <g key={th.label}>
          <polyline points={line} fill="none" stroke={th.color} strokeWidth={9} opacity={0.16} style={{filter: 'blur(6px)'}} />
          <polyline points={line} fill="none" stroke={th.color} strokeWidth={2.5} opacity={0.9} />
          {packets &&
            [0, 1, 2].map((j) => {
              const p = (t * 0.0155 + j * 0.36 + ti * 0.11) % 1;
              if (p > reveal) return null;
              const [px, py] = pointAt(pts, p);
              return (
                <g key={j}>
                  {[0.05, 0.03, 0.015].map((back, gi) => {
                    const [gx, gy] = pointAt(pts, Math.max(p - back, 0));
                    return <circle key={gi} cx={gx} cy={gy} r={4 - gi} fill={th.color} opacity={0.22 - gi * 0.05} />;
                  })}
                  <circle cx={px} cy={py} r={7} fill={th.color} opacity={0.35} style={{filter: 'blur(3px)'}} />
                  <circle cx={px} cy={py} r={4} fill="#ffffff" opacity={0.85} />
                </g>
              );
            })}
          <text
            x={th.x0}
            y={64}
            textAnchor="middle"
            fill={th.color}
            opacity={labelOp}
            style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 22, letterSpacing: '0.13em'}}
          >
            {th.label}
          </text>
        </g>
      );
    })}
  </svg>
);

/** Two gold strands weaving downward from the node — first gold of the short. */
export const VBraid: React.FC<{
  t: number;
  reveal: number;
  opacity?: number;
}> = ({t, reveal, opacity = 1}) => {
  const yEnd = VNODE.y + (VBRAID_END - VNODE.y) * Math.min(Math.max(reveal, 0), 1);
  const k = 0.021;
  const w = 0.1;
  const A = 22;
  const SEG = 16;
  type Seg = {d: string; front: boolean};
  const segs: Seg[] = [];
  for (let sn = 0; sn <= 1; sn++) {
    const phase = sn === 0 ? 0 : Math.PI;
    for (let y0 = VNODE.y; y0 < yEnd; y0 += SEG) {
      const y1 = Math.min(y0 + SEG + 1.5, yEnd);
      const pts: string[] = [];
      for (let y = y0; y <= y1; y += 4) {
        const th = k * (y - VNODE.y) - w * t + phase;
        const x = VNODE.x + Math.sin(th) * A * Math.min((y - VNODE.y) / 60, 1);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const thMid = k * ((y0 + y1) / 2 - VNODE.y) - w * t + phase;
      segs.push({d: pts.join(' '), front: Math.cos(thMid) > 0});
    }
  }
  const back = segs.filter((s) => !s.front);
  const front = segs.filter((s) => s.front);
  return (
    <svg width={VW} height={VH} style={{position: 'absolute', inset: 0, opacity}}>
      <line
        x1={VNODE.x}
        y1={VNODE.y}
        x2={VNODE.x}
        y2={yEnd}
        stroke={C.confluence}
        strokeWidth={34}
        opacity={0.1}
        style={{filter: 'blur(14px)'}}
      />
      {back.map((s, i) => (
        <polyline key={`b${i}`} points={s.d} fill="none" stroke="#b28a35" strokeWidth={4.5} strokeLinecap="round" />
      ))}
      {/* all void underlays FIRST, then all bright strokes (see lib/braid.tsx) */}
      {front.map((s, i) => (
        <polyline key={`u${i}`} points={s.d} fill="none" stroke={C.void} strokeWidth={11} strokeLinecap="round" />
      ))}
      {front.map((s, i) => (
        <polyline
          key={`f${i}`}
          points={s.d}
          fill="none"
          stroke={C.confluence}
          strokeWidth={5}
          strokeLinecap="round"
          style={{filter: `drop-shadow(0 0 6px ${C.confluence}66)`}}
        />
      ))}
    </svg>
  );
};

/** Drifting gold embers along the vertical braid. */
export const VEmbers: React.FC<{t: number; reveal: number; opacity?: number}> = ({
  t,
  reveal,
  opacity = 1,
}) => {
  const height = (VBRAID_END - VNODE.y) * Math.min(Math.max(reveal, 0), 1);
  if (height <= 10) return null;
  const LIFE = 36;
  return (
    <svg width={VW} height={VH} style={{position: 'absolute', inset: 0, opacity}}>
      {Array.from({length: 18}).map((_, i) => {
        const local = t + i * 13.7;
        const cyc = Math.floor(local / LIFE);
        const u = (local % LIFE) / LIFE;
        const y0 = VNODE.y + rndIn(`vem${i}-${cyc}y`, 0.05, 0.98) * height;
        const x0 = VNODE.x + rndIn(`vem${i}-${cyc}x`, -22, 22);
        const x = x0 + u * rndIn(`vem${i}-${cyc}dx`, 24, 80) * (rndIn(`vem${i}-${cyc}s`, 0, 1) > 0.5 ? 1 : -1);
        const y = y0 - u * rndIn(`vem${i}-${cyc}dy`, 30, 80) - 14 * u * u;
        const r = rndIn(`vem${i}-${cyc}r`, 1.6, 3.4);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill={C.confluence}
            opacity={Math.sin(Math.PI * u) * 0.75}
          />
        );
      })}
    </svg>
  );
};

/** White-hot fusion flash at the node. */
export const VFlash: React.FC<{t: number; at: number}> = ({t, at}) => {
  const u = lerp(t, [at, at + 16], [0, 1]);
  if (u <= 0 || u >= 1) return null;
  const op = Math.sin(Math.PI * u);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: VNODE.x,
          top: VNODE.y,
          width: 10,
          height: 10,
          transform: `translate(-50%, -50%) scale(${10 + u * 100})`,
          borderRadius: 999,
          background:
            'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,240,200,0.55) 30%, rgba(242,199,92,0.22) 55%, transparent 72%)',
          opacity: op,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: VNODE.x,
          top: VNODE.y,
          width: 3,
          height: 760 * op,
          transform: 'translate(-50%, -50%)',
          background:
            'linear-gradient(180deg, transparent, rgba(255,244,214,0.9), transparent)',
          opacity: op,
          filter: 'blur(1px)',
        }}
      />
    </>
  );
};
