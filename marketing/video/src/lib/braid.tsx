import React from 'react';
import {noise2D} from '@remotion/noise';
import {C} from '../theme';
import {lerp, rndIn, smooth} from './anim';

export const NODE = {x: 1190, y: 540};
export const BRAID_END = 1660;

export const THREADS = [
  {color: C.discovery, y0: 216, label: 'TRILLION-DNA SCOUT', seed: 71},
  {color: C.fundamentals, y0: 432, label: 'FUNDAMENTALS', seed: 137},
  {color: C.macro, y0: 648, label: 'GAME THEORY', seed: 211},
  {color: C.consensus, y0: 864, label: 'STREET CONSENSUS', seed: 307},
];

const PTS = 96;

/** Thread centerline points at time `t` (frames), calm ∈ [0,1] kills wander. */
export const threadPoints = (
  ti: number,
  t: number,
  calm: number,
): Array<[number, number]> => {
  const {y0, seed} = THREADS[ti];
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < PTS; i++) {
    const u = i / (PTS - 1);
    const x = u * NODE.x;
    const blend = smooth(Math.min(Math.max((u - 0.42) / 0.55, 0), 1));
    const base = y0 + (NODE.y - y0) * blend;
    const amp = 36 * (1 - blend) * (1 - calm) * Math.min(u * 6, 1);
    const y = base + noise2D(`th${seed}`, u * 7.2, t * 0.02) * amp;
    pts.push([x, y]);
  }
  return pts;
};

export const pointAt = (pts: Array<[number, number]>, p: number): [number, number] => {
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

/** The four converging signal threads with traveling packets. */
export const Threads: React.FC<{
  t: number;
  reveal: number; // 0..1 length reveal
  calm: number; // 0..1 wander removal
  packets: boolean;
  labelOp?: number;
  opacity?: number;
}> = ({t, reveal, calm, packets, labelOp = 0, opacity = 1}) => (
  <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity}}>
    {THREADS.map((th, ti) => {
      const pts = threadPoints(ti, t, calm);
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
            x={26}
            y={th.y0 - 22}
            fill={th.color}
            opacity={labelOp}
            style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 23, letterSpacing: '0.14em'}}
          >
            {th.label}
          </text>
        </g>
      );
    })}
  </svg>
);

/** Two gold strands weaving over/under from the node — the first gold in the film. */
export const Braid: React.FC<{
  t: number;
  reveal: number; // 0..1 → x from NODE.x to BRAID_END
  opacity?: number;
}> = ({t, reveal, opacity = 1}) => {
  const xEnd = NODE.x + (BRAID_END - NODE.x) * Math.min(Math.max(reveal, 0), 1);
  const k = 0.021;
  const w = 0.1;
  const A = 24;
  const SEG = 16;
  type Seg = {d: string; front: boolean; strand: 0 | 1};
  const segs: Seg[] = [];
  for (let sn = 0; sn <= 1; sn++) {
    const strand = sn as 0 | 1;
    const phase = strand === 0 ? 0 : Math.PI;
    for (let x0 = NODE.x; x0 < xEnd; x0 += SEG) {
      const x1 = Math.min(x0 + SEG + 1.5, xEnd);
      const pts: string[] = [];
      for (let x = x0; x <= x1; x += 4) {
        const th = k * (x - NODE.x) - w * t + phase;
        const y = NODE.y + Math.sin(th) * A * Math.min((x - NODE.x) / 60, 1);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const thMid = k * ((x0 + x1) / 2 - NODE.x) - w * t + phase;
      segs.push({d: pts.join(' '), front: Math.cos(thMid) > 0, strand});
    }
  }
  const back = segs.filter((s) => !s.front);
  const front = segs.filter((s) => s.front);
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity}}>
      {/* halo */}
      <line
        x1={NODE.x}
        y1={NODE.y}
        x2={xEnd}
        y2={NODE.y}
        stroke={C.confluence}
        strokeWidth={34}
        opacity={0.10}
        style={{filter: 'blur(14px)'}}
      />
      {back.map((s, i) => (
        <polyline key={`b${i}`} points={s.d} fill="none" stroke="#b28a35" strokeWidth={4.5} strokeLinecap="round" />
      ))}
      {/* all void underlays FIRST, then all bright strokes — otherwise each
          underlay erases the tail of the previous gold segment (dashed look) */}
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

/** Drifting gold embers shed by the braid. */
export const Embers: React.FC<{t: number; reveal: number; opacity?: number}> = ({
  t,
  reveal,
  opacity = 1,
}) => {
  const width = (BRAID_END - NODE.x) * Math.min(Math.max(reveal, 0), 1);
  if (width <= 10) return null;
  const LIFE = 36;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity}}>
      {Array.from({length: 22}).map((_, i) => {
        const local = t + i * 13.7;
        const cyc = Math.floor(local / LIFE);
        const u = (local % LIFE) / LIFE;
        const x0 = NODE.x + rndIn(`em${i}-${cyc}x`, 0.05, 0.98) * width;
        const y0 = NODE.y + rndIn(`em${i}-${cyc}y`, -22, 22);
        const x = x0 + u * rndIn(`em${i}-${cyc}dx`, 20, 70);
        const y = y0 - u * rndIn(`em${i}-${cyc}dy`, 40, 95) - 18 * u * u;
        const r = rndIn(`em${i}-${cyc}r`, 1.6, 3.4);
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
export const Flash: React.FC<{t: number; at: number}> = ({t, at}) => {
  const u = lerp(t, [at, at + 16], [0, 1]);
  if (u <= 0 || u >= 1) return null;
  const op = Math.sin(Math.PI * u);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: NODE.x,
          top: NODE.y,
          width: 10,
          height: 10,
          transform: `translate(-50%, -50%) scale(${10 + u * 110})`,
          borderRadius: 999,
          background:
            'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,240,200,0.55) 30%, rgba(242,199,92,0.22) 55%, transparent 72%)',
          opacity: op,
        }}
      />
      {/* horizontal flare streak */}
      <div
        style={{
          position: 'absolute',
          left: NODE.x,
          top: NODE.y,
          width: 900 * op,
          height: 3,
          transform: 'translate(-50%, -50%)',
          background:
            'linear-gradient(90deg, transparent, rgba(255,244,214,0.9), transparent)',
          opacity: op,
          filter: 'blur(1px)',
        }}
      />
    </>
  );
};
