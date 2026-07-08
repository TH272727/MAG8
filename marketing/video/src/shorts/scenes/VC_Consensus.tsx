import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Kinetic, TypeOn, Void} from '../../lib/ui';
import {Instrument, ReadoutRow, Roll} from '../../lib/lens';
import {easeInOut, easeOut, heartbeat, lerp, pop, rndIn} from '../../lib/anim';
import {C, F} from '../../theme';
import {VFoot, VHead, VKeyLight} from '../vlib';

const T = C.consensus;

/* ============================ VC1 — the street ============================= */

export const VC1_Street: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void depth>
      <VKeyLight color={T} />
      <VHead
        title={'Lens three\npolls the street.'}
        color={T}
        chip="LENS 03 · STREET CONSENSUS"
        strap="EIGHT DESKS · VERIFIED · DATED"
      />
      {/* a field of quiet opinion brackets warming up */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 14}).map((_, i) => {
          const x = 120 + i * 62;
          const y1 = 760 - rndIn(`vc1a${i}`, 0, 150);
          const y2 = 1160 + rndIn(`vc1b${i}`, 0, 170);
          const op = lerp(frame, [30 + i * 5, 48 + i * 5], [0, 1]);
          const dy = lerp(frame, [30 + i * 5, 48 + i * 5], [-70, 0], easeOut);
          return (
            <g key={i} opacity={op * 0.5} transform={`translate(0 ${dy})`}>
              <line x1={x} y1={y1} x2={x} y2={y2} stroke={T} strokeWidth={2.5} />
              <line x1={x - 9} y1={y1} x2={x + 9} y2={y1} stroke={T} strokeWidth={2.5} />
              <line x1={x - 9} y1={y2} x2={x + 9} y2={y2} stroke={T} strokeWidth={2.5} />
            </g>
          );
        })}
      </svg>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 430}}>
          <TypeOn
            text={'A crowd of opinions —\nread one by one.'}
            delay={86}
            seed="vc1"
            base={0.7}
            size={52}
            tint={T}
            cursor={false}
          />
        </div>
      </AbsoluteFill>
      <VFoot at={132}>NO NUMBER ENTERS THE REPORT UNVERIFIED</VFoot>
    </Void>
  );
};

/* ============================ VC2 — eight desks ============================ */

type Desk = {stance: '▲' | '─' | '▼'; asOf: string; lo: number; hi: number};
const DESKS: Desk[] = [
  {stance: '▲', asOf: 'JUL 02', lo: 238, hi: 262},
  {stance: '▲', asOf: 'JUN 30', lo: 244, hi: 258},
  {stance: '─', asOf: 'JUL 01', lo: 228, hi: 246},
  {stance: '▲', asOf: 'JUN 27', lo: 240, hi: 266},
  {stance: '▼', asOf: 'JUN 24', lo: 218, hi: 238},
  {stance: '▲', asOf: 'JUL 03', lo: 246, hi: 264},
  {stance: '─', asOf: 'JUN 26', lo: 232, hi: 250},
  {stance: '▲', asOf: 'JUL 05', lo: 242, hi: 260},
];
const stanceColor = (s: Desk['stance']) => (s === '▲' ? T : s === '▼' ? C.danger : C.muted);

export const VC2_Desks: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void>
      <VKeyLight color={T} />
      <VHead title={'Eight desks pulled.\nNone taken on faith.'} color={T} chip="STANCE · TARGET · DATE" />
      {DESKS.map((d, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const at = 26 + i * 13;
        const s = pop(frame, at, 13, 0.8);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 70 + col * 480,
              top: 590 + row * 212,
              width: 460,
              height: 188,
              borderRadius: 12,
              background: C.panel,
              border: `1.5px solid ${C.hairline}`,
              padding: '18px 24px',
              boxSizing: 'border-box',
              opacity: Math.min(s * 1.4, 1),
              transform: `translateY(${(1 - Math.min(s, 1)) * 26}px)`,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontFamily: F.mono, fontSize: 19, fontWeight: 700, letterSpacing: '0.08em', color: C.ink}}>
                DESK {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{fontFamily: F.mono, fontSize: 24, color: stanceColor(d.stance)}}>{d.stance}</span>
            </div>
            <div style={{marginTop: 12, fontFamily: F.mono, fontSize: 22, color: C.muted, fontVariantNumeric: 'tabular-nums'}}>
              ${d.lo} – ${d.hi}
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 14}}>
              <span style={{fontFamily: F.mono, fontSize: 14, letterSpacing: '0.1em', color: C.dim}}>
                AS OF {d.asOf}
              </span>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 13,
                  letterSpacing: '0.1em',
                  color: T,
                  opacity: lerp(frame, [at + 14, at + 22], [0, 1]),
                }}
              >
                ✓ VERIFIED
              </span>
            </div>
          </div>
        );
      })}
      <Instrument x={70} y={1500} w={940} h={140} label="BALANCE" appear={140}>
        <div style={{display: 'flex', gap: 50, alignItems: 'baseline'}}>
          <ReadoutRow label="BULL" delay={148}>
            <Roll target={5} decimals={0} delay={150} size={28} color={T} />
          </ReadoutRow>
          <ReadoutRow label="HOLD" delay={154}>
            <Roll target={2} decimals={0} delay={156} size={28} />
          </ReadoutRow>
          <ReadoutRow label="BEAR" delay={160}>
            <Roll target={1} decimals={0} delay={162} size={28} color={C.danger} />
          </ReadoutRow>
          <ReadoutRow label="STALE CUT" delay={166}>
            <Roll target={1} decimals={0} delay={168} size={28} color={C.macro} />
          </ReadoutRow>
        </div>
      </Instrument>
      <VFoot at={176} bottom={140}>
        STALE TARGETS GET DATED AND DROPPED FROM THE RANGE
      </VFoot>
    </Void>
  );
};

/* ========================= VC3 — the consensus band ======================== */

export const VC3_Band: React.FC = () => {
  const frame = useCurrentFrame();
  const LO = 205;
  const HI = 275;
  const toX = (v: number) => 130 + ((v - LO) / (HI - LO)) * 820;
  const merge = lerp(frame, [86, 108], [0, 1], easeInOut);
  const beat = heartbeat(frame - 108, 34);
  const SCALE_Y = 1010;
  return (
    <Void>
      <VKeyLight color={T} />
      <VHead title={'Consensus is a range,\nnot a number.'} color={T} chip="TARGET RANGE · VERIFIED ONLY" />
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 620,
          width: 940,
          height: 780,
          borderRadius: 12,
          background: C.panel,
          border: `1.5px solid ${C.hairline}`,
        }}
      />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {/* the shared scale */}
        <line x1={130} x2={950} y1={SCALE_Y} y2={SCALE_Y} stroke={C.hairline2} strokeWidth={2} opacity={lerp(frame, [14, 26], [0, 1])} />
        {[210, 230, 250, 270].map((v) => (
          <g key={v} opacity={lerp(frame, [18, 30], [0, 1])}>
            <line x1={toX(v)} x2={toX(v)} y1={SCALE_Y - 7} y2={SCALE_Y + 7} stroke={C.hairline2} strokeWidth={2} />
            <text x={toX(v)} y={SCALE_Y + 34} textAnchor="middle" fill={C.dim} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: 15}}>
              ${v}
            </text>
          </g>
        ))}
        {/* desk ranges drop in and stack above the scale — a crowd of opinions */}
        {DESKS.map((d, i) => {
          const at = 24 + i * 7;
          const drop = lerp(frame, [at, at + 16], [0, 1], easeOut);
          const y = SCALE_Y - 44 - i * 22 - (1 - drop) * 90;
          const op = drop * (1 - merge * 0.82);
          return (
            <line
              key={i}
              x1={toX(d.lo)}
              y1={y}
              x2={toX(d.hi)}
              y2={y}
              stroke={T}
              strokeWidth={7}
              strokeLinecap="round"
              opacity={op * 0.38}
            />
          );
        })}
        {/* the band */}
        <rect
          x={toX(236)}
          y={SCALE_Y - 210}
          width={toX(258) - toX(236)}
          height={150}
          rx={12}
          fill={T}
          opacity={merge * (0.14 + beat * 0.08)}
          style={{filter: `drop-shadow(0 0 18px ${T}55)`}}
        />
        <rect x={toX(236)} y={SCALE_Y - 210} width={toX(258) - toX(236)} height={150} rx={12} fill="none" stroke={T} strokeWidth={2} opacity={merge * 0.85} />
        {/* consensus + spot markers */}
        <line x1={toX(247)} y1={SCALE_Y - 230} x2={toX(247)} y2={SCALE_Y - 40} stroke={T} strokeWidth={3} opacity={merge} />
        <circle cx={toX(247)} cy={SCALE_Y - 135} r={7 + beat * 3} fill={T} opacity={merge} style={{filter: `drop-shadow(0 0 10px ${T})`}} />
        <line x1={toX(228)} y1={SCALE_Y - 16} x2={toX(228)} y2={SCALE_Y + 16} stroke={C.ink} strokeWidth={3} opacity={lerp(frame, [116, 128], [0, 1])} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: toX(247),
          top: SCALE_Y - 290,
          transform: 'translateX(-50%)',
          fontFamily: F.mono,
          fontSize: 19,
          color: T,
          opacity: merge,
        }}
      >
        consensus <span style={{color: C.ink, fontWeight: 700}}>$247</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: toX(228),
          top: SCALE_Y + 52,
          transform: 'translateX(-50%)',
          fontFamily: F.mono,
          fontSize: 17,
          color: C.muted,
          opacity: lerp(frame, [118, 130], [0, 1]),
        }}
      >
        spot $228
      </div>
      <Instrument x={110} y={1160} w={860} h={170} label="THE RANGE" appear={118}>
        <div style={{display: 'flex', gap: 48, alignItems: 'baseline', marginTop: 2}}>
          <ReadoutRow label="LOW" delay={124}>
            <Roll target={236} decimals={0} delay={126} size={30} />
          </ReadoutRow>
          <ReadoutRow label="CONSENSUS" delay={130}>
            <Roll target={247} decimals={0} delay={132} size={30} color={T} />
          </ReadoutRow>
          <ReadoutRow label="HIGH" delay={136}>
            <Roll target={258} decimals={0} delay={138} size={30} />
          </ReadoutRow>
          <ReadoutRow label="SPREAD" delay={142}>
            <Roll target={9} decimals={0} delay={144} size={30} suffix="%" />
          </ReadoutRow>
        </div>
      </Instrument>
      <VFoot at={158}>THE SPREAD IS SIGNAL TOO — WIDE MEANS THE STREET ISN'T SURE</VFoot>
    </Void>
  );
};

/* ========================= VC4 — bull case, bear case ====================== */

export const VC4_BullBear: React.FC = () => {
  const frame = useCurrentFrame();
  const Card: React.FC<{
    y: number;
    at: number;
    glyph: string;
    color: string;
    tag: string;
    line: string;
    target: number;
  }> = ({y, at, glyph, color, tag, line, target}) => {
    const s = pop(frame, at, 13, 0.85);
    return (
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: y,
          width: 940,
          height: 360,
          borderRadius: 14,
          background: C.panel,
          border: `1.5px solid ${color}44`,
          padding: '28px 34px',
          boxSizing: 'border-box',
          opacity: Math.min(s * 1.4, 1),
          transform: `translateY(${(1 - Math.min(s, 1)) * 30}px)`,
          boxShadow: `0 0 34px ${color}11`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <span style={{fontFamily: F.mono, fontSize: 44, color, lineHeight: 1}}>{glyph}</span>
          <span style={{fontFamily: F.mono, fontSize: 21, fontWeight: 700, letterSpacing: '0.12em', color}}>
            {tag}
          </span>
          <div style={{flex: 1}} />
          <span style={{fontFamily: F.mono, fontSize: 34, fontWeight: 700, color: C.ink, fontVariantNumeric: 'tabular-nums', opacity: lerp(frame, [at + 22, at + 32], [0, 1])}}>
            ${target}
          </span>
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: F.body,
            fontSize: 29,
            fontWeight: 400,
            lineHeight: 1.5,
            color: C.muted,
            maxWidth: 850,
            opacity: lerp(frame, [at + 14, at + 26], [0, 1]),
          }}
        >
          {line}
        </div>
      </div>
    );
  };
  return (
    <Void>
      <VKeyLight color={T} />
      <VHead title={'The bull and the bear,\nside by side.'} color={T} chip="BOTH CASES SHIP" />
      <Card
        y={600}
        at={26}
        glyph="▲"
        color={T}
        tag="BULL CASE"
        line="Underwrites the ramp: capacity locked, backlog building, pricing holding."
        target={258}
      />
      <Card
        y={1010}
        at={52}
        glyph="▼"
        color={C.danger}
        tag="BEAR CASE"
        line="Sees margin dilution on the next leg and a multiple priced for perfection."
        target={236}
      />
      <VFoot at={104} bottom={330}>
        DISAGREEMENT IS DATA, NOT AN ERROR
      </VFoot>
    </Void>
  );
};

/* ========================== VC5 — the divergence flag ====================== */

export const VC5_Flag: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = lerp(frame, [22, 58], [0, 1], easeInOut);
  const xA = 540 - 260 * drift;
  const xB = 540 + 260 * drift;
  const gapOn = lerp(frame, [62, 74], [0, 1]);
  const chipS = pop(frame, 82, 14, 0.5);
  const Y = 880;
  return (
    <Void>
      <VKeyLight color={T} />
      <VHead title={'When reads split,\nyou see the flag.'} color={T} chip="CROSS-LENS CHECK" />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <line x1={110} x2={970} y1={Y} y2={Y} stroke={C.hairline2} strokeWidth={2} opacity={lerp(frame, [10, 22], [0, 1])} />
        {/* the two reads drifting apart */}
        <g opacity={lerp(frame, [14, 24], [0, 1])}>
          <line x1={xA} y1={Y - 26} x2={xA} y2={Y + 26} stroke={T} strokeWidth={4} />
          <line x1={xB} y1={Y - 26} x2={xB} y2={Y + 26} stroke={C.macro} strokeWidth={4} />
        </g>
        {/* gap bracket */}
        <g opacity={gapOn}>
          <line x1={xA} y1={Y - 64} x2={xB} y2={Y - 64} stroke={C.macro} strokeWidth={2.5} />
          <line x1={xA} y1={Y - 72} x2={xA} y2={Y - 56} stroke={C.macro} strokeWidth={2.5} />
          <line x1={xB} y1={Y - 72} x2={xB} y2={Y - 56} stroke={C.macro} strokeWidth={2.5} />
        </g>
      </svg>
      <div style={{position: 'absolute', left: xA, top: Y + 46, transform: 'translateX(-50%)', fontFamily: F.mono, fontSize: 17, color: T, opacity: lerp(frame, [16, 26], [0, 1])}}>
        STREET READ
      </div>
      <div style={{position: 'absolute', left: xB, top: Y + 46, transform: 'translateX(-50%)', fontFamily: F.mono, fontSize: 17, color: C.macro, opacity: lerp(frame, [16, 26], [0, 1])}}>
        INDEPENDENT QUOTE
      </div>
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: Y - 118,
          transform: 'translateX(-50%)',
          fontFamily: F.mono,
          fontSize: 24,
          fontWeight: 700,
          color: C.macro,
          opacity: gapOn,
        }}
      >
        Δ 23%
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 1120,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${0.7 + Math.min(chipS, 1) * 0.3})`,
          opacity: Math.min(chipS * 1.5, 1),
        }}
      >
        <Chip size={23} color={C.macro} border={`${C.macro}88`} bg={`${C.macro}12`} style={{boxShadow: `0 0 30px ${C.macro}33`}}>
          DIVERGENCE FLAGGED
        </Chip>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1240, display: 'flex', justifyContent: 'center'}}>
        <Kinetic text={'Flagged in the open.\nScored anyway.'} delay={96} size={46} color={C.muted} />
      </div>
      <VFoot at={116} bottom={330}>
        JOINS THE KNOWN-GAPS LIST ON THE REPORT
      </VFoot>
    </Void>
  );
};
