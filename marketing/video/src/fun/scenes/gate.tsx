import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Eyebrow, Kinetic, Void} from '../../lib/ui';
import {easeIn, lerp, pop, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {FunEndcard, MiniRow, Redact} from '../flib';

/**
 * "The Gate" — the velvet rope runs the automatic vetoes. Vibes don't argue
 * with the bouncer; the bouncer checks the books.
 */

const QX = [170, 355, 540, 725, 910];
const QY = 1610;
const GATE_Y = 1290;

type Verdict = {pass: boolean; reason?: string};
const VERDICTS: Verdict[] = [
  {pass: true},
  {pass: false, reason: 'F-SCORE 2 / 9'},
  {pass: false, reason: 'DISTRESS ZONE'},
  {pass: true},
  {pass: false, reason: 'SERIAL DILUTION'},
];
const cyc = (i: number) => 16 + i * 62;

const TickerChip: React.FC<{x: number; y: number; scale?: number; opacity?: number; rot?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 1,
  rot = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
      opacity,
      background: C.panel,
      border: `1.5px solid ${C.hairline2}`,
      borderRadius: 999,
      padding: '26px 34px',
      boxShadow: '0 16px 44px rgba(0,0,0,0.45)',
    }}
  >
    <Redact scale={0.95} />
  </div>
);

/** Rope + stanchions; the rope draws on. */
const Rope: React.FC<{drawAt?: number}> = ({drawAt = 0}) => {
  const frame = useCurrentFrame();
  const draw = lerp(frame, [drawAt, drawAt + 26], [0, 1], smooth);
  const LEN = 640;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      {[250, 830].map((px) => (
        <g key={px} opacity={lerp(frame, [drawAt, drawAt + 12], [0, 1])}>
          <rect x={px - 9} y={940} width={18} height={244} rx={9} fill={C.panel2} stroke={C.hairline2} strokeWidth={1.5} />
          <circle cx={px} cy={932} r={17} fill={C.panel2} stroke={C.hairline2} strokeWidth={1.5} />
          <rect x={px - 40} y={1180} width={80} height={14} rx={7} fill={C.panel2} stroke={C.hairline2} strokeWidth={1.5} />
        </g>
      ))}
      <path
        d="M 250 952 Q 540 1064 830 952"
        fill="none"
        stroke={C.danger}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={LEN}
        strokeDashoffset={LEN * (1 - draw)}
        opacity={0.85}
      />
    </svg>
  );
};

/** B1 — the queue forms. */
export const B1_Queue: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 260, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow size={24} color={C.ink}>
            THE GATE
          </Eyebrow>
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: F.mono,
            fontSize: 19,
            letterSpacing: '0.14em',
            color: C.dim,
            opacity: lerp(frame, [18, 30], [0, 1]),
          }}
        >
          AUTOMATIC VETOES · NO EXCEPTIONS
        </div>
        <div style={{marginTop: 200}}>
          <Kinetic text={'Everyone wants in.'} delay={46} size={62} />
        </div>
      </AbsoluteFill>
      <Rope drawAt={10} />
      {QX.map((x, i) => {
        const s = pop(frame, 44 + i * 9, 12, 0.85);
        return (
          <TickerChip
            key={i}
            x={x}
            y={QY + Math.sin(frame / 16 + i * 1.7) * 5}
            scale={0.6 + 0.4 * s}
            opacity={Math.min(s * 1.4, 1)}
          />
        );
      })}
    </Void>
  );
};

/** B2 — five checks: two clear, three vetoes with reasons stamped. */
export const B2_Checks: React.FC = () => {
  const frame = useCurrentFrame();
  const passed = VERDICTS.filter((v, i) => v.pass && frame >= cyc(i) + 34).length;
  const vetoed = VERDICTS.filter((v, i) => !v.pass && frame >= cyc(i) + 34).length;
  return (
    <Void depth>
      {/* inside the venue: the earlier passers idle dim beyond the rope */}
      <Rope drawAt={-99} />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 260}}>
          <Eyebrow size={24} color={C.ink}>
            THE GATE
          </Eyebrow>
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: F.mono,
            fontSize: 19,
            letterSpacing: '0.14em',
            color: C.dim,
          }}
        >
          IN {passed} · OUT {vetoed}
        </div>
      </AbsoluteFill>

      {QX.map((qx, i) => {
        const c = cyc(i);
        const v = VERDICTS[i];
        const appr = lerp(frame, [c, c + 14], [0, 1], smooth);
        // vetoes hold longer so the stamped reason can actually be read
        const exitStart = v.pass ? c + 44 : c + 58;
        const exit = lerp(frame, [exitStart, exitStart + 16], [0, 1], easeIn);
        let x = qx + (540 - qx) * appr;
        let y = QY + Math.sin(frame / 16 + i * 1.7) * 5 * (1 - appr) + (GATE_Y - QY) * appr;
        let rot = 0;
        let scale = 1;
        let op = 1;
        if (exit > 0) {
          if (v.pass) {
            y = GATE_Y + (830 - GATE_Y) * exit;
            scale = 1 - 0.42 * exit;
            op = 1 - 0.62 * exit;
          } else {
            const side = i % 2 === 0 ? 1 : -1;
            x = 540 + side * 620 * exit;
            y = GATE_Y + 860 * exit * exit;
            rot = side * 42 * exit;
          }
        }

        const scanT = lerp(frame, [c + 16, c + 32], [0, 1]);
        const scanOn = scanT > 0 && scanT < 1;
        const verdictIn = pop(frame, c + 34, 12, 0.8);
        const showVerdict = frame >= c + 34 && exit < 1;

        return (
          <React.Fragment key={i}>
            <TickerChip x={x} y={y} rot={rot} scale={scale} opacity={op} />
            {scanOn && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: 540 - 160 + scanT * 320,
                    top: GATE_Y - 110,
                    width: 3.5,
                    height: 220,
                    background: C.discovery,
                    boxShadow: `0 0 18px ${C.discovery}aa`,
                    opacity: 0.9,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 540,
                    top: GATE_Y - 150,
                    transform: 'translate(-50%, -100%)',
                    fontFamily: F.mono,
                    fontSize: 17,
                    letterSpacing: '0.12em',
                    color: C.dim,
                    opacity: 0.5 + 0.5 * Math.abs(Math.sin(frame / 3)),
                  }}
                >
                  CHECKING F · Z · DILUTION
                </div>
              </>
            )}
            {showVerdict && (
              <div
                style={{
                  position: 'absolute',
                  left: 540,
                  top: GATE_Y - 190,
                  transform: `translate(-50%, -50%) scale(${verdictIn}) rotate(${v.pass ? 0 : -10}deg)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                  opacity: 1 - exit,
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 999,
                    border: `4px solid ${v.pass ? C.fundamentals : C.danger}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: F.display,
                    fontSize: 54,
                    fontWeight: 700,
                    color: v.pass ? C.fundamentals : C.danger,
                    background: `${v.pass ? C.fundamentals : C.danger}12`,
                    boxShadow: `0 0 30px ${v.pass ? C.fundamentals : C.danger}33`,
                  }}
                >
                  {v.pass ? '✓' : '✕'}
                </div>
                {v.reason && (
                  <Chip size={18} color={C.danger} border={`${C.danger}66`} bg={`${C.danger}12`}>
                    {v.reason}
                  </Chip>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </Void>
  );
};

/** B3 — the line. */
export const B3_Line: React.FC = () => (
  <Void>
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <Kinetic
        text={'The gate doesn’t argue.\nIt checks.'}
        delay={8}
        size={62}
        accents={{5: C.fundamentals}}
      />
    </AbsoluteFill>
  </Void>
);

/** B4 — getting in only earns a scoring. */
export const B4_Board: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 320}}>
          <Kinetic text={'Getting in only\nearns a scoring.'} delay={6} size={58} />
        </div>
      </AbsoluteFill>
      <MiniRow y={880} rank="01" score="73.9" at={48} />
      <MiniRow y={1000} rank="02" score="69.5" at={66} />
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 1150,
          fontFamily: F.mono,
          fontSize: 18,
          letterSpacing: '0.12em',
          color: C.dim,
          opacity: lerp(frame, [96, 110], [0, 1]),
        }}
      >
        GATES CHECKED · SCORES RE-VERIFIED IN CODE
      </div>
    </Void>
  );
};

/** B5 — endcard. */
export const B5_End: React.FC = () => <FunEndcard gag="NO VIBES PAST THIS POINT" />;
