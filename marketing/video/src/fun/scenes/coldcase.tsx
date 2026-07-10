import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Eyebrow, Grain, Kinetic, TypeOn, Void} from '../../lib/ui';
import {lerp, pop, rndIn, settle, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * "A stock-market cold case" — the manila folder, the evidence board, the
 * red string, and the twist: everything was in the filings the whole time.
 * The desk closes the case in thirteen minutes — with a FAIL.
 */

const PAPER = '#e9e4d6';
const PAPER_DARK = '#d9d2bf';
const INK = '#1b1813';
const STRING = '#c8443a';

/** K1 — the case file slaps down. */
export const K1_File: React.FC = () => {
  const frame = useCurrentFrame();
  const slam = settle(frame, 8);
  const stampIn = pop(frame, 78, 11, 0.75);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>A STOCK-MARKET COLD CASE</Eyebrow>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            position: 'relative',
            width: 780,
            height: 560,
            transform: `rotate(-2.5deg) scale(${1.45 - 0.45 * Math.min(slam, 1)})`,
            opacity: Math.min(slam * 2, 1),
          }}
        >
          {/* folder tab */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: -34,
              width: 250,
              height: 60,
              borderRadius: '14px 14px 0 0',
              background: PAPER_DARK,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 18,
              background: `linear-gradient(168deg, ${PAPER} 0%, ${PAPER_DARK} 100%)`,
              boxShadow: `0 ${50 * Math.min(slam, 1)}px ${120 * Math.min(slam, 1)}px rgba(0,0,0,0.55)`,
              padding: '52px 58px',
            }}
          >
            {/* coffee ring */}
            <div
              style={{
                position: 'absolute',
                right: 66,
                top: 54,
                width: 130,
                height: 130,
                borderRadius: 999,
                border: '9px solid rgba(96,72,38,0.16)',
              }}
            />
            <TypeOn
              text="CASE #4,721"
              delay={28}
              base={2.4}
              size={44}
              font="mono"
              weight={700}
              color={INK}
              tint={STRING}
              cursor={false}
              align="left"
            />
            <div
              style={{
                marginTop: 26,
                fontFamily: F.display,
                fontSize: 74,
                fontWeight: 700,
                color: INK,
                opacity: lerp(frame, [56, 68], [0, 1]),
                transform: `translateY(${(1 - pop(frame, 56, 14, 0.9)) * 18}px)`,
              }}
            >
              THE STOCK TIP
            </div>
            <div
              style={{
                marginTop: 30,
                fontFamily: F.mono,
                fontSize: 25,
                letterSpacing: '0.12em',
                color: 'rgba(27,24,19,0.65)',
                opacity: lerp(frame, [100, 112], [0, 1]),
              }}
            >
              OPENED 9:31 AM · A TUESDAY
            </div>
            {/* the stamp */}
            <div
              style={{
                position: 'absolute',
                right: 44,
                bottom: 44,
                padding: '14px 26px',
                border: `4px double ${STRING}`,
                borderRadius: 8,
                fontFamily: F.mono,
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: STRING,
                opacity: Math.min(stampIn * 1.3, 1) * 0.9,
                transform: `rotate(7deg) scale(${1.5 - 0.5 * Math.min(stampIn, 1)})`,
              }}
            >
              CONFIDENTIAL
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Grain opacity={0.08} />
    </Void>
  );
};

type Pin = {x: number; y: number};
const PINS: Pin[] = [
  {x: 320, y: 556},
  {x: 770, y: 676},
  {x: 360, y: 1026},
  {x: 780, y: 1346},
];
const STRINGS = [
  `M ${PINS[0].x} ${PINS[0].y} Q 545 660 ${PINS[1].x} ${PINS[1].y}`,
  `M ${PINS[1].x} ${PINS[1].y} Q 565 910 ${PINS[2].x} ${PINS[2].y}`,
  `M ${PINS[2].x} ${PINS[2].y} Q 570 1250 ${PINS[3].x} ${PINS[3].y}`,
];

/** One pinned polaroid with a sketch inside. */
const Polaroid: React.FC<{
  left: number;
  top: number;
  at: number;
  rot: number;
  label: string;
  children: React.ReactNode;
}> = ({left, top, at, rot, label, children}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, 12, 0.85);
  const op = lerp(frame, [at, at + 7], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: 300,
        height: 356,
        background: PAPER,
        borderRadius: 6,
        padding: 18,
        boxShadow: '0 22px 55px rgba(0,0,0,0.5)',
        opacity: op,
        transform: `rotate(${rot}deg) scale(${0.75 + 0.25 * Math.min(s, 1)})`,
        transformOrigin: 'top center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 244,
          background: '#11141c',
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
      <div
        style={{
          marginTop: 16,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: INK,
        }}
      >
        {label}
      </div>
      {/* the pin */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -9,
          width: 22,
          height: 22,
          borderRadius: 999,
          transform: 'translateX(-50%)',
          background: `radial-gradient(circle at 35% 30%, #e07b6f, ${STRING})`,
          boxShadow: '0 6px 12px rgba(0,0,0,0.6)',
        }}
      />
    </div>
  );
};

/** K2 — the evidence board. */
export const K2_Board: React.FC = () => {
  const frame = useCurrentFrame();
  const creep = lerp(frame, [0, 264], [1, 1.06]);
  return (
    <Void depth>
      <AbsoluteFill style={{transform: `scale(${creep})`, transformOrigin: '50% 42%'}}>
        <AbsoluteFill style={{alignItems: 'center'}}>
          <div style={{marginTop: 210, opacity: lerp(frame, [4, 16], [0, 1])}}>
            <Eyebrow color={C.muted}>THE EVIDENCE</Eyebrow>
          </div>
        </AbsoluteFill>

        {/* strings live UNDER the polaroids' pins visually — draw first */}
        <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
          {STRINGS.map((d, i) => {
            const p = evolvePath(lerp(frame, [44 + i * 44, 66 + i * 44], [0, 1], smooth), d);
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={STRING}
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeDasharray={p.strokeDasharray}
                strokeDashoffset={p.strokeDashoffset}
                style={{filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.5))'}}
              />
            );
          })}
        </svg>

        <Polaroid left={170} top={540} at={18} rot={-4.5} label="THE TIP">
          {/* a chat bubble */}
          <div
            style={{
              position: 'absolute',
              left: 42,
              top: 62,
              width: 176,
              height: 84,
              borderRadius: 18,
              borderBottomLeftRadius: 4,
              border: '2.5px solid rgba(231,234,238,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <Redact cash scale={0.66} dim />
            <span style={{fontFamily: F.body, fontSize: 30}}>🚀</span>
          </div>
        </Polaroid>

        <Polaroid left={620} top={660} at={62} rot={3.5} label="THE CHART">
          <svg viewBox="0 0 264 244" style={{position: 'absolute', inset: 0}}>
            <polyline
              points="16,200 60,180 96,150 130,158 168,96 214,44 248,30"
              fill="none"
              stroke={C.fundamentals}
              strokeWidth={5}
              strokeLinecap="round"
            />
          </svg>
        </Polaroid>

        <Polaroid left={210} top={1010} at={106} rot={-3} label="THE BUY">
          <svg viewBox="0 0 264 244" style={{position: 'absolute', inset: 0}}>
            <polyline
              points="14,210 70,150 118,64 150,50 190,120 250,200"
              fill="none"
              stroke="rgba(231,234,238,0.6)"
              strokeWidth={4}
            />
            <circle cx={150} cy={50} r={13} fill="none" stroke={C.discovery} strokeWidth={4} />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 132,
              top: 6,
              fontFamily: F.mono,
              fontSize: 22,
              fontWeight: 700,
              color: C.discovery,
            }}
          >
            HERE
          </div>
        </Polaroid>

        <Polaroid left={630} top={1330} at={150} rot={4} label="THE BAG">
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{fontFamily: F.mono, fontSize: 56, fontWeight: 700, color: C.danger}}>−84%</span>
            <span style={{fontFamily: F.mono, fontSize: 34, color: C.danger}}>▼</span>
          </div>
        </Polaroid>
      </AbsoluteFill>

      {/* narration */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 200, height: 50}}>
          {frame < 214 ? (
            <TypeOn
              text="He heard it from a guy."
              delay={172}
              base={1.5}
              size={31}
              font="mono"
              weight={500}
              color={C.ink}
              cursor={false}
              out={210}
            />
          ) : (
            <TypeOn
              text="The guy heard it from a chat."
              delay={216}
              base={1.4}
              size={31}
              font="mono"
              weight={500}
              color={C.ink}
              cursor={false}
            />
          )}
        </div>
      </AbsoluteFill>
      <Grain opacity={0.08} />
    </Void>
  );
};

const ROWS: Array<[string, string]> = [
  ['PIOTROSKI F-SCORE', '2 / 9'],
  ['GOING CONCERN', 'NOTED'],
  ['NET DILUTION', 'SERIAL'],
];

/** K3 — the twist: it was all public. */
export const K3_Twist: React.FC = () => {
  const frame = useCurrentFrame();
  const sheetIn = settle(frame, 6);
  const lightX = lerp(frame, [20, 74], [180, 900], smooth);
  const lightOp = lerp(frame, [20, 30], [0, 1]) * lerp(frame, [66, 80], [1, 0]);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            marginTop: 340,
            width: 700,
            borderRadius: 10,
            background: `linear-gradient(172deg, ${PAPER} 0%, ${PAPER_DARK} 100%)`,
            boxShadow: '0 40px 100px rgba(0,0,0,0.55)',
            padding: '44px 52px',
            transform: `rotate(1.4deg) translateY(${(1 - Math.min(sheetIn, 1)) * 120}px)`,
            opacity: Math.min(sheetIn * 2, 1),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 20,
              borderBottom: `2px solid rgba(27,24,19,0.25)`,
            }}
          >
            <span style={{fontFamily: F.mono, fontSize: 24, fontWeight: 700, letterSpacing: '0.12em', color: INK}}>
              FILING — PUBLIC RECORD
            </span>
            {/* ink-on-paper redact — the white one vanishes on cream */}
            <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
              <span style={{fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: 'rgba(27,24,19,0.7)'}}>$</span>
              {[18, 12, 15, 10, 14].map((w, i) => (
                <div key={i} style={{width: w, height: 13, borderRadius: 3, background: 'rgba(27,24,19,0.55)'}} />
              ))}
            </div>
          </div>
          {ROWS.map(([k, v], i) => {
            const at = 34 + i * 14;
            const op = lerp(frame, [at, at + 10], [0, 1]);
            return (
              <div
                key={k}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 14,
                  marginTop: 30,
                  opacity: op,
                }}
              >
                <span style={{fontFamily: F.mono, fontSize: 27, fontWeight: 500, color: INK, whiteSpace: 'nowrap'}}>
                  {k}
                </span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: '2.5px dotted rgba(27,24,19,0.4)',
                    transform: 'translateY(-6px)',
                  }}
                />
                <span style={{fontFamily: F.mono, fontSize: 27, fontWeight: 700, color: STRING, whiteSpace: 'nowrap'}}>
                  {v}
                </span>
              </div>
            );
          })}
          {/* the flashlight sweep */}
          <div
            style={{
              position: 'absolute',
              left: lightX - 260,
              top: -60,
              width: 520,
              height: 420,
              borderRadius: 999,
              background: 'radial-gradient(closest-side, rgba(255,252,240,0.32), transparent)',
              opacity: lightOp,
              pointerEvents: 'none',
            }}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 360}}>
          <Kinetic
            text={'The evidence was public\nthe whole time.'}
            delay={86}
            size={58}
            accents={{3: C.discovery}}
          />
        </div>
      </AbsoluteFill>
      <Grain opacity={0.08} />
    </Void>
  );
};

/** K4 — the desk closes the case. With a FAIL. */
export const K4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'Read the filings first.'} delay={8} size={68} accents={{2: C.discovery}} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={48}
      stag={16}
      verdictAt={120}
      glyphs={['▼', '─', '▼']}
      score="19.3"
      confluence={false}
      chip="WOULD HAVE FAILED THE GATE"
      foot="CASE CLOSED IN 13 MINUTES"
      footAt={152}
      top={620}
    />
  </Void>
);

/** K5 — endcard. */
export const K5_End: React.FC = () => <FunEndcard gag="DON’T BECOME A CASE FILE" />;
