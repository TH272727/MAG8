import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Void} from '../../lib/ui';
import {Instrument, ReadoutRow, Roll} from '../../lib/lens';
import {easeIn, easeOut, lerp, pop} from '../../lib/anim';
import {C, F} from '../../theme';
import {Redacted, VFoot, VHead, VKeyLight} from '../vlib';

const G = C.fundamentals;

/* ============================== VF1 — the books ============================ */

const BARS = [0.44, 0.68, 0.5, 0.84, 0.6, 0.9, 0.72];

export const VF1_Books: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void>
      <VKeyLight color={G} />
      <VHead
        title={'Lens one\nreads the books.'}
        color={G}
        chip="LENS 01 · FUNDAMENTALS"
        strap="LEDGERS · MARGINS · CASH · DILUTION"
      />
      {/* balance-sheet bars */}
      <Instrument x={70} y={640} w={460} h={430} label="LEDGER" appear={26}>
        <svg width={410} height={330}>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={0} x2={410} y1={330 - g * 310} y2={330 - g * 310} stroke={C.hairline} strokeWidth={1} />
          ))}
          {BARS.map((h, i) => {
            const t = lerp(frame, [34 + i * 4, 58 + i * 4], [0, 1], easeOut);
            const bh = h * 300 * t;
            return (
              <g key={i}>
                <rect x={12 + i * 57} y={330 - bh} width={38} height={bh} rx={4} fill={`${G}2e`} stroke={`${G}88`} strokeWidth={1.5} />
                <rect x={12 + i * 57} y={330 - bh} width={38} height={Math.min(7, bh)} rx={3} fill={G} opacity={0.9} />
              </g>
            );
          })}
          <line x1={0} x2={410} y1={330} y2={330} stroke={C.hairline2} strokeWidth={1.5} />
        </svg>
      </Instrument>

      {/* rolling tape */}
      <Instrument x={570} y={640} w={440} h={430} label="TAPE" appear={38}>
        <div style={{paddingTop: 8}}>
          <ReadoutRow label="GROSS MARGIN" delay={46}>
            <Roll target={61.4} delay={48} suffix="%" size={38} />
          </ReadoutRow>
          <ReadoutRow label="FCF YIELD" delay={54}>
            <Roll target={3.8} delay={56} suffix="%" size={38} />
          </ReadoutRow>
          <ReadoutRow label="NET CASH" delay={62}>
            <Roll target={2.4} delay={64} prefix="$" suffix="B" size={38} />
          </ReadoutRow>
          <ReadoutRow label="REV CAGR 3Y" delay={70}>
            <Roll target={38.2} delay={72} suffix="%" size={38} />
          </ReadoutRow>
          <ReadoutRow label="DILUTION" delay={78}>
            <Roll target={1.9} delay={80} suffix="%" size={38} />
          </ReadoutRow>
        </div>
      </Instrument>

      {/* quality gauge */}
      <Instrument x={70} y={1120} w={940} h={420} label="QUALITY GAUGE" appear={56}>
        <svg width={560} height={300} viewBox="0 0 560 320" style={{marginLeft: 120}}>
          <path d="M 60 290 A 220 220 0 0 1 500 290" fill="none" stroke={C.hairline2} strokeWidth={13} strokeLinecap="round" />
          <path
            d="M 60 290 A 220 220 0 0 1 500 290"
            fill="none"
            stroke={G}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={691}
            strokeDashoffset={691 - 691 * lerp(frame, [66, 104], [0, 0.78], easeOut)}
            opacity={0.85}
            style={{filter: `drop-shadow(0 0 6px ${G}66)`}}
          />
          <g transform={`rotate(${-108 + pop(frame, 66, 15, 1.1) * 156} 280 290)`}>
            <line x1={280} y1={290} x2={280} y2={104} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
          </g>
          <circle cx={280} cy={290} r={12} fill={C.panel2} stroke={C.hairline2} strokeWidth={2} />
        </svg>
        <div style={{position: 'absolute', right: 34, top: 30}}>
          <Roll target={8.6} delay={72} size={49} color={G} suffix=" / 10" />
        </div>
      </Instrument>
    </Void>
  );
};

/* ====================== VF2 — nine checks + distress screen ================ */

export const VF2_Quality: React.FC = () => {
  const frame = useCurrentFrame();
  const Z_LO = 0;
  const Z_HI = 8;
  const zPos = (z: number) => ((z - Z_LO) / (Z_HI - Z_LO)) * 850;
  const needleZ = lerp(frame, [96, 128], [0.4, 4.2], easeOut);
  return (
    <Void>
      <VKeyLight color={G} />
      <VHead title={'Nine checks. Then\na distress screen.'} color={G} chip="VALUE-TRAP FILTERS" />
      {/* Piotroski F meter — nine pips, one honest miss */}
      <Instrument x={70} y={600} w={940} h={340} label="PIOTROSKI F" appear={22}>
        <div style={{display: 'flex', gap: 16, marginTop: 22}}>
          {Array.from({length: 9}).map((_, i) => {
            const lit = i !== 6; // 8 of 9
            const at = 34 + i * 7;
            const s = pop(frame, at, 11, 0.6);
            const on = frame >= at && lit;
            return (
              <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
                <div
                  style={{
                    width: 78,
                    height: 84,
                    borderRadius: 12,
                    border: `2px solid ${on ? G : frame >= at ? C.hairline2 : C.hairline}`,
                    background: on ? `${G}16` : 'transparent',
                    transform: `scale(${0.8 + Math.min(s, 1) * 0.2})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: on ? `0 0 14px ${G}22` : undefined,
                  }}
                >
                  {frame >= at && (
                    <span style={{fontFamily: F.mono, fontSize: 39, fontWeight: 700, color: on ? G : C.dim}}>
                      {lit ? '✓' : '·'}
                    </span>
                  )}
                </div>
                <span style={{fontFamily: F.mono, fontSize: 20, color: C.dim}}>{i + 1}</span>
              </div>
            );
          })}
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginTop: 24}}>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 23,
              letterSpacing: '0.1em',
              lineHeight: 1.45,
              color: C.dim,
              maxWidth: 620,
              opacity: lerp(frame, [100, 112], [0, 1]),
            }}
          >
            F ≤ 3 IS AN AUTOMATIC VETO — NO STORY OVERRIDES IT
          </span>
          <Roll target={8} decimals={0} delay={92} size={49} color={G} suffix=" / 9" />
        </div>
      </Instrument>

      {/* Altman Z zone band */}
      <Instrument x={70} y={1010} w={940} h={340} label="ALTMAN Z" appear={70}>
        <div style={{position: 'relative', marginTop: 44, width: 850, height: 60}}>
          {/* zones */}
          {[
            {from: 0, to: 1.8, color: C.danger, label: 'DISTRESS'},
            {from: 1.8, to: 3, color: C.macro, label: 'GREY'},
            {from: 3, to: 8, color: G, label: 'SAFE'},
          ].map((z) => (
            <React.Fragment key={z.label}>
              <div
                style={{
                  position: 'absolute',
                  left: zPos(z.from),
                  width: zPos(z.to) - zPos(z.from),
                  top: 22,
                  height: 16,
                  borderRadius: 8,
                  background: `${z.color}26`,
                  border: `1px solid ${z.color}55`,
                  opacity: lerp(frame, [78, 92], [0, 1]),
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: zPos(z.from) + (zPos(z.to) - zPos(z.from)) / 2,
                  top: 52,
                  transform: 'translateX(-50%)',
                  fontFamily: F.mono,
                  fontSize: 21,
                  letterSpacing: '0.12em',
                  color: z.color,
                  opacity: 0.8 * lerp(frame, [84, 96], [0, 1]),
                }}
              >
                {z.label}
              </span>
            </React.Fragment>
          ))}
          {/* needle */}
          <div
            style={{
              position: 'absolute',
              left: zPos(needleZ),
              top: 4,
              width: 4,
              height: 52,
              borderRadius: 2,
              background: C.ink,
              boxShadow: `0 0 12px ${G}88`,
              opacity: lerp(frame, [96, 104], [0, 1]),
            }}
          />
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 92}}>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 23,
              letterSpacing: '0.1em',
              color: C.dim,
              opacity: lerp(frame, [126, 140], [0, 1]),
            }}
          >
            BANKRUPTCY MATH BEFORE BULL MATH
          </span>
          <Roll target={4.2} delay={100} size={49} color={G} prefix="Z " />
        </div>
      </Instrument>
    </Void>
  );
};

/* =========================== VF3 — the trap filter ========================= */

const FALLERS = [
  {x: 165, trap: false, land: 0.86},
  {x: 340, trap: true, land: 0.47},
  {x: 540, trap: false, land: 0.86},
  {x: 740, trap: true, land: 0.47},
  {x: 915, trap: false, land: 0.86},
];

export const VF3_Traps: React.FC = () => {
  const frame = useCurrentFrame();
  const MESH_Y = 1010;
  return (
    <Void>
      <VKeyLight color={G} />
      <VHead title={'Cheap is easy.\nTraps get filtered.'} color={G} chip="VALUE ≠ VALUE TRAP" />
      {/* the mesh */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <line
          x1={90}
          x2={90 + 900 * lerp(frame, [10, 30], [0, 1], easeOut)}
          y1={MESH_Y}
          y2={MESH_Y}
          stroke={G}
          strokeWidth={2.5}
          opacity={0.75}
        />
        {Array.from({length: 23}).map((_, i) => (
          <line
            key={i}
            x1={110 + i * 39}
            x2={110 + i * 39}
            y1={MESH_Y - 7}
            y2={MESH_Y + 7}
            stroke={G}
            strokeWidth={2}
            opacity={0.5 * lerp(frame, [14 + i, 22 + i], [0, 1])}
          />
        ))}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: MESH_Y + 24,
          fontFamily: F.mono,
          fontSize: 21,
          letterSpacing: '0.13em',
          color: `${G}bb`,
          opacity: lerp(frame, [26, 38], [0, 1]),
        }}
      >
        QUALITY MESH · F-SCORE + Z + MOMENTUM
      </div>

      {/* five cheap candidates fall at the mesh */}
      {FALLERS.map((f, i) => {
        const drop = lerp(frame, [30 + i * 7, 66 + i * 7], [0, 1], easeIn);
        const y0 = 620;
        const yLand = f.trap ? MESH_Y - 40 : MESH_Y + 200 + (i % 2) * 90;
        const y = y0 + (yLand - y0) * drop;
        const stopped = drop >= 1;
        const markAt = 66 + i * 7 + 6;
        const markS = pop(frame, markAt, 12, 0.6);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: f.x,
                top: y,
                transform: 'translate(-50%, -50%)',
                width: 128,
                height: 52,
                borderRadius: 10,
                background: C.panel,
                border: `1.5px solid ${stopped ? (f.trap ? `${C.danger}88` : `${G}88`) : C.hairline2}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: stopped && !f.trap ? `0 0 18px ${G}33` : undefined,
              }}
            >
              <Redacted scale={0.72} dim={f.trap && stopped} />
            </div>
            {stopped && frame >= markAt && (
              <div
                style={{
                  position: 'absolute',
                  left: f.x,
                  top: y - 62,
                  transform: `translate(-50%, 0) scale(${Math.min(markS, 1)})`,
                  fontFamily: F.mono,
                  fontSize: 23,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: f.trap ? C.danger : G,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {f.trap ? '✕ TRAP' : '✓ THROUGH'}
              </div>
            )}
          </React.Fragment>
        );
      })}

      <Instrument x={70} y={1330} w={940} h={180} label="SCREEN RESULT" appear={100}>
        <div style={{display: 'flex', gap: 54, alignItems: 'baseline', marginTop: 4}}>
          <ReadoutRow label="SCREENED" delay={106}>
            <Roll target={5} decimals={0} delay={108} size={38} />
          </ReadoutRow>
          <ReadoutRow label="TRAPS CUT" delay={112}>
            <Roll target={2} decimals={0} delay={114} size={38} color={C.danger} />
          </ReadoutRow>
          <ReadoutRow label="ADVANCE" delay={118}>
            <Roll target={3} decimals={0} delay={120} size={38} color={G} />
          </ReadoutRow>
        </div>
      </Instrument>
      <VFoot at={132}>FALLING KNIVES NEED A FLOOR — MOMENTUM CONFIRMS IT</VFoot>
    </Void>
  );
};

/* ========================== VF4 — what's priced in ========================= */

export const VF4_PricedIn: React.FC = () => {
  const frame = useCurrentFrame();
  const priced = lerp(frame, [36, 66], [0, 12], easeOut);
  const path = lerp(frame, [72, 108], [0, 31], easeOut);
  const gapOn = lerp(frame, [116, 130], [0, 1]);
  const toX = (v: number) => (v / 40) * 810;
  const Bar: React.FC<{y: number; v: number; color: string; label: string; at: number}> = ({y, v, color, label, at}) => (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y - 34,
          fontFamily: F.mono,
          fontSize: 23,
          letterSpacing: '0.11em',
          color: C.muted,
          opacity: lerp(frame, [at - 8, at], [0, 1]),
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: toX(v),
          height: 34,
          borderRadius: 8,
          background: `${color}2a`,
          border: `1.5px solid ${color}99`,
          boxShadow: `inset 3px 0 0 ${color}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: toX(v) + 18,
          top: y + 2,
          fontFamily: F.mono,
          fontSize: 32,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          opacity: lerp(frame, [at, at + 8], [0, 1]),
        }}
      >
        {v.toFixed(0)}%
      </div>
    </>
  );
  return (
    <Void>
      <VKeyLight color={G} />
      <VHead title={'What growth is\nalready in the price?'} color={G} chip="REVERSE DCF" />
      <Instrument x={70} y={640} w={940} h={560} label="EXPECTATIONS" appear={22}>
        <div style={{position: 'relative', width: '100%', height: 440, marginTop: 16}}>
          <Bar y={70} v={priced} color={C.muted} label="THE PRICE ASSUMES" at={44} />
          <Bar y={220} v={path} color={G} label="THE PATH SUPPORTS" at={82} />
          {/* the gap bracket */}
          <svg width={860} height={440} style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: gapOn}}>
            <line x1={toX(12)} y1={330} x2={toX(31)} y2={330} stroke={G} strokeWidth={2.5} />
            <line x1={toX(12)} y1={322} x2={toX(12)} y2={338} stroke={G} strokeWidth={2.5} />
            <line x1={toX(31)} y1={322} x2={toX(31)} y2={338} stroke={G} strokeWidth={2.5} />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: toX(21.5),
              top: 356,
              transform: 'translateX(-50%)',
              fontFamily: F.mono,
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: G,
              opacity: gapOn,
              textShadow: `0 0 14px ${G}55`,
            }}
          >
            THE GAP: +19 PTS UNPRICED
          </div>
        </div>
      </Instrument>
      <VFoot at={146} bottom={560}>
        LOW EXPECTATIONS ARE THE ASYMMETRY — YOU BUY THE DIFFERENCE
      </VFoot>
    </Void>
  );
};

/* ====================== VF5 — scenarios, weighted + cited ================== */

const SCENARIOS = [
  {key: 'BEAR', price: 18, prob: 25, at: 30},
  {key: 'BASE', price: 34, prob: 50, at: 44},
  {key: 'BULL', price: 86, prob: 25, at: 58},
];
const SOURCES = ['10-K FILING', 'Q1 CALL TRANSCRIPT', 'INSIDER FORM 4'];

export const VF5_Scenarios: React.FC = () => {
  const frame = useCurrentFrame();
  const LO = 10;
  const HI = 95;
  const SPOT = 27;
  const toX = (p: number) => ((p - LO) / (HI - LO)) * 700;
  return (
    <Void>
      <VKeyLight color={G} />
      <VHead title={'Bear. Base. Bull.\nWeighted, not wished.'} color={G} chip="SCENARIO LADDER" />
      <Instrument x={70} y={620} w={940} h={520} label="SCENARIOS" appear={20}>
        <div style={{position: 'relative', marginTop: 20}}>
          {SCENARIOS.map((s, i) => {
            const on = lerp(frame, [s.at, s.at + 10], [0, 1]);
            const y = i * 96;
            return (
              <div key={s.key} style={{position: 'relative', height: 96, opacity: on}}>
                <span style={{position: 'absolute', left: 0, top: 18, fontFamily: F.mono, fontSize: 25, letterSpacing: '0.1em', color: C.dim, width: 70}}>
                  {s.key}
                </span>
                <div style={{position: 'absolute', left: 90, right: 130, top: 26, height: 1.5, background: C.hairline}} />
                {/* spot tick */}
                <div style={{position: 'absolute', left: 90 + toX(SPOT), top: 16, width: 2, height: 22, background: C.hairline2}} />
                <div
                  style={{
                    position: 'absolute',
                    left: 90 + toX(s.price) - 8,
                    top: 26 - 8,
                    width: 16,
                    height: 16,
                    borderRadius: 99,
                    background: G,
                    boxShadow: `0 0 0 3px ${C.panel}, 0 0 16px ${G}66`,
                    transform: `scale(${pop(frame, s.at + 4, 11, 0.6)})`,
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: 90 + toX(s.price) + 22,
                    top: 12,
                    fontFamily: F.mono,
                    fontSize: 30,
                    fontWeight: 700,
                    color: C.ink,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${s.price}
                </span>
                <span style={{position: 'absolute', right: 0, top: 14, fontFamily: F.mono, fontSize: 28, color: C.muted}}>
                  {s.prob}%
                </span>
              </div>
            );
          })}
          <div style={{marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 22, opacity: lerp(frame, [80, 92], [0, 1])}}>
            <span style={{fontFamily: F.mono, fontSize: 24, letterSpacing: '0.1em', color: C.muted}}>
              PROBABILITY-WEIGHTED
            </span>
            <Roll target={40.5} delay={84} prefix="$" size={43} color={G} />
            <span style={{fontFamily: F.mono, fontSize: 26, color: C.dim}}>vs spot $27</span>
          </div>
        </div>
      </Instrument>

      {/* sourced, or it doesn't count */}
      <Instrument x={70} y={1200} w={940} h={330} label="SOURCES · CITED IN THE REPORT" appear={98}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8}}>
          {SOURCES.map((s, i) => {
            const at = 108 + i * 10;
            const sp = pop(frame, at, 10, 0.55);
            return (
              <div
                key={s}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 18px',
                  borderRadius: 999,
                  border: `1.5px solid ${C.hairline2}`,
                  background: C.panel2,
                  width: 'fit-content',
                  fontFamily: F.mono,
                  fontSize: 23,
                  letterSpacing: '0.08em',
                  color: C.ink,
                  opacity: lerp(frame, [at, at + 6], [0, 1]),
                  transform: `scale(${1.32 - Math.min(sp, 1) * 0.32})`,
                  transformOrigin: 'left center',
                }}
              >
                <span style={{color: G, fontSize: 25}}>↗</span>
                {s}
              </div>
            );
          })}
        </div>
      </Instrument>
      <VFoot at={150}>UNDER 3 LIVE SOURCES = THE CELL GETS FLAGGED</VFoot>
    </Void>
  );
};
