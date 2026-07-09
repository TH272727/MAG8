import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {Chip, TypeOn, Void} from '../../lib/ui';
import {Instrument, ReadoutRow, Roll} from '../../lib/lens';
import {easeInOut, easeOut, lerp, pop, pulse01} from '../../lib/anim';
import {C, F} from '../../theme';
import {VFoot, VHead, VKeyLight} from '../vlib';

const O = C.macro;

/* ============================ VM1 — the board ============================== */

const ARCS = [
  'M -40 780 Q 540 380 1120 700',
  'M -60 1050 Q 520 760 1140 980',
  'M 40 560 Q 540 300 1040 540',
];

export const VM1_Board: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void depth>
      <VKeyLight color={O} />
      <VHead
        title={'Lens two\nmaps the board.'}
        color={O}
        chip="LENS 02 · GAME THEORY"
        strap="PLAYERS · MOVES · PAYOFFS"
      />
      {/* great-circle arcs over a faint node field — the board itself */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 54}).map((_, i) => {
          const x = 90 + (i % 9) * 112;
          const y = 560 + Math.floor(i / 9) * 130;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.5}
              fill={O}
              opacity={0.16 * lerp(frame, [8 + i * 1.1, 20 + i * 1.1], [0, 1])}
            />
          );
        })}
        {ARCS.map((d, i) => {
          const draw = evolvePath(lerp(frame, [16 + i * 12, 104 + i * 12], [0, 1]), d);
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={O}
              strokeWidth={1.8}
              opacity={0.28}
              strokeDasharray={draw.strokeDasharray}
              strokeDashoffset={draw.strokeDashoffset}
            />
          );
        })}
        {/* traveling sparks on the arcs */}
        {frame > 60 &&
          ARCS.map((d, i) => {
            const len = getLength(d);
            const p = getPointAtLength(d, ((frame * 0.008 + i * 0.31) % 1) * len);
            return <circle key={`s${i}`} cx={p.x} cy={p.y} r={4} fill="#ffd9b8" opacity={0.7} />;
          })}
      </svg>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 430}}>
          <TypeOn
            text={'Markets are games.\nGames have players.'}
            delay={84}
            seed="vm1"
            base={0.7}
            size={56}
            tint={O}
            cursor={false}
          />
        </div>
      </AbsoluteFill>
      <VFoot at={130}>EVERY STOCK SITS INSIDE A GAME ALREADY IN PROGRESS</VFoot>
    </Void>
  );
};

/* ====================== VM2 — players of the game ========================= */

type Player = {name: string; role: string; m: number; e: number; c: number};
const PLAYERS: Player[] = [
  {name: 'THE OPERATOR', role: 'the company — executes the window', m: 4, e: 8, c: 7},
  {name: 'US POLICY', role: 'regulator · demand anchor', m: 9, e: 6, c: 4},
  {name: 'RIVAL BLOC', role: 'counterweight — raises the stakes', m: 8, e: 7, c: 6},
  {name: 'INCUMBENTS', role: 'counterforce — scale, but slower', m: 7, e: 5, c: 5},
  {name: 'CAPITAL MARKETS', role: 'financier — open but fickle', m: 6, e: 5, c: 6},
  {name: 'SUPPLY CHAIN', role: 'chokepoint leverage', m: 5, e: 6, c: 7},
];
const weighted = (p: Player) => (p.m + 2 * p.e + 4 * p.c) / 7;

const MeterRow: React.FC<{tag: string; v: number; at: number}> = ({tag, v, at}) => {
  const frame = useCurrentFrame();
  const t = lerp(frame, [at, at + 20], [0, 1], easeOut);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 9}}>
      <span style={{fontFamily: F.mono, fontSize: 21, color: C.dim, width: 20}}>{tag}</span>
      <div style={{position: 'relative', flex: 1, height: 9, borderRadius: 5, background: `${O}14`, border: `1px solid ${O}30`}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(v / 10) * 100 * t}%`,
            borderRadius: 5,
            background: O,
            opacity: 0.75,
          }}
        />
      </div>
      <span style={{fontFamily: F.mono, fontSize: 22, color: C.muted, width: 34, textAlign: 'right'}}>
        {Math.round(v * t)}
      </span>
    </div>
  );
};

export const VM2_Players: React.FC = () => {
  const frame = useCurrentFrame();
  const MAP_AT = 150;
  const cardsOp = lerp(frame, [MAP_AT - 10, MAP_AT + 8], [1, 0]);
  const mapOp = lerp(frame, [MAP_AT, MAP_AT + 14], [0, 1]);

  // scatter geometry (mirrors the product's player map: x mass, y coordination, size energy)
  const PLOT = {x: 210, y: 700, w: 640, h: 560};
  const px = (m: number) => PLOT.x + (m / 10) * PLOT.w;
  const py = (c: number) => PLOT.y + PLOT.h - (c / 10) * PLOT.h;

  return (
    <Void>
      <VKeyLight color={O} />
      <VHead
        title={'Players of the game,\nscored three ways.'}
        color={O}
        chip="M MASS · E ENERGY · C COORDINATION"
      />

      {/* part A — the roster cards */}
      <AbsoluteFill style={{opacity: cardsOp}}>
        {PLAYERS.map((p, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const at = 24 + i * 11;
          const s = pop(frame, at, 13, 0.8);
          const w = weighted(p);
          return (
            <div
              key={p.name}
              style={{
                position: 'absolute',
                left: 70 + col * 480,
                top: 600 + row * 310,
                width: 460,
                height: 286,
                borderRadius: 12,
                background: C.panel,
                border: `1.5px solid ${C.hairline}`,
                padding: '20px 24px',
                boxSizing: 'border-box',
                opacity: Math.min(s * 1.4, 1),
                transform: `translateY(${(1 - Math.min(s, 1)) * 26}px)`,
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                <span style={{fontFamily: F.mono, fontSize: 26, fontWeight: 700, letterSpacing: '0.06em', color: C.ink}}>
                  <span style={{color: O}}>{i + 1}</span> {p.name}
                </span>
              </div>
              <div style={{fontFamily: F.mono, fontSize: 20, color: C.dim, marginTop: 6, letterSpacing: '0.04em'}}>
                {p.role}
              </div>
              <div style={{marginTop: 14}}>
                <MeterRow tag="M" v={p.m} at={at + 8} />
                <MeterRow tag="E" v={p.e} at={at + 13} />
                <MeterRow tag="C" v={p.c} at={at + 18} />
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontFamily: F.mono,
                  fontSize: 21,
                  letterSpacing: '0.09em',
                  color: `${O}dd`,
                  opacity: lerp(frame, [at + 26, at + 36], [0, 1]),
                }}
              >
                WEIGHTED {w.toFixed(1)}
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 168,
            textAlign: 'center',
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.dim,
            opacity: lerp(frame, [96, 110], [0, 1]),
          }}
        >
          WEIGHTED = [M + 2E + 4C] ÷ 7 · RANKING RE-CHECKED UNWEIGHTED
        </div>
      </AbsoluteFill>

      {/* part B — the scatter map (the real product instrument) */}
      <AbsoluteFill style={{opacity: mapOp}}>
        <div
          style={{
            position: 'absolute',
            left: 70,
            top: 560,
            width: 940,
            height: 860,
            borderRadius: 12,
            background: C.panel,
            border: `1.5px solid ${C.hairline}`,
          }}
        />
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
          {/* grid + axes */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <React.Fragment key={g}>
              <line x1={PLOT.x} x2={PLOT.x + PLOT.w} y1={PLOT.y + g * PLOT.h} y2={PLOT.y + g * PLOT.h} stroke={C.hairline} strokeWidth={1} opacity={0.7} />
              <line x1={PLOT.x + g * PLOT.w} x2={PLOT.x + g * PLOT.w} y1={PLOT.y} y2={PLOT.y + PLOT.h} stroke={C.hairline} strokeWidth={1} opacity={0.7} />
            </React.Fragment>
          ))}
          {[0, 5, 10].map((v) => (
            <React.Fragment key={v}>
              <text x={px(v)} y={PLOT.y + PLOT.h + 34} textAnchor="middle" fill={C.dim} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 21}}>
                {v}
              </text>
              <text x={PLOT.x - 26} y={py(v) + 5} textAnchor="end" fill={C.dim} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 21}}>
                {v}
              </text>
            </React.Fragment>
          ))}
          <text x={PLOT.x + PLOT.w / 2} y={PLOT.y + PLOT.h + 66} textAnchor="middle" fill={C.muted} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 22, letterSpacing: '0.14em'}}>
            MASS →
          </text>
          <text
            x={PLOT.x - 62}
            y={PLOT.y + PLOT.h / 2}
            textAnchor="middle"
            fill={C.muted}
            transform={`rotate(-90 ${PLOT.x - 62} ${PLOT.y + PLOT.h / 2})`}
            style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 22, letterSpacing: '0.14em'}}
          >
            COORDINATION →
          </text>
          {/* players */}
          {PLAYERS.map((p, i) => {
            const at = MAP_AT + 10 + i * 7;
            const s = pop(frame, at, 12, 0.7);
            const r = (13 + p.e * 2.6) * Math.min(s, 1);
            return (
              <g key={p.name} opacity={lerp(frame, [at, at + 6], [0, 1])}>
                <circle cx={px(p.m)} cy={py(p.c)} r={r} fill={`${O}2e`} stroke={O} strokeWidth={2} />
                <circle cx={px(p.m)} cy={py(p.c)} r={3} fill={O} />
                <text x={px(p.m)} y={py(p.c) - r - 10} textAnchor="middle" fill={C.ink} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 23, fontWeight: 700}}>
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 106,
            top: 1352,
            fontFamily: F.mono,
            fontSize: 21,
            letterSpacing: '0.13em',
            color: C.dim,
            opacity: lerp(frame, [MAP_AT + 44, MAP_AT + 56], [0, 1]),
          }}
        >
          X MASS · Y COORDINATION · SIZE ENERGY
        </div>
        {/* mini roster */}
        <div
          style={{
            position: 'absolute',
            left: 106,
            top: 1460,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 40,
            rowGap: 8,
            opacity: lerp(frame, [MAP_AT + 32, MAP_AT + 46], [0, 1]),
          }}
        >
          {PLAYERS.map((p, i) => (
            <span key={p.name} style={{fontFamily: F.mono, fontSize: 22, color: C.muted}}>
              <span style={{color: C.ink}}>{i + 1}</span> {p.name}
              <span style={{color: C.dim}}> · M{p.m} E{p.e} C{p.c}</span>
            </span>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 168,
            textAlign: 'center',
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.dim,
            opacity: lerp(frame, [MAP_AT + 56, MAP_AT + 70], [0, 1]),
          }}
        >
          THE SAME INSTRUMENT THE DOSSIER SHIPS
        </div>
      </AbsoluteFill>
    </Void>
  );
};

/* ========================== VM3 — all the paths ============================ */

/* Tree geometry, top-down inside the full portrait frame. */
const T0 = {x: 540, y: 620};
const T1 = [
  {x: 200, y: 880, move: 'ESCALATE'},
  {x: 540, y: 880, move: 'HOLD'},
  {x: 880, y: 880, move: 'RESOLVE'},
];
const T2 = [110, 290, 450, 630, 790, 970].map((x) => ({x, y: 1140}));
const T3 = Array.from({length: 12}, (_, k) => ({x: 92 + k * 81.5, y: 1390}));
/* leaf probabilities — they sum to 100; the HOLD subtree carries 62 */
const LEAF_P = [3, 5, 4, 9, 6, 8, 22, 26, 6, 4, 4, 3];

const bez = (a: {x: number; y: number}, b: {x: number; y: number}) =>
  `M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`;

type TLink = {d: string; depth: number; key: string; onLead: boolean};
const TLINKS: TLink[] = [];
T1.forEach((n, i) => TLINKS.push({d: bez(T0, n), depth: 0, key: `a${i}`, onLead: i === 1}));
T2.forEach((n, i) =>
  TLINKS.push({d: bez(T1[Math.floor(i / 2)], n), depth: 1, key: `b${i}`, onLead: i === 3}),
);
T3.forEach((n, i) =>
  TLINKS.push({d: bez(T2[Math.floor(i / 2)], n), depth: 2, key: `c${i}`, onLead: i === 7}),
);

const LEAD = [bez(T0, T1[1]), bez(T1[1], T2[3]), bez(T2[3], T3[7])].join(' ');
const LEAD_LEN = getLength(LEAD);

export const VM3_Paths: React.FC = () => {
  const frame = useCurrentFrame();
  const IGNITE = 150;
  const leadDraw = evolvePath(lerp(frame, [IGNITE, IGNITE + 32], [0, 1], easeInOut), LEAD);
  const leadPulse = 0.75 + 0.25 * Math.sin(frame * 0.22);
  return (
    <Void>
      <VKeyLight color={O} />
      <VHead title={'Then: every path\nthe game can take.'} color={O} chip="21 BRANCHES · WEIGHTED" />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {/* dim branches */}
        {TLINKS.map((l, i) => {
          const start = 14 + l.depth * 22 + (i % 6) * 3;
          const draw = evolvePath(lerp(frame, [start, start + 24], [0, 1], easeInOut), l.d);
          const pruneDim = frame > IGNITE && !l.onLead ? 0.14 : 0.3;
          return (
            <path
              key={l.key}
              d={l.d}
              fill="none"
              stroke={O}
              strokeWidth={2}
              opacity={pruneDim}
              strokeDasharray={draw.strokeDasharray}
              strokeDashoffset={draw.strokeDashoffset}
            />
          );
        })}
        {/* nodes */}
        {[T0, ...T1, ...T2, ...T3].map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={i === 0 ? 8 : i <= 3 ? 6 : 4.5}
            fill={C.panel2}
            stroke={O}
            strokeWidth={1.5}
            opacity={lerp(frame, [10 + i * 1.6, 20 + i * 1.6], [0, 0.6])}
          />
        ))}
        {/* the equilibrium line */}
        <path
          d={LEAD}
          fill="none"
          stroke={O}
          strokeWidth={9}
          opacity={0.16 * leadPulse}
          strokeDasharray={leadDraw.strokeDasharray}
          strokeDashoffset={leadDraw.strokeDashoffset}
          style={{filter: 'blur(5px)'}}
        />
        <path
          d={LEAD}
          fill="none"
          stroke={O}
          strokeWidth={3.5}
          opacity={leadPulse}
          strokeDasharray={leadDraw.strokeDasharray}
          strokeDashoffset={leadDraw.strokeDashoffset}
          style={{filter: `drop-shadow(0 0 6px ${O}aa)`}}
        />
        {/* probability beads on the lit line */}
        {frame > IGNITE + 30 &&
          [0, 1, 2].map((b) => {
            const t = ((frame * 0.011 + b * 0.34) % 1) * LEAD_LEN;
            const p = getPointAtLength(LEAD, t);
            return (
              <g key={b}>
                <circle cx={p.x} cy={p.y} r={9} fill={O} opacity={0.25} style={{filter: 'blur(3px)'}} />
                <circle cx={p.x} cy={p.y} r={5} fill="#ffd9b8" opacity={0.95} />
              </g>
            );
          })}
      </svg>
      {/* root chip + move labels */}
      <div style={{position: 'absolute', left: T0.x, top: T0.y - 64, transform: 'translateX(-50%)', opacity: lerp(frame, [8, 20], [0, 1])}}>
        <Chip size={22} color={C.muted}>TODAY</Chip>
      </div>
      {T1.map((n, i) => (
        <div
          key={n.move}
          style={{
            position: 'absolute',
            left: n.x,
            top: n.y + 24,
            transform: 'translateX(-50%)',
            fontFamily: F.mono,
            fontSize: 22,
            letterSpacing: '0.1em',
            color: frame > IGNITE && i !== 1 ? C.dim : O,
            opacity: lerp(frame, [44 + i * 6, 56 + i * 6], [0, 1]),
          }}
        >
          {n.move}
        </div>
      ))}
      {/* leaf probabilities */}
      {T3.map((n, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: n.x,
            top: n.y + 22,
            transform: 'translateX(-50%)',
            fontFamily: F.mono,
            fontSize: 21,
            color: frame > IGNITE && i !== 7 ? C.dim : C.muted,
            fontWeight: i === 7 ? 700 : 400,
            opacity: lerp(frame, [92 + i * 3, 102 + i * 3], [0, 1]),
          }}
        >
          {LEAF_P[i]}%
        </span>
      ))}
      {/* readouts */}
      <Instrument x={70} y={1560} w={940} h={150} label="PATH ENGINE" appear={IGNITE - 22}>
        <div style={{display: 'flex', gap: 52, alignItems: 'baseline', marginTop: 2}}>
          <ReadoutRow label="PATHS" delay={IGNITE - 14}>
            <Roll target={21} decimals={0} delay={IGNITE - 12} size={36} />
          </ReadoutRow>
          <ReadoutRow label="PRUNED" delay={IGNITE - 8}>
            <Roll target={16} decimals={0} delay={IGNITE - 6} size={36} />
          </ReadoutRow>
          <ReadoutRow label="EQUILIBRIUM" delay={IGNITE + 26}>
            <Roll target={0.62} decimals={2} delay={IGNITE + 28} prefix="P=" size={36} color={O} />
          </ReadoutRow>
        </div>
      </Instrument>
      <VFoot at={IGNITE + 60} bottom={140}>
        LEAVES SUM TO 100 · THE LIT LINE IS THE EQUILIBRIUM
      </VFoot>
    </Void>
  );
};

/* ========================= VM4 — the four horizons ========================= */

const HORIZONS = [
  {label: '3M', p: 45},
  {label: '6M', p: 55},
  {label: '12M', p: 60},
  {label: '24M', p: 70},
];
const BEAR = [25, 20, 16, 10];

export const VM4_Horizons: React.FC = () => {
  const frame = useCurrentFrame();
  const PLOT = {x: 190, y: 740, w: 720, h: 560};
  const hx = (i: number) => PLOT.x + (i / 3) * PLOT.w;
  const hy = (p: number) => PLOT.y + PLOT.h - (p / 100) * PLOT.h;
  const reveal = lerp(frame, [30, 86], [0, 1], easeInOut);
  const line = (ps: number[]) =>
    ps
      .map((p, i) => `${hx(i)},${hy(p)}`)
      .slice(0, Math.max(2, Math.ceil(reveal * 4)))
      .join(' ');
  return (
    <Void>
      <VKeyLight color={O} />
      <VHead title={'Every call is dated:\n3 · 6 · 12 · 24 months.'} color={O} chip="HORIZON PROBABILITY" />
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 620,
          width: 940,
          height: 830,
          borderRadius: 12,
          background: C.panel,
          border: `1.5px solid ${C.hairline}`,
        }}
      />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {[0, 25, 50, 75, 100].map((p) => (
          <React.Fragment key={p}>
            <line x1={PLOT.x} x2={PLOT.x + PLOT.w} y1={hy(p)} y2={hy(p)} stroke={C.hairline} strokeWidth={1} opacity={0.7} />
            <text x={PLOT.x - 24} y={hy(p) + 5} textAnchor="end" fill={C.dim} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 21}}>
              {p}
            </text>
          </React.Fragment>
        ))}
        {/* bear line (dim) */}
        <polyline points={line(BEAR)} fill="none" stroke={C.dim} strokeWidth={2} strokeDasharray="7 7" opacity={0.55} />
        {/* primary line */}
        <polyline
          points={line(HORIZONS.map((h) => h.p))}
          fill="none"
          stroke={O}
          strokeWidth={3.5}
          style={{filter: `drop-shadow(0 0 6px ${O}66)`}}
        />
        {HORIZONS.map((h, i) => {
          const at = 34 + i * 17;
          const s = pop(frame, at, 12, 0.6);
          return (
            <g key={h.label} opacity={lerp(frame, [at, at + 6], [0, 1])}>
              <circle cx={hx(i)} cy={hy(h.p)} r={8 * Math.min(s, 1)} fill={O} stroke={C.panel} strokeWidth={3} />
              {/* first label anchors right of its point so it clears the y-axis ticks */}
              <text x={i === 0 ? hx(i) + 16 : hx(i)} y={hy(h.p) - 22} textAnchor={i === 0 ? 'start' : 'middle'} fill={C.ink} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 27, fontWeight: 700}}>
                {h.p}%
              </text>
              <text x={hx(i)} y={PLOT.y + PLOT.h + 38} textAnchor="middle" fill={C.muted} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 23, letterSpacing: '0.1em'}}>
                {h.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 190,
          top: 1368,
          display: 'flex',
          gap: 34,
          fontFamily: F.mono,
          fontSize: 22,
          letterSpacing: '0.1em',
          opacity: lerp(frame, [104, 118], [0, 1]),
        }}
      >
        <span style={{color: O}}>— PRIMARY OUTCOME</span>
        <span style={{color: C.dim}}>--- BEAR CASE</span>
      </div>
      <VFoot at={126} bottom={280}>
        DATED MEANS SCOREABLE · THE HIT RATE IS TRACKED
      </VFoot>
    </Void>
  );
};

/* ================== VM5 — asymmetry, entry, the kill switch ================ */

export const VM5_Asymmetry: React.FC = () => {
  const frame = useCurrentFrame();
  const DIAL_LEN = Math.PI * 220;
  const dialT = lerp(frame, [26, 64], [0, 8.5 / 10], easeOut);
  const stampS = pop(frame, 150, 15, 0.5);
  const stampOp = lerp(frame, [150, 155], [0, 1]);
  return (
    <Void>
      <VKeyLight color={O} />
      <VHead title={'It ends with a number —\nand a kill switch.'} color={O} chip="ASYMMETRY · ENTRY · FALSIFIER" />
      {/* asymmetry dial */}
      <Instrument x={70} y={600} w={450} h={430} label="ASYMMETRY" appear={16}>
        <svg width={380} height={240} viewBox="0 0 500 300" style={{marginTop: 10}}>
          <path d="M 30 280 A 220 220 0 0 1 470 280" fill="none" stroke={C.hairline2} strokeWidth={15} strokeLinecap="round" />
          <path
            d="M 30 280 A 220 220 0 0 1 470 280"
            fill="none"
            stroke={O}
            strokeWidth={15}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.01, dialT) * DIAL_LEN} ${DIAL_LEN}`}
            style={{filter: `drop-shadow(0 0 8px ${O}66)`}}
          />
          <text x={250} y={240} textAnchor="middle" fill={C.ink} style={{font: "700 74px 'JetBrains Mono', monospace"}}>
            {(dialT * 10).toFixed(1)}
          </text>
          <text x={250} y={288} textAnchor="middle" fill={C.dim} style={{font: "500 26px 'JetBrains Mono', monospace", letterSpacing: '0.1em'}}>
            / 10
          </text>
        </svg>
      </Instrument>
      {/* entry window */}
      <Instrument x={570} y={600} w={440} h={430} label="ENTRY WINDOW" appear={30}>
        <div style={{marginTop: 16, opacity: lerp(frame, [52, 64], [0, 1])}}>
          <Chip size={24} color={O} border={`${O}66`} bg={`${O}10`}>
            OPEN · PRE-CATALYST
          </Chip>
        </div>
        <div style={{marginTop: 30}}>
          <ReadoutRow label="SETUP SCORE" delay={68}>
            <Roll target={7} decimals={0} delay={70} size={36} suffix=" / 10" />
          </ReadoutRow>
          <ReadoutRow label="LEAST PRICED IN" delay={78}>
            <Roll target={62} decimals={0} delay={80} size={36} color={O} suffix="%" />
          </ReadoutRow>
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: F.mono,
            fontSize: 21,
            lineHeight: 1.6,
            letterSpacing: '0.06em',
            color: C.dim,
            opacity: lerp(frame, [88, 100], [0, 1]),
          }}
        >
          THE GAP BETWEEN THE PRICED NARRATIVE AND THE EQUILIBRIUM IS THE TRADE
        </div>
      </Instrument>
      {/* the falsifier */}
      <Instrument x={70} y={1090} w={940} h={430} label="FALSIFICATION · ON THE RECORD" appear={100}>
        <div style={{marginTop: 18, minHeight: 120}}>
          <TypeOn
            text={'WRONG IF: the demand anchor slips\ntwo straight quarters.'}
            delay={112}
            seed="vm5"
            base={0.55}
            size={36}
            font="mono"
            weight={600}
            color={C.ink}
            tint={O}
            align="left"
            cursor={false}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            right: 30,
            bottom: 26,
            transform: `rotate(${-6 + (1 - Math.min(stampS, 1)) * 4}deg) scale(${1.65 - Math.min(stampS, 1) * 0.65})`,
            opacity: stampOp * 0.95,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 20px',
            borderRadius: 10,
            border: `3px solid ${C.danger}`,
            fontFamily: F.mono,
            fontSize: 25,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: C.danger,
          }}
        >
          ✕ KILL CONDITION SET
        </div>
      </Instrument>
      <VFoot at={168}>IF IT BREAKS, THE CALL DIES IN PUBLIC</VFoot>
    </Void>
  );
};
