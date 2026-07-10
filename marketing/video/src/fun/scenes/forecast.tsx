import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Chip, Eyebrow, Grain, Kinetic, Void} from '../../lib/ui';
import {lerp, pop, pulse01, settle, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard} from '../flib';

/**
 * ENGINE SPECIAL (game theory) — "Channel 8 Market Weather."
 * Your feed forecasts 100% moon (source: vibes). The real desk maps pressure
 * systems (players), fronts (forced moves), a four-horizon probability cone
 * ("a curve, not a vibe"), and a severe-asymmetry warning that carries its
 * own kill condition — because forecasts here get graded in public.
 * Episode palette (midnight broadcast blue, radar green, warning amber)
 * lives only inside this episode; copper stays the game-theory accent.
 */

const SKY = '#0a1a33';
const RADAR = '#3fe07f';
const WARN = '#ffb23e';
const BUGBLUE = '#12325e';

/** Midnight-broadcast wash over the void. */
const SkyWash: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(95% 75% at 50% 44%, ${SKY}b0 0%, ${SKY}40 55%, transparent 80%)`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

/** The station bug — top-right, every studio scene. */
const StationBug: React.FC<{at?: number}> = ({at = 4}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', top: 160, right: 60, opacity: lerp(frame, [at, at + 10], [0, 1])}}>
      <Chip size={25} color={C.ink} border={`${BUGBLUE}`} bg={`${BUGBLUE}66`}>
        CH·8 MARKET WEATHER
      </Chip>
    </div>
  );
};

/** WX1 — tonight's stock forecast: 100% moon (source: vibes). */
export const WX1_Studio: React.FC = () => {
  const frame = useCurrentFrame();
  const cardIn = settle(frame, 36);
  const gagOut = lerp(frame, [138, 150], [1, 0]);
  return (
    <Void depth>
      <SkyWash />
      <StationBug />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 460}}>
          <Kinetic text={'Tonight’s stock forecast:'} delay={8} size={84} out={138} />
        </div>
      </AbsoluteFill>

      {/* the joke forecast */}
      <AbsoluteFill style={{alignItems: 'center', opacity: gagOut}}>
        <div
          style={{
            marginTop: 720,
            width: 720,
            borderRadius: 20,
            background: C.panel,
            border: `2px solid ${C.discovery}66`,
            boxShadow: `0 34px 90px rgba(0,0,0,0.55), 0 0 60px ${C.discovery}22`,
            padding: '54px 40px 46px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            transform: `rotate(2deg) translateY(${(1 - Math.min(cardIn, 1)) * 120}px)`,
            opacity: Math.min(cardIn * 2, 1),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
            <span style={{fontFamily: F.display, fontSize: 116, fontWeight: 700, color: C.discovery, lineHeight: 1}}>
              100%
            </span>
            <span style={{fontSize: 78, lineHeight: 1}}>🚀</span>
          </div>
          <span
            style={{
              fontFamily: F.display,
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: C.ink,
            }}
          >
            CHANCE OF MOON
          </span>
        </div>
        <div
          style={{
            marginTop: 44,
            fontFamily: F.mono,
            fontSize: 25,
            letterSpacing: '0.14em',
            color: C.muted,
            opacity: lerp(frame, [74, 86], [0, 1]),
          }}
        >
          SOURCE: VIBES
        </div>
      </AbsoluteFill>

      {frame >= 148 && (
        <AbsoluteFill style={{alignItems: 'center'}}>
          <div style={{marginTop: 920}}>
            <Kinetic text={'Here’s the real forecast.'} delay={152} size={54} accents={{2: C.macro}} />
          </div>
        </AbsoluteFill>
      )}
      <Grain opacity={0.07} />
    </Void>
  );
};

/* map geometry */
const COAST =
  'M 200 520 C 320 430, 520 410, 640 470 C 780 400, 930 480, 960 620 ' +
  'C 1010 780, 940 960, 850 1080 C 900 1210, 800 1330, 660 1350 ' +
  'C 520 1390, 340 1340, 260 1210 C 150 1100, 130 940, 190 820 C 130 680, 150 580, 200 520 Z';
const HI: [number, number] = [370, 740];
const LO: [number, number] = [720, 1060];
const FRONT = 'M 430 850 Q 540 900, 590 950 T 700 1010';

/** WX2 — the pressure map: players and forced moves. */
export const WX2_Map: React.FC = () => {
  const frame = useCurrentFrame();
  const coast = evolvePath(lerp(frame, [10, 52], [0, 1], smooth), COAST);
  const front = evolvePath(lerp(frame, [108, 130], [0, 1], smooth), FRONT);
  const cell = (xy: [number, number], at: number, letter: string, chip: string, chipAt: number) => {
    const s = pop(frame, at, 12, 0.85);
    const op = lerp(frame, [at, at + 8], [0, 1]);
    return (
      <>
        {[76, 118, 160].map((r, i) => (
          <div
            key={r}
            style={{
              position: 'absolute',
              left: xy[0] - r,
              top: xy[1] - r,
              width: r * 2,
              height: r * 2,
              borderRadius: 999,
              border: `1.5px solid ${C.hairline2}`,
              opacity: lerp(frame, [at + 6 + i * 7, at + 16 + i * 7], [0, 0.75 - i * 0.18]),
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: xy[0],
            top: xy[1],
            transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * Math.min(s, 1)})`,
            opacity: op,
            fontFamily: F.display,
            fontSize: 100,
            fontWeight: 700,
            color: C.ink,
            textShadow: '0 0 30px rgba(231,234,238,0.35)',
            lineHeight: 1,
          }}
        >
          {letter}
        </div>
        <div
          style={{
            position: 'absolute',
            left: xy[0],
            top: xy[1] + 92,
            transform: 'translateX(-50%)',
            opacity: lerp(frame, [chipAt, chipAt + 10], [0, 1]),
            whiteSpace: 'nowrap',
          }}
        >
          <Chip size={25} color={C.ink} border={C.hairline2} bg={C.panel}>
            {chip}
          </Chip>
        </div>
      </>
    );
  };
  return (
    <Void depth>
      <SkyWash />
      <StationBug />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>THE PRESSURE MAP</Eyebrow>
        </div>
      </AbsoluteFill>

      <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        {/* graticule */}
        {[640, 880, 1120].map((y) => (
          <path
            key={y}
            d={`M 140 ${y} Q 540 ${y - 46}, 940 ${y}`}
            fill="none"
            stroke={C.hairline}
            strokeWidth={1.5}
            opacity={lerp(frame, [30, 54], [0, 0.5])}
          />
        ))}
        {[340, 540, 740].map((x) => (
          <path
            key={x}
            d={`M ${x} 500 Q ${x + 30} 940, ${x} 1370`}
            fill="none"
            stroke={C.hairline}
            strokeWidth={1.5}
            opacity={lerp(frame, [30, 54], [0, 0.5])}
          />
        ))}
        {/* the landmass */}
        <path d={COAST} fill={`${RADAR}0d`} opacity={lerp(frame, [40, 60], [0, 1])} />
        <path
          d={COAST}
          fill="none"
          stroke={RADAR}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={coast.strokeDasharray}
          strokeDashoffset={coast.strokeDashoffset}
          opacity={0.85}
          style={{filter: `drop-shadow(0 0 8px ${RADAR}66)`}}
        />
        {/* the front — where the forced move happens */}
        <path
          d={FRONT}
          fill="none"
          stroke={C.danger}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={front.strokeDasharray}
          strokeDashoffset={front.strokeDashoffset}
          style={{filter: `drop-shadow(0 0 8px ${C.danger}66)`}}
        />
        {[0.15, 0.4, 0.65, 0.9].map((t, i) => {
          const op = lerp(frame, [116 + i * 5, 124 + i * 5], [0, 1]);
          // triangles riding the front line (precomputed positions along the curve)
          const px = 430 + (700 - 430) * t;
          const py = 850 + (1010 - 850) * t + Math.sin(t * Math.PI) * 36;
          return (
            <polygon
              key={i}
              points={`${px},${py - 16} ${px + 15},${py + 8} ${px - 15},${py + 8}`}
              fill={C.danger}
              opacity={op * 0.9}
              transform={`rotate(${34 + t * 12} ${px} ${py})`}
            />
          );
        })}
        {/* wind arrows H → L */}
        {[
          {d: 'M 430 760 Q 520 800, 596 878', at: 128},
          {d: 'M 400 880 Q 500 940, 596 986', at: 136},
          {d: 'M 470 690 Q 610 740, 680 856', at: 144},
        ].map((a, i) => {
          const p = evolvePath(lerp(frame, [a.at, a.at + 16], [0, 1], smooth), a.d);
          return (
            <path
              key={i}
              d={a.d}
              fill="none"
              stroke={RADAR}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray={p.strokeDasharray}
              strokeDashoffset={p.strokeDashoffset}
              opacity={0.9}
              markerEnd="none"
            />
          );
        })}
      </svg>

      {cell(HI, 56, 'H', 'THE INCUMBENT · HIGH PRESSURE', 66)}
      {cell(LO, 80, 'L', 'THE CHALLENGER · LOW PRESSURE', 90)}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 300}}>
          <Kinetic
            text={'Pressure is incentive.\nWind is the forced move.'}
            delay={150}
            size={46}
            accents={{6: C.macro, 7: C.macro}}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 210,
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.muted,
            opacity: lerp(frame, [196, 210], [0, 1]),
          }}
        >
          PLAYERS MAPPED · M × E × C BEHIND EVERY CELL
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/* horizon strip + cone */
const HORIZONS = [
  {h: '3M', pct: '45%', x: 340, y: 960, sun: 0},
  {h: '6M', pct: '55%', x: 540, y: 880, sun: 1},
  {h: '12M', pct: '60%', x: 740, y: 840, sun: 2},
  {h: '24M', pct: '70%', x: 900, y: 760, sun: 3},
];

/** Tiny procedural weather icon: cloud → clearing → sun. */
const WxIcon: React.FC<{stage: number}> = ({stage}) => {
  const sun = stage >= 2;
  const cloud = stage <= 2;
  return (
    <div style={{position: 'relative', width: 84, height: 62}}>
      {sun || stage === 1 ? (
        <div
          style={{
            position: 'absolute',
            left: stage === 1 ? 6 : 22,
            top: 0,
            width: stage === 1 ? 30 : 42,
            height: stage === 1 ? 30 : 42,
            borderRadius: 999,
            background: WARN,
            boxShadow: `0 0 20px ${WARN}88`,
          }}
        />
      ) : null}
      {cloud && (
        <>
          <div
            style={{
              position: 'absolute',
              left: stage === 2 ? 34 : 14,
              top: 22,
              width: 40,
              height: 40,
              borderRadius: 999,
              background: stage === 0 ? '#9aa7bd' : '#b6c2d6',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: stage === 2 ? 20 : 0,
              top: 34,
              width: 76,
              height: 26,
              borderRadius: 99,
              background: stage === 0 ? '#9aa7bd' : '#b6c2d6',
            }}
          />
        </>
      )}
    </div>
  );
};

/** WX3 — the four-horizon outlook: a curve, not a vibe. */
export const WX3_Curve: React.FC = () => {
  const frame = useCurrentFrame();
  const coneOp = lerp(frame, [10, 34], [0, 1]);
  const lineDraw = lerp(frame, [14, 44], [0, 1], smooth);
  const CENTER = `M 150 980 L 340 960 L 540 880 L 740 840 L 900 760`;
  const BEAR = `M 150 1000 L 400 1040 L 640 1080 L 900 1100`;
  const center = evolvePath(lineDraw, CENTER);
  const bear = evolvePath(lerp(frame, [100, 126], [0, 1], smooth), BEAR);
  return (
    <Void depth>
      <SkyWash />
      <StationBug />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>THE 4-HORIZON OUTLOOK</Eyebrow>
        </div>
      </AbsoluteFill>

      {/* forecast strip */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 430, display: 'flex', gap: 24}}>
          {HORIZONS.map((h, i) => {
            const at = 52 + i * 14;
            const s = pop(frame, at, 13, 0.9);
            const op = lerp(frame, [at, at + 9], [0, 1]);
            return (
              <div
                key={h.h}
                style={{
                  width: 205,
                  height: 264,
                  background: C.panel,
                  border: `1.5px solid ${C.hairline}`,
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  opacity: op,
                  transform: `translateY(${(1 - s) * 34}px)`,
                  boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
                }}
              >
                <span style={{fontFamily: F.mono, fontSize: 25, letterSpacing: '0.12em', color: C.muted}}>{h.h}</span>
                <WxIcon stage={h.sun} />
                <span
                  style={{
                    fontFamily: F.display,
                    fontSize: 56,
                    fontWeight: 700,
                    color: C.ink,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {h.pct}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* the cone */}
      <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        <polygon
          points="150,990 900,700 900,1130"
          fill={`${RADAR}14`}
          opacity={coneOp}
        />
        <path
          d={CENTER}
          fill="none"
          stroke={RADAR}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={center.strokeDasharray}
          strokeDashoffset={center.strokeDashoffset}
          style={{filter: `drop-shadow(0 0 10px ${RADAR}66)`}}
        />
        {HORIZONS.map((h, i) => (
          <circle
            key={h.h}
            cx={h.x}
            cy={h.y}
            r={9}
            fill={RADAR}
            opacity={lerp(frame, [52 + i * 14, 62 + i * 14], [0, 1])}
          />
        ))}
        <path
          d={BEAR}
          fill="none"
          stroke={C.danger}
          strokeWidth={3.5}
          strokeDasharray={`14 12`}
          strokeDashoffset={bear.strokeDashoffset}
          opacity={lerp(frame, [100, 112], [0, 0.8])}
        />
      </svg>
      {/* dashed-line tag — the bear path stays on the map */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: 1130,
          transform: 'translateX(-50%)',
          opacity: lerp(frame, [126, 138], [0, 1]),
          whiteSpace: 'nowrap',
          fontFamily: F.mono,
          fontSize: 24,
          letterSpacing: '0.12em',
          color: C.muted,
        }}
      >
        THE BEAR PATH STAYS ON THE MAP
      </div>

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 300}}>
          <Kinetic text={'A curve, not a vibe.'} delay={120} size={50} accents={{1: C.macro}} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 210,
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.muted,
            opacity: lerp(frame, [168, 182], [0, 1]),
          }}
        >
          REFERENCE CLASS FIRST · HOW OFTEN DOES THIS RAIN?
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/** WX4 — severe asymmetry warning, with the kill condition attached. */
export const WX4_Warning: React.FC = () => {
  const frame = useCurrentFrame();
  const bannerIn = settle(frame, 8);
  const glow = pulse01(((frame + 24) % 48) / 48) * lerp(frame, [8, 30], [0, 1]);
  const cardIn = settle(frame, 96);
  const stampS = pop(frame, 150, 11, 0.75);
  return (
    <Void depth>
      <SkyWash />
      <StationBug />
      {/* the banner */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 240,
          transform: `translateY(${(1 - Math.min(bannerIn, 1)) * -260}px)`,
          background: `linear-gradient(180deg, ${WARN} 0%, #e89a26 100%)`,
          borderTop: `4px solid ${C.whiteInk}`,
          borderBottom: `4px solid ${C.whiteInk}`,
          boxShadow: `0 24px 70px rgba(0,0,0,0.5), 0 0 ${30 + glow * 40}px ${WARN}55`,
          padding: '40px 0 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <span
          style={{
            fontFamily: F.display,
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: C.whiteInk,
            whiteSpace: 'nowrap',
          }}
        >
          ⚠ SEVERE ASYMMETRY WARNING
        </span>
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: C.whiteInk,
            opacity: lerp(frame, [30, 44], [0, 1]),
          }}
        >
          PRICED LIKE DRIZZLE · MAPS LIKE A FRONT
        </span>
      </div>

      {/* the number behind the siren */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 566, opacity: lerp(frame, [70, 82], [0, 1])}}>
          <Chip size={27} color={C.macro} border={`${C.macro}aa`} bg={`${C.macro}12`} style={{boxShadow: `0 0 22px ${C.macro}44`}}>
            MISPRICING · 8.5 / 10
          </Chip>
        </div>
      </AbsoluteFill>

      {/* the kill condition */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            marginTop: 690,
            width: 760,
            background: C.panel,
            border: `1.5px solid ${C.danger}55`,
            borderRadius: 16,
            padding: '38px 46px 110px',
            position: 'relative',
            opacity: Math.min(cardIn * 2, 1),
            transform: `translateY(${(1 - Math.min(cardIn, 1)) * 110}px)`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{fontFamily: F.mono, fontSize: 25, letterSpacing: '0.12em', color: C.muted}}>
            THIS FORECAST DIES IF:
          </span>
          <div
            style={{
              marginTop: 22,
              fontFamily: F.mono,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.5,
              color: C.ink,
              opacity: lerp(frame, [112, 126], [0, 1]),
            }}
          >
            THE DEMAND ANCHOR SLIPS
            <br />
            TWO STRAIGHT QUARTERS.
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 26,
              transform: `translateX(-50%) rotate(-2deg) scale(${1.4 - 0.4 * Math.min(stampS, 1)})`,
              opacity: Math.min(stampS * 1.3, 1),
              whiteSpace: 'nowrap',
            }}
          >
            <Chip size={26} color={C.danger} border={`${C.danger}88`} bg={`${C.danger}10`}>
              ✕ KILL CONDITION SET
            </Chip>
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 300}}>
          <Kinetic text={'Every forecast here\ngets graded in public.'} delay={172} size={44} accents={{4: C.macro}} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 210,
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.muted,
            opacity: lerp(frame, [212, 226], [0, 1]),
          }}
        >
          GRADED LIKE A FORECASTER, NOT A GURU
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/** WX5 — the desk: game theory forecasts the board. */
export const WX5_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'Game theory forecasts\nthe board.'} delay={8} size={56} accents={{0: C.macro, 1: C.macro}} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={52}
      stag={18}
      verdictAt={124}
      foot="GRADED, NOT TRUSTED · FOUND BY TRILLION-DNA SCREEN"
      footAt={154}
      top={660}
    />
  </Void>
);

/** WX6 — endcard. */
export const WX6_End: React.FC = () => <FunEndcard gag="SEVERE ASYMMETRY WARNING" />;
