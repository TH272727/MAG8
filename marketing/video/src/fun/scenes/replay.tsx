import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Trail} from '@remotion/motion-blur';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {Chip, Kinetic, Void} from '../../lib/ui';
import {blink, lerp, pop, pulse01, rndIn, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * "Friday night stocks" — live play-by-play of a guy buying the exact top,
 * then the instant replay with the telestrator. The pros study tape first.
 */

const RISE_D = 'M -40 1390 C 200 1330, 380 1290, 520 1190 C 620 1115, 700 990, 760 900';
const CRASH_D = 'M 760 900 C 800 980, 860 1180, 920 1290 C 980 1400, 1080 1440, 1160 1460';
const RISE_LEN = getLength(RISE_D);
const APEX = {x: 760, y: 900};

const ptAt = (p: number) => getPointAtLength(RISE_D, Math.max(0, Math.min(1, p)) * RISE_LEN);

/** Top-left LIVE bug (or the replay variant). */
const LiveBug: React.FC<{replay?: boolean}> = ({replay}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        top: 178,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: lerp(frame, [4, 14], [0, 1]),
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 99,
          background: replay ? C.consensus : C.danger,
          opacity: replay ? 1 : blink(frame, 24) ? 1 : 0.35,
          boxShadow: `0 0 14px ${replay ? C.consensus : C.danger}`,
        }}
      />
      <span style={{fontFamily: F.mono, fontSize: 26, fontWeight: 700, letterSpacing: '0.18em', color: C.ink}}>
        {replay ? 'REPLAY' : 'LIVE'}
      </span>
      {replay && (
        <Chip size={20} color={C.consensus} border={`${C.consensus}55`} style={{marginLeft: 8}}>
          0.25×
        </Chip>
      )}
    </div>
  );
};

/** Top-center scorebug. */
const ScoreBug: React.FC<{market: number; flipAt?: number}> = ({market, flipAt}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, 8, 13, 0.9);
  const flip = flipAt === undefined ? 0 : pop(frame, flipAt, 11, 0.7);
  const shown = flipAt !== undefined && frame >= flipAt ? market + 1 : market;
  return (
    <AbsoluteFill style={{alignItems: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          marginTop: 158,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '18px 34px',
          borderRadius: 14,
          background: C.panel,
          border: `1.5px solid ${C.hairline2}`,
          boxShadow: '0 16px 44px rgba(0,0,0,0.45)',
          opacity: lerp(frame, [8, 18], [0, 1]),
          transform: `translateY(${(1 - s) * -26}px)`,
        }}
      >
        <span style={{fontFamily: F.mono, fontSize: 22, letterSpacing: '0.16em', color: C.dim}}>
          FRIDAY NIGHT STOCKS
        </span>
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 30,
            fontWeight: 700,
            color: C.ink,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          RETAIL 0 —{' '}
          <span
            style={{
              display: 'inline-block',
              color: shown > market ? C.danger : C.ink,
              transform: flipAt !== undefined && frame >= flipAt ? `scale(${1 + (1 - Math.min(flip, 1)) * 0.5})` : undefined,
            }}
          >
            MARKET {shown}
          </span>
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** Broadcast lower-third: one commentator line at a time. */
const LowerThird: React.FC<{
  at: number;
  out: number;
  tag: 'PLAY-BY-PLAY' | 'COLOR';
  children: React.ReactNode;
}> = ({at, out, tag, children}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, 13, 0.9);
  const op = lerp(frame, [at, at + 7], [0, 1]) * lerp(frame, [out, out + 8], [1, 0]);
  if (op <= 0.01) return null;
  const color = tag === 'PLAY-BY-PLAY' ? C.discovery : C.macro;
  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        bottom: 300,
        width: 940,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '24px 30px',
        borderRadius: 14,
        background: 'rgba(18,22,31,0.92)',
        border: `1.5px solid ${C.hairline2}`,
        borderLeft: `6px solid ${color}`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        opacity: op,
        transform: `translateY(${(1 - s) * 40}px)`,
      }}
    >
      <Chip size={19} color={color} border={`${color}55`} bg={`${color}0d`}>
        {tag}
      </Chip>
      <span
        style={{
          fontFamily: F.body,
          fontSize: 34,
          fontWeight: 600,
          color: C.ink,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </div>
  );
};

/** The field: grid baseline + the price line SVG. */
const Field: React.FC<{
  riseP: number;
  crashP?: number;
  dim?: boolean;
}> = ({riseP, crashP = 0, dim}) => {
  const rise = evolvePath(riseP, RISE_D);
  const crash = evolvePath(crashP, CRASH_D);
  return (
    <svg
      viewBox="0 0 1080 1920"
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    >
      <line x1={0} y1={1460} x2={1080} y2={1460} stroke={C.hairline} strokeWidth={1.5} />
      <path
        d={RISE_D}
        fill="none"
        stroke={dim ? 'rgba(95,191,122,0.45)' : C.fundamentals}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={rise.strokeDasharray}
        strokeDashoffset={rise.strokeDashoffset}
        style={{filter: dim ? undefined : 'drop-shadow(0 0 12px rgba(95,191,122,0.35))'}}
      />
      {crashP > 0 && (
        <path
          d={CRASH_D}
          fill="none"
          stroke={dim ? 'rgba(229,83,75,0.5)' : C.danger}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={crash.strokeDasharray}
          strokeDashoffset={crash.strokeDashoffset}
          style={{filter: dim ? undefined : 'drop-shadow(0 0 12px rgba(229,83,75,0.35))'}}
        />
      )}
    </svg>
  );
};

/** The retail player. */
const PlayerDot: React.FC<{x: number; y: number; rot?: number}> = ({x, y, rot = 0}) => (
  <div
    style={{
      position: 'absolute',
      left: x - 26,
      top: y - 26,
      width: 52,
      height: 52,
      borderRadius: 999,
      background: 'radial-gradient(circle at 34% 30%, #3a4152, #12161f 70%)',
      border: `2px solid ${C.hairline2}`,
      boxShadow: '0 12px 30px rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `rotate(${rot}deg)`,
    }}
  >
    <span style={{fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: C.muted}}>R</span>
  </div>
);

/** RP1 — warm-ups (there are none). */
export const RP1_Live: React.FC = () => {
  const frame = useCurrentFrame();
  const lineP = lerp(frame, [14, 92], [0, 0.5], smooth);
  const dotP = lerp(frame, [40, 138], [0.05, 0.17], smooth);
  const pt = ptAt(dotP);
  return (
    <Void depth>
      <Field riseP={Math.max(lineP, dotP + 0.04)} />
      <PlayerDot x={pt.x} y={pt.y} />
      <LiveBug />
      <ScoreBug market={3} />
      <LowerThird at={36} out={84} tag="PLAY-BY-PLAY">
        Here he comes — no warm-up, no tape review.
      </LowerThird>
      <LowerThird at={90} out={132} tag="COLOR">
        You hate to see it.
      </LowerThird>
    </Void>
  );
};

/** RP2 — the play: all in at the exact top. */
export const RP2_Play: React.FC = () => {
  const frame = useCurrentFrame();
  const dotP = lerp(frame, [6, 128], [0.17, 1], smooth);
  const lineP = Math.min(1, dotP + 0.05);
  const crashP = lerp(frame, [134, 186], [0, 1], smooth);
  // after the apex the player detaches and tumbles down the slope
  const fall = Math.max(0, frame - 132);
  const pt = fall > 0 ? APEX : ptAt(dotP);
  const fx = APEX.x + fall * 3.4;
  const fy = APEX.y + fall * fall * 0.55;
  const buyIn = pop(frame, 126, 12, 0.8);
  const buzz = pulse01((frame - 196) / 16);
  const shakeAmp = frame > 132 && frame < 200 ? 4 : 0;
  const jx = rndIn(`rx${frame}`, -1, 1) * shakeAmp;
  const jy = rndIn(`ry${frame}`, -1, 1) * shakeAmp * 0.7;
  return (
    <Void depth>
      <AbsoluteFill style={{transform: `translate(${jx}px, ${jy}px)`}}>
        <Field riseP={lineP} crashP={crashP} />
        <Trail layers={3} lagInFrames={2} trailOpacity={0.35}>
          <AbsoluteFill>
            {fall > 0 ? (
              fy < 1960 && <PlayerDot x={fx} y={fy} rot={Math.min(fall * 9, 540)} />
            ) : (
              <PlayerDot x={pt.x} y={pt.y} />
            )}
          </AbsoluteFill>
        </Trail>
        {/* the BUY flag, planted at the apex */}
        {frame >= 126 && (
          <div
            style={{
              position: 'absolute',
              left: APEX.x - 6,
              top: APEX.y - 148,
              opacity: Math.min(buyIn * 1.4, 1),
              transform: `scale(${0.7 + 0.3 * Math.min(buyIn, 1)})`,
              transformOrigin: 'bottom left',
            }}
          >
            <div style={{width: 4, height: 120, background: C.ink, borderRadius: 2}} />
            <div
              style={{
                position: 'absolute',
                left: 4,
                top: 0,
                padding: '10px 20px',
                background: C.danger,
                borderRadius: '0 10px 10px 0',
                fontFamily: F.mono,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#fff',
              }}
            >
              BUY
            </div>
          </div>
        )}
      </AbsoluteFill>
      <LiveBug />
      <ScoreBug market={3} flipAt={202} />
      <LowerThird at={8} out={48} tag="PLAY-BY-PLAY">
        He’s going all in on <Redact cash scale={0.82} /> —
      </LowerThird>
      <LowerThird at={52} out={90} tag="PLAY-BY-PLAY">
        AT THE OPEN. NO STOP-LOSS.
      </LowerThird>
      <LowerThird at={94} out={142} tag="COLOR">
        Bold. Very bold.
      </LowerThird>
      <LowerThird at={150} out={214} tag="PLAY-BY-PLAY">
        …and there’s the top.
      </LowerThird>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(229,83,75,${buzz * 0.28}) 100%)`,
          pointerEvents: 'none',
        }}
      />
    </Void>
  );
};

/** Telestrator marks: hand-drawn circle around the buy + arrow down the slope. */
const CIRCLE_D = 'M 640 900 a 120 120 0 1 0 240 0 a 120 120 0 1 0 -240 0';
const ARROW_D = 'M 850 1010 C 890 1080, 910 1150, 940 1230';

/** RP3 — the instant replay. */
export const RP3_Replay: React.FC = () => {
  const frame = useCurrentFrame();
  const bannerX = lerp(frame, [0, 30], [-1300, 1740], smooth);
  const zoom = lerp(frame, [10, 40], [1, 1.5], smooth);
  const dotP = lerp(frame, [36, 138], [0.72, 1], smooth);
  const pt = ptAt(dotP);
  const circle = evolvePath(lerp(frame, [66, 96], [0, 1]), CIRCLE_D);
  const arrow = evolvePath(lerp(frame, [102, 128], [0, 1]), ARROW_D);
  const headOp = lerp(frame, [126, 134], [0, 1]);
  return (
    <Void depth>
      <AbsoluteFill style={{transform: `scale(${zoom})`, transformOrigin: '760px 1000px'}}>
        <Field riseP={1} crashP={1} dim />
        <PlayerDot x={pt.x} y={pt.y} />
        {/* telestrator */}
        <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
          <path
            d={CIRCLE_D}
            fill="none"
            stroke={C.consensus}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circle.strokeDasharray}
            strokeDashoffset={circle.strokeDashoffset}
            style={{filter: 'drop-shadow(0 0 10px rgba(63,209,201,0.45))'}}
            transform="rotate(-8 760 900)"
          />
          <path
            d={ARROW_D}
            fill="none"
            stroke={C.consensus}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={arrow.strokeDasharray}
            strokeDashoffset={arrow.strokeDashoffset}
          />
          <g opacity={headOp}>
            <line x1={940} y1={1230} x2={904} y2={1216} stroke={C.consensus} strokeWidth={6} strokeLinecap="round" />
            <line x1={940} y1={1230} x2={946} y2={1194} stroke={C.consensus} strokeWidth={6} strokeLinecap="round" />
          </g>
        </svg>
      </AbsoluteFill>

      {/* scanlines — the replay look */}
      <AbsoluteFill
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(231,234,238,0.03) 0 2px, transparent 2px 7px)',
          pointerEvents: 'none',
          opacity: lerp(frame, [12, 30], [0, 1]),
        }}
      />
      <LiveBug replay />
      <LowerThird at={36} out={126} tag="COLOR">
        Watch. Right… there.
      </LowerThird>
      <LowerThird at={132} out={168} tag="PLAY-BY-PLAY">
        The exact top. Textbook.
      </LowerThird>
      <LowerThird at={172} out={210} tag="COLOR">
        Frame it.
      </LowerThird>

      {/* the wipe banner on top of everything */}
      <div
        style={{
          position: 'absolute',
          top: 830,
          left: bannerX - 540,
          width: 1080,
          padding: '30px 0',
          background: `repeating-linear-gradient(-45deg, rgba(63,209,201,0.16) 0 26px, rgba(63,209,201,0.05) 26px 52px), ${C.panel}`,
          borderTop: `2px solid ${C.consensus}`,
          borderBottom: `2px solid ${C.consensus}`,
          textAlign: 'center',
          fontFamily: F.display,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: C.ink,
          boxShadow: '0 24px 70px rgba(0,0,0,0.5)',
        }}
      >
        INSTANT REPLAY
      </div>
    </Void>
  );
};

/** RP4 — the turn. */
export const RP4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 280}}>
        <Kinetic
          text={'The pros study the tape\nbefore they play.'}
          delay={8}
          size={62}
          accents={{4: C.discovery}}
        />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={46}
      stag={16}
      verdictAt={118}
      foot="EVERY VERDICT KEEPS ITS RECEIPTS"
      footAt={148}
      top={620}
    />
  </Void>
);

/** RP5 — endcard. */
export const RP5_End: React.FC = () => <FunEndcard gag="WATCH THE TAPE FIRST" />;
