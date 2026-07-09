import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Trail} from '@remotion/motion-blur';
import {noise2D} from '@remotion/noise';
import {Center, Chip, Kinetic, Void} from '../../lib/ui';
import {blink, lerp, pop, rndIn} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * "Stock picking — any% speedrun." A world-record attempt at losing money:
 * seven splits, one skipped check, a personal best nobody wanted. Then the
 * category that actually matters: 100%, every check, on purpose.
 */

const CLOCK_RATE = 3.1; // run-clock seconds per real second
const SLAM = 300; // frame where the run "finishes"
const FINAL = 31.07;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const hh = Math.floor((s % 1) * 100);
  return `${m}:${String(sec).padStart(2, '0')}.${String(hh).padStart(2, '0')}`;
};

/** Gamer chrome: four corner brackets. */
const Brackets: React.FC<{at?: number}> = ({at = 0}) => {
  const frame = useCurrentFrame();
  const g = lerp(frame, [at, at + 16], [0, 1]);
  const arm = 74 * g;
  const corners: Array<['left' | 'right', 'top' | 'bottom', number, number]> = [
    ['left', 'top', 76, 150],
    ['right', 'top', 76, 150],
    ['left', 'bottom', 76, 150],
    ['right', 'bottom', 76, 150],
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: g}}>
      {corners.map(([h, v, x, y], i) => (
        <React.Fragment key={i}>
          <div style={{position: 'absolute', [h]: x, [v]: y, width: arm, height: 4, background: C.hairline2}} />
          <div style={{position: 'absolute', [h]: x, [v]: y, width: 4, height: arm, background: C.hairline2}} />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

/** SP1 — title card + countdown. */
export const SP1_Title: React.FC = () => {
  const frame = useCurrentFrame();
  const goIn = pop(frame, 118, 11, 0.7);
  return (
    <Void depth>
      <Brackets at={2} />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 560}}>
          <Kinetic text={'STOCK PICKING'} delay={6} size={96} />
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: F.mono,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: '0.22em',
            color: C.discovery,
            opacity: lerp(frame, [20, 34], [0, 1]),
            textShadow: '0 0 26px rgba(139,124,255,0.4)',
          }}
        >
          ANY% SPEEDRUN
        </div>
        <div style={{marginTop: 64, opacity: lerp(frame, [36, 50], [0, 1])}}>
          <Chip color={C.danger} border={`${C.danger}66`} bg={`${C.danger}0d`} size={25}>
            ● WORLD RECORD ATTEMPT
          </Chip>
        </div>
        <div style={{marginTop: 30, opacity: lerp(frame, [58, 72], [0, 1])}}>
          <Chip color={C.dim} border={C.hairline} size={22}>
            RULES: NO RESEARCH ALLOWED
          </Chip>
        </div>
        <div
          style={{
            marginTop: 110,
            fontFamily: F.mono,
            fontSize: 92,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: C.muted,
            opacity: lerp(frame, [70, 82], [0, 1]) * (blink(frame, 22) ? 1 : 0.45),
          }}
        >
          0:00.00
        </div>
        {/* countdown */}
        <div style={{position: 'absolute', top: 1520, display: 'flex', gap: 60}}>
          {['3', '2', '1'].map((n, i) => {
            const at = 78 + i * 14;
            const s = pop(frame, at, 12, 0.7);
            const op = lerp(frame, [at, at + 4], [0, 1]) * lerp(frame, [at + 12, at + 15], [1, 0.35]);
            return (
              <span
                key={n}
                style={{
                  fontFamily: F.mono,
                  fontSize: 66,
                  fontWeight: 700,
                  color: C.ink,
                  opacity: op,
                  transform: `scale(${0.7 + 0.3 * Math.min(s, 1)})`,
                }}
              >
                {n}
              </span>
            );
          })}
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 66,
              fontWeight: 700,
              color: C.fundamentals,
              opacity: lerp(frame, [118, 121], [0, 1]),
              transform: `scale(${0.7 + 0.5 * Math.min(goIn, 1)})`,
              textShadow: '0 0 30px rgba(95,191,122,0.5)',
            }}
          >
            GO
          </span>
        </div>
      </AbsoluteFill>
    </Void>
  );
};

type Split = {
  name: string;
  redact?: boolean;
  t?: string;
  diff?: string;
  at: number;
  skipped?: boolean;
  best?: boolean;
  bad?: boolean;
};

const SPLITS: Split[] = [
  {name: 'OPEN APP', t: '0:01.4', diff: '−0.2', at: 14},
  {name: 'SEE TRENDING', redact: true, t: '0:04.1', diff: '−0.8', at: 40},
  {name: 'READ HALF A TWEET', t: '0:07.9', diff: '−1.1', at: 76},
  {name: 'CHECK THE FILINGS', skipped: true, at: 108},
  {name: 'BUY THE TOP', t: '0:14.6', diff: '−2.3', at: 141, best: true},
  {name: 'AVERAGE DOWN', t: '0:21.3', diff: '+2.1', at: 206, bad: true},
  {name: 'PANIC SELL', t: '0:27.8', diff: '+4.5', at: 269, bad: true},
];

/** SP2 — the run. */
export const SP2_Run: React.FC = () => {
  const frame = useCurrentFrame();
  const clock = Math.min((frame / 30) * CLOCK_RATE, FINAL);
  const slammed = frame >= SLAM;
  const punch = pop(frame, SLAM, 11, 0.8);
  const shakeAmp = slammed ? lerp(frame, [SLAM, SLAM + 22], [7, 0]) : 0;
  const jx = rndIn(`sx${frame}`, -1, 1) * shakeAmp;
  const jy = rndIn(`sy${frame}`, -1, 1) * shakeAmp * 0.7;
  const stampIn = pop(frame, SLAM + 6, 12, 0.85);
  const rektIn = pop(frame, SLAM + 18, 12, 0.8);
  return (
    <Void depth>
      <AbsoluteFill style={{transform: `translate(${jx}px, ${jy}px)`}}>
        {/* the clock */}
        <AbsoluteFill style={{alignItems: 'center'}}>
          <div
            style={{
              marginTop: 250,
              fontFamily: F.mono,
              fontSize: 108,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              color: slammed ? C.danger : C.ink,
              transform: slammed ? `scale(${1 + (1 - Math.min(punch, 1)) * 0.35})` : undefined,
              textShadow: slammed ? '0 0 44px rgba(229,83,75,0.45)' : '0 0 30px rgba(231,234,238,0.15)',
            }}
          >
            {fmt(clock)}
          </div>
          <div style={{marginTop: 22, opacity: lerp(frame, [6, 18], [0, 1])}}>
            {frame < SPLITS[3].at ? (
              <Chip color={C.fundamentals} border={`${C.fundamentals}55`} size={21}>
                ▲ PB PACE
              </Chip>
            ) : !slammed ? (
              <Chip color={C.muted} border={C.hairline} size={21}>
                PACE: WHO CARES
              </Chip>
            ) : (
              <Chip color={C.danger} border={`${C.danger}66`} bg={`${C.danger}0d`} size={21}>
                RUN COMPLETE
              </Chip>
            )}
          </div>
        </AbsoluteFill>

        {/* splits */}
        <div style={{position: 'absolute', left: 90, top: 560, width: 900}}>
          {SPLITS.map((sp, i) => {
            const s = pop(frame, sp.at, 13, 0.85);
            const op = lerp(frame, [sp.at, sp.at + 7], [0, 1]);
            const flash = sp.best ? lerp(frame, [sp.at + 4, sp.at + 26], [0.22, 0]) : 0;
            const skShake = sp.skipped ? lerp(frame, [sp.at, sp.at + 10], [5, 0]) : 0;
            const sx = rndIn(`sk${i}${frame}`, -1, 1) * skShake;
            return (
              <div
                key={sp.name}
                style={{
                  position: 'relative',
                  height: 84,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '0 28px',
                  borderRadius: 12,
                  background: sp.skipped ? 'rgba(229,83,75,0.05)' : C.panel,
                  border: `1.5px solid ${sp.skipped ? 'rgba(229,83,75,0.35)' : C.hairline}`,
                  boxShadow: flash > 0 ? `inset 0 0 60px rgba(95,191,122,${flash})` : '0 12px 30px rgba(0,0,0,0.3)',
                  opacity: op,
                  transform: `translate(${sx}px, ${(1 - s) * 26}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 26,
                    fontWeight: 700,
                    color: sp.skipped ? C.danger : C.fundamentals,
                    width: 34,
                  }}
                >
                  {sp.skipped ? '✕' : '✓'}
                </span>
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 27,
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    color: sp.skipped ? C.dim : C.ink,
                    textDecoration: sp.skipped ? 'line-through' : undefined,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sp.name}
                </span>
                {sp.redact && <Redact cash scale={0.78} />}
                {sp.best && (
                  <Chip
                    size={19}
                    color={C.fundamentals}
                    border={`${C.fundamentals}66`}
                    bg={`${C.fundamentals}0d`}
                    style={{opacity: lerp(frame, [sp.at + 8, sp.at + 16], [0, 1])}}
                  >
                    BEST SEGMENT
                  </Chip>
                )}
                {sp.skipped && (
                  <Chip size={19} color={C.danger} border={`${C.danger}55`}>
                    SKIPPED
                  </Chip>
                )}
                <div style={{flex: 1}} />
                {sp.t && (
                  <span style={{fontFamily: F.mono, fontSize: 27, color: C.muted, fontVariantNumeric: 'tabular-nums'}}>
                    {sp.t}
                  </span>
                )}
                {sp.diff && (
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 24,
                      fontWeight: 700,
                      color: sp.bad ? C.danger : C.fundamentals,
                      fontVariantNumeric: 'tabular-nums',
                      width: 90,
                      textAlign: 'right',
                    }}
                  >
                    {sp.diff}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* the "achievement" */}
        {slammed && (
          <AbsoluteFill style={{alignItems: 'center', pointerEvents: 'none'}}>
            <div
              style={{
                position: 'absolute',
                top: 1330,
                padding: '26px 44px',
                border: `4px double ${C.ink}`,
                borderRadius: 10,
                fontFamily: F.display,
                fontSize: 62,
                fontWeight: 700,
                color: C.ink,
                letterSpacing: '0.02em',
                transform: `rotate(-3.5deg) scale(${0.8 + 0.2 * Math.min(stampIn, 1)})`,
                opacity: Math.min(stampIn * 1.4, 1),
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                background: 'rgba(10,13,18,0.75)',
              }}
            >
              NEW PERSONAL BEST
            </div>
            <div
              style={{
                position: 'absolute',
                top: 1500,
                fontFamily: F.mono,
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: C.danger,
                opacity: Math.min(rektIn * 1.4, 1),
                transform: `scale(${0.8 + 0.2 * Math.min(rektIn, 1)})`,
                textShadow: '0 0 30px rgba(229,83,75,0.45)',
              }}
            >
              PORTFOLIO: REKT
            </div>
          </AbsoluteFill>
        )}

        {/* sarcastic confetti */}
        {slammed && (
          <Trail layers={2} lagInFrames={2} trailOpacity={0.25}>
            <AbsoluteFill style={{pointerEvents: 'none'}}>
              {Array.from({length: 24}, (_, i) => {
                const t = frame - (SLAM + 6) - rndIn(`cd${i}`, 0, 8);
                if (t < 0) return null;
                const x0 = rndIn(`cx${i}`, 60, 1020);
                const drift = noise2D(`cw${i}`, t * 0.04, 0) * 90;
                const y = -40 + t * (14 + rndIn(`cv${i}`, 0, 8));
                if (y > 1960) return null;
                const colors = [C.discovery, C.consensus, C.fundamentals, C.macro];
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: x0 + drift,
                      top: y,
                      width: 16,
                      height: 9,
                      borderRadius: 2,
                      background: colors[i % 4],
                      opacity: 0.85,
                      transform: `rotate(${t * (10 + i)}deg)`,
                    }}
                  />
                );
              })}
            </AbsoluteFill>
          </Trail>
        )}
      </AbsoluteFill>
    </Void>
  );
};

/** SP3 — the deadpan. */
export const SP3_Line: React.FC = () => (
  <Void>
    <Center>
      <Kinetic text={'Impressive time.'} delay={8} size={68} />
      <div style={{marginTop: 44}}>
        <Kinetic text={'Research isn’t a race.'} delay={48} size={64} accents={{3: C.discovery}} />
      </div>
    </Center>
  </Void>
);

/** SP4 — the 100% category. */
export const SP4_Desk: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 240, opacity: lerp(frame, [8, 20], [0, 1])}}>
          <Chip color={C.discovery} border={'rgba(139,124,255,0.5)'} bg={'rgba(139,124,255,0.07)'} size={24}>
            CATEGORY: 100% · EVERY CHECK
          </Chip>
        </div>
        <div style={{marginTop: 56}}>
          <Kinetic text={'Now the real run.'} delay={22} size={66} />
        </div>
      </AbsoluteFill>
      <DeskStamps
        at={48}
        stag={16}
        verdictAt={118}
        foot="13 MINUTES · EVERY CHECK · ON PURPOSE"
        footAt={148}
        top={620}
      />
    </Void>
  );
};

/** SP5 — endcard. */
export const SP5_End: React.FC = () => <FunEndcard gag="SPEEDRUNS ARE FOR GAMES" />;
