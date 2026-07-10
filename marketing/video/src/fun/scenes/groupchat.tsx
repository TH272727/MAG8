import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Kinetic, Void} from '../../lib/ui';
import {lerp, pop, rndIn} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * "The group chat found a stock" — eleven escalating messages, a hard cut
 * to silence, and the quiet counter-offer: three sealed lenses.
 */

type Msg = {
  text?: string;
  ticker?: boolean; // render the redacted ticker + rockets
  pre?: string; // lead-in text inside the ticker bubble
  side: 'L' | 'R';
  at: number;
  who: number; // avatar tint index for L side
  react?: string; // emoji reaction that pops later
};

const MSGS: Msg[] = [
  {text: 'missed $NVDA. missed $TSLA 😭', side: 'L', at: 12, who: 0},
  {text: 'NOT missing the next one.', side: 'L', at: 30, who: 1},
  {ticker: true, pre: 'found it:', side: 'R', at: 54, who: 0},
  {text: 'my uber driver owns it', side: 'L', at: 78, who: 2, react: '🔥'},
  {text: 'so it’s definitely going up', side: 'L', at: 100, who: 0},
  {text: 'chart looks bullish i think', side: 'R', at: 122, who: 0},
  {text: 'ALL IN?', side: 'L', at: 142, who: 1},
  {text: 'ALL IN.', side: 'R', at: 156, who: 0, react: '💎'},
  {text: '🚀🚀🚀🚀🚀🚀', side: 'L', at: 168, who: 2},
  {text: 'wait what do they even do', side: 'L', at: 188, who: 1},
  {text: 'DOESN’T MATTER', side: 'R', at: 204, who: 0, react: '😂'},
];

const AVATARS = ['#2a3040', '#33283f', '#23343a'];
const PITCH = 104;
const STACK_TOP = 372;

const TypingDots: React.FC<{opacity: number}> = ({opacity}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 9,
        padding: '24px 28px',
        borderRadius: 22,
        background: C.panel,
        border: `1.5px solid ${C.hairline}`,
        opacity,
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 11,
            height: 11,
            borderRadius: 99,
            background: C.muted,
            opacity: 0.35 + 0.65 * Math.abs(Math.sin(frame / 5 + i * 1.05)),
          }}
        />
      ))}
    </div>
  );
};

/** G1 — the meltdown. */
export const G1_Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const creep = lerp(frame, [0, 246], [1, 1.035]);
  const shakeAmp = lerp(frame, [196, 240], [0, 5]);
  const jx = rndIn(`gx${frame}`, -1, 1) * shakeAmp;
  const jy = rndIn(`gy${frame}`, -1, 1) * shakeAmp * 0.7;
  return (
    <Void depth>
      <AbsoluteFill style={{transform: `translate(${jx}px, ${jy}px) scale(${creep})`}}>
        {/* chat header */}
        <div
          style={{
            position: 'absolute',
            left: 70,
            top: 230,
            width: 940,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            paddingBottom: 24,
            borderBottom: `1.5px solid ${C.hairline}`,
            opacity: lerp(frame, [2, 14], [0, 1]),
          }}
        >
          <div style={{display: 'flex'}}>
            {AVATARS.map((a, i) => (
              <div
                key={i}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 99,
                  background: a,
                  border: `2px solid ${C.void}`,
                  marginLeft: i === 0 ? 0 : -14,
                }}
              />
            ))}
          </div>
          <span style={{fontFamily: F.body, fontSize: 38, fontWeight: 700, color: C.ink}}>
            the boys 📈
          </span>
          <div style={{flex: 1}} />
          <span style={{fontFamily: F.mono, fontSize: 24, letterSpacing: '0.1em', color: C.muted}}>
            8 ONLINE
          </span>
        </div>

        {/* messages */}
        {MSGS.map((m, i) => {
          const s = pop(frame, m.at, 12, 0.8);
          const op = lerp(frame, [m.at, m.at + 6], [0, 1]);
          const typingOp =
            lerp(frame, [m.at - 24, m.at - 20], [0, 1]) * lerp(frame, [m.at - 4, m.at], [1, 0]);
          const y = STACK_TOP + i * PITCH;
          const isR = m.side === 'R';
          const reactIn = m.react ? pop(frame, m.at + 16, 11, 0.7) : 0;
          return (
            <div key={i} style={{position: 'absolute', top: y, left: 70, width: 940}}>
              {typingOp > 0.01 && !isR && (
                <div style={{position: 'absolute', left: 62, top: 0}}>
                  <TypingDots opacity={typingOp} />
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  left: isR ? undefined : 62,
                  right: isR ? 0 : undefined,
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 14,
                  opacity: op,
                  transform: `translateY(${(1 - s) * 26}px) scale(${0.7 + 0.3 * s})`,
                  transformOrigin: isR ? 'bottom right' : 'bottom left',
                }}
              >
                {!isR && (
                  <div
                    style={{
                      position: 'absolute',
                      left: -62,
                      bottom: 4,
                      width: 44,
                      height: 44,
                      borderRadius: 99,
                      background: AVATARS[m.who],
                      border: `1.5px solid ${C.hairline}`,
                    }}
                  />
                )}
                <div
                  style={{
                    position: 'relative',
                    maxWidth: 750,
                    padding: '22px 30px',
                    borderRadius: 24,
                    borderBottomLeftRadius: isR ? 24 : 8,
                    borderBottomRightRadius: isR ? 8 : 24,
                    background: isR ? 'rgba(139,124,255,0.14)' : C.panel,
                    border: `1.5px solid ${isR ? 'rgba(139,124,255,0.35)' : C.hairline}`,
                    boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
                  }}
                >
                  {m.ticker ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                      {m.pre && (
                        <span
                          style={{
                            fontFamily: F.body,
                            fontSize: 39,
                            fontWeight: 600,
                            color: C.ink,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.pre}
                        </span>
                      )}
                      <Redact cash scale={1.05} />
                      <span style={{fontFamily: F.body, fontSize: 39}}>🚀🚀🚀</span>
                    </div>
                  ) : (
                    <span
                      style={{
                        fontFamily: F.body,
                        fontSize: 39,
                        fontWeight: 600,
                        color: C.ink,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.text}
                    </span>
                  )}
                  {m.react && reactIn > 0.01 && (
                    <div
                      style={{
                        position: 'absolute',
                        right: -16,
                        top: -22,
                        fontSize: 36,
                        transform: `scale(${reactIn})`,
                        filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
                      }}
                    >
                      {m.react}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </Void>
  );
};

/** G2 — the cut. Eight opinions, zero methods. */
export const G2_Cut: React.FC = () => (
  <Void>
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <Kinetic text={'Your group chat\nhas eight opinions.'} delay={10} size={68} />
    </AbsoluteFill>
  </Void>
);

/** G3 — the thesis. */
export const G3_Line: React.FC = () => (
  <Void>
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <Kinetic
        text={'Enthusiasm isn’t evidence.'}
        delay={8}
        size={66}
        accents={{2: C.discovery}}
        maxWidth={940}
      />
    </AbsoluteFill>
  </Void>
);

/** G4 — the counter-offer. */
export const G4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'Three lenses.\nZero group chats.'} delay={8} size={68} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={60}
      stag={20}
      verdictAt={146}
      foot="INDEPENDENT · BLIND TO EACH OTHER · GATES FIRST"
      footAt={182}
      top={660}
    />
  </Void>
);

/** G5 — endcard. */
export const G5_End: React.FC = () => <FunEndcard gag="GROUP CHATS ARE FOR MEMES" />;
