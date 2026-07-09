import React from 'react';
import {useCurrentFrame} from 'remotion';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {Instrument, LensScene, Roll, ReadoutRow} from '../lib/lens';
import {easeInOut, lerp, pulse01} from '../lib/anim';
import {C} from '../theme';
import {Void} from '../lib/ui';

const O = C.macro;

/* Game tree geometry (inside a 920×660 svg) */
const L0 = {x: 40, y: 330};
const L1 = [120, 330, 540].map((y) => ({x: 300, y}));
const L2 = [60, 185, 270, 395, 480, 605].map((y) => ({x: 560, y}));
const L3 = Array.from({length: 12}, (_, k) => ({x: 840, y: 32 + k * 54}));

const bez = (a: {x: number; y: number}, b: {x: number; y: number}) =>
  `M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;

type Link = {d: string; depth: number; key: string};
const LINKS: Link[] = [];
L1.forEach((n, i) => LINKS.push({d: bez(L0, n), depth: 0, key: `a${i}`}));
L2.forEach((n, i) => LINKS.push({d: bez(L1[Math.floor(i / 2)], n), depth: 1, key: `b${i}`}));
L3.forEach((n, i) => LINKS.push({d: bez(L2[Math.floor(i / 2)], n), depth: 2, key: `c${i}`}));

/* The lit path: root → L1[0] → L2[1] → L3[3] */
const BRIGHT = [bez(L0, L1[0]), bez(L1[0], L2[1]), bez(L2[1], L3[3])].join(' ');
const BRIGHT_LEN = getLength(BRIGHT);

const ARCS = [
  'M -60 560 Q 460 180 980 470',
  'M -40 700 Q 520 420 1000 640',
  'M 60 260 Q 500 40 960 250',
];

/** S8 — Lens two: Game theory maps the board. */
export const S08_Macro: React.FC = () => {
  const frame = useCurrentFrame();
  const brightDraw = evolvePath(lerp(frame, [50, 82], [0, 1], easeInOut), BRIGHT);
  const brightPulse = 0.75 + 0.25 * Math.sin(frame * 0.22);
  return (
    <Void>
      <LensScene color={O} chipLabel="LENS 02 · GAME THEORY" headline={'Game theory\nmaps the board.'} slideOutAt={155}>
        <Instrument x={0} y={0} w={950} h={520} label="GAME TREE" appear={4}>
          <svg width={900} height={430} viewBox="0 0 920 660" style={{overflow: 'visible'}}>
            {/* great-circle arcs behind */}
            {ARCS.map((d, i) => {
              const draw = evolvePath(lerp(frame, [8 + i * 8, 90 + i * 8], [0, 1]), d);
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={O}
                  strokeWidth={1.5}
                  opacity={0.13}
                  strokeDasharray={draw.strokeDasharray}
                  strokeDashoffset={draw.strokeDashoffset}
                />
              );
            })}
            {/* dim branches */}
            {LINKS.map((l, i) => {
              const start = 10 + l.depth * 16 + (i % 6) * 2.5;
              const draw = evolvePath(lerp(frame, [start, start + 20], [0, 1], easeInOut), l.d);
              return (
                <path
                  key={l.key}
                  d={l.d}
                  fill="none"
                  stroke={O}
                  strokeWidth={2}
                  opacity={0.26}
                  strokeDasharray={draw.strokeDasharray}
                  strokeDashoffset={draw.strokeDashoffset}
                />
              );
            })}
            {/* nodes */}
            {[L0, ...L1, ...L2, ...L3].map((n, i) => (
              <circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={i === 0 ? 7 : 4.5}
                fill={C.panel2}
                stroke={O}
                strokeWidth={1.5}
                opacity={lerp(frame, [8 + i * 1.2, 18 + i * 1.2], [0, 0.55])}
              />
            ))}
            {/* the lit path */}
            <path
              d={BRIGHT}
              fill="none"
              stroke={O}
              strokeWidth={9}
              opacity={0.16 * brightPulse}
              strokeDasharray={brightDraw.strokeDasharray}
              strokeDashoffset={brightDraw.strokeDashoffset}
              style={{filter: 'blur(5px)'}}
            />
            <path
              d={BRIGHT}
              fill="none"
              stroke={O}
              strokeWidth={3.5}
              opacity={brightPulse}
              strokeDasharray={brightDraw.strokeDasharray}
              strokeDashoffset={brightDraw.strokeDashoffset}
              style={{filter: `drop-shadow(0 0 6px ${O}aa)`}}
            />
            {/* probability beads */}
            {frame > 84 &&
              [0, 1, 2].map((b) => {
                const t = ((frame * 0.011 + b * 0.34) % 1) * BRIGHT_LEN;
                const p = getPointAtLength(BRIGHT, t);
                return (
                  <g key={b}>
                    <circle cx={p.x} cy={p.y} r={9} fill={O} opacity={0.25} style={{filter: 'blur(3px)'}} />
                    <circle cx={p.x} cy={p.y} r={5} fill="#ffd9b8" opacity={0.95} />
                  </g>
                );
              })}
          </svg>
        </Instrument>

        <Instrument x={0} y={555} w={950} h={130} label="POSITIONING" appear={56}>
          <div style={{display: 'flex', gap: 60, alignItems: 'baseline'}}>
            <ReadoutRow label="PATHS" delay={60}>
              <Roll target={21} decimals={0} delay={62} />
            </ReadoutRow>
            <ReadoutRow label="PRUNED" delay={66}>
              <Roll target={16} decimals={0} delay={68} />
            </ReadoutRow>
            <ReadoutRow label="LEAD PATH" delay={72}>
              <Roll target={0.62} decimals={2} delay={74} prefix="P=" color={O} />
            </ReadoutRow>
          </div>
        </Instrument>
      </LensScene>
    </Void>
  );
};
