import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Center, Kinetic, Void} from '../../lib/ui';
import {TrashCan} from '../../lib/setpieces';
import {easeIn, lerp, pop, pulse01, settle} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * "Not a magic 8-ball" — shake the toy, get toy answers, trash the toy,
 * meet the desk. The pun is the point: MAG8 ≠ magic 8-ball.
 */

const BALL_X = 540;
const BALL_Y = 1150;

/** The toy. Window shows the die ("8") or a floating answer. */
const Ball: React.FC<{
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  answer?: string;
  answerOp?: number;
  opacity?: number;
}> = ({x, y, scale = 1, rot = 0, answer, answerOp = 0, opacity = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
      opacity,
    }}
  >
    <div
      style={{
        width: 520,
        height: 520,
        borderRadius: 999,
        background: 'radial-gradient(circle at 36% 28%, #313747 0%, #10141d 45%, #05070b 78%)',
        border: `2px solid ${C.hairline}`,
        boxShadow: '0 40px 120px rgba(0,0,0,0.6), inset 0 2px 12px rgba(255,255,255,0.05)',
        position: 'relative',
      }}
    >
      {/* gloss */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 62,
          width: 150,
          height: 84,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.07)',
          transform: 'rotate(-28deg)',
          filter: 'blur(2px)',
        }}
      />
      {/* the window */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '54%',
          transform: 'translate(-50%, -50%)',
          width: 244,
          height: 244,
          borderRadius: 999,
          background: '#070b14',
          border: `2px solid ${C.hairline2}`,
          boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            fontFamily: F.display,
            fontSize: 110,
            fontWeight: 700,
            color: C.ink,
            opacity: 1 - answerOp,
          }}
        >
          8
        </span>
        {answer && (
          <span
            style={{
              position: 'absolute',
              fontFamily: F.mono,
              fontSize: 31,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textAlign: 'center',
              lineHeight: 1.45,
              color: '#8fa8ff',
              whiteSpace: 'pre',
              opacity: answerOp,
              transform: `translateY(${(1 - answerOp) * 14}px)`,
              textShadow: '0 0 18px rgba(143,168,255,0.45)',
            }}
          >
            {answer}
          </span>
        )}
      </div>
    </div>
  </div>
);

/** The hook cycle: two famous tickers, then the anonymous "next one". */
const SWAPS = [10, 42, 72];
const NAMES = ['$NVDA', '$TSLA'];

/**
 * The question chip that haunts the whole bit. With `cycle` (E1) it swaps
 * real mega-cap tickers before settling on the redacted candidate — the
 * first second must read "stocks", not "generic question".
 */
const AskChip: React.FC<{at: number; dimAfter?: number; cycle?: boolean}> = ({
  at,
  dimAfter,
  cycle,
}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, 13, 0.9);
  const dim = dimAfter === undefined ? 1 : lerp(frame, [dimAfter, dimAfter + 16], [1, 0.55]);
  const slot = (key: string, inAt: number, outAt: number | undefined, child: React.ReactNode) => {
    const sp = pop(frame, inAt, 12, 0.8);
    const op =
      lerp(frame, [inAt, inAt + 5], [0, 1]) *
      (outAt === undefined ? 1 : lerp(frame, [outAt - 2, outAt + 2], [1, 0]));
    if (op <= 0.01) return null;
    return (
      <div
        key={key}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: op,
          transform: `translateY(${(1 - sp) * 16}px)`,
        }}
      >
        {child}
      </div>
    );
  };
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div
        style={{
          marginTop: 400,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          background: C.panel,
          border: `1.5px solid ${C.hairline2}`,
          borderRadius: 999,
          padding: '30px 44px',
          opacity: Math.min(s * 1.4, 1) * dim,
          transform: `translateY(${(1 - s) * 30}px)`,
          boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
        }}
      >
        <span style={{fontFamily: F.body, fontSize: 45, fontWeight: 600, color: C.ink}}>
          should I buy
        </span>
        <div style={{position: 'relative', width: 195, height: 48}}>
          {cycle ? (
            <>
              {NAMES.map((n, i) =>
                slot(
                  n,
                  SWAPS[i],
                  SWAPS[i + 1],
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 47,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: C.discovery,
                      textShadow: '0 0 22px rgba(139,124,255,0.45)',
                    }}
                  >
                    {n}
                  </span>,
                ),
              )}
              {slot('redact', SWAPS[2], undefined, <Redact cash scale={1.2} />)}
            </>
          ) : (
            slot('static', -99, undefined, <Redact cash scale={1.2} />)
          )}
        </div>
        <span style={{fontFamily: F.body, fontSize: 45, fontWeight: 600, color: C.ink}}>?</span>
      </div>
    </AbsoluteFill>
  );
};

/** E1 — the question, and the traditional research instrument arrives. */
export const E1_Ask: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = settle(frame, 36);
  const wob = Math.sin(frame / 24) * 2;
  return (
    <Void depth>
      <AskChip at={10} cycle />
      <Ball x={BALL_X} y={-360 + drop * (BALL_Y + 360)} rot={wob} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 220,
            fontFamily: F.mono,
            fontSize: 25,
            letterSpacing: '0.14em',
            color: C.dim,
            opacity: lerp(frame, [96, 110], [0, 1]),
          }}
        >
          STOCK PICKING · THE TRADITIONAL METHOD
        </div>
      </AbsoluteFill>
    </Void>
  );
};

const ANSWERS = ['REPLY\nHAZY', 'ASK AGAIN\nLATER', 'SIGNS POINT\nTO YES 🚀'];
const CYCLES = [14, 82, 150];

/** E2 — three shakes, three non-answers. */
export const E2_Shake: React.FC = () => {
  const frame = useCurrentFrame();
  let answer: string | undefined;
  let answerOp = 0;
  let shake = 0;
  CYCLES.forEach((s, i) => {
    const sh = pulse01((frame - s) / 18);
    shake = Math.max(shake, sh);
    const inOp = lerp(frame, [s + 24, s + 34], [0, 1]);
    const outOp = i < 2 ? lerp(frame, [s + 58, s + 66], [1, 0]) : 1;
    const op = inOp * outOp;
    if (op > answerOp) {
      answerOp = op;
      answer = ANSWERS[i];
    }
  });
  const jx = Math.sin(frame * 3.2) * shake * 26;
  const rot = Math.sin(frame / 24) * 2 + Math.sin(frame * 2.7) * shake * 7;
  return (
    <Void depth>
      <AskChip at={-99} dimAfter={4} />
      <Ball x={BALL_X + jx} y={BALL_Y} rot={rot} answer={answer} answerOp={answerOp} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 220,
            fontFamily: F.mono,
            fontSize: 27,
            letterSpacing: '0.14em',
            color: C.dim,
            opacity: lerp(frame, [200, 212], [0, 1]),
          }}
        >
          HELPFUL.
        </div>
      </AbsoluteFill>
    </Void>
  );
};

/** E3 — the toy goes where toys go. */
export const E3_Toys: React.FC = () => {
  const frame = useCurrentFrame();
  const canUp = settle(frame, 8);
  const canDrop = lerp(frame, [88, 106], [0, 1], easeIn);
  const canY = 1990 - canUp * 470 + canDrop * 520;

  const roll = lerp(frame, [20, 54], [0, 1], easeIn);
  const fall = Math.max(0, (roll - 0.55) / 0.45);
  const bx = BALL_X + (760 - BALL_X) * roll;
  const by = BALL_Y + fall * fall * 460;
  return (
    <Void depth>
      {roll < 1 && (
        <Ball
          x={bx}
          y={by}
          rot={roll * 340}
          scale={1 - roll * 0.62}
          opacity={1 - Math.pow(roll, 7)}
        />
      )}
      <TrashCan x={760} y={canY} />
      <Center>
        <div style={{marginBottom: 620}}>
          <Kinetic text={'Stop asking toys.'} delay={70} size={72} />
        </div>
      </Center>
    </Void>
  );
};

/** E4 — what asks instead: three sealed methods, one verdict. */
export const E4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic
          text={'MAG8 is not\na magic 8-ball.'}
          delay={8}
          size={70}
          accents={{2: C.discovery}}
        />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={54}
      stag={20}
      verdictAt={140}
      foot="THREE INDEPENDENT METHODS · ONE VERDICT"
      footAt={176}
      top={660}
    />
  </Void>
);

/** E5 — endcard. */
export const E5_End: React.FC = () => <FunEndcard gag="NO HAZY ANSWERS" />;
