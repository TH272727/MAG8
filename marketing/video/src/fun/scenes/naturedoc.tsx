import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Trail} from '@remotion/motion-blur';
import {noise2D} from '@remotion/noise';
import {Eyebrow, Grain, Kinetic, Void} from '../../lib/ui';
import {easeIn, lerp, pulse01, rndIn, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * "A stock picker's nature documentary" — the calm narrator watches the
 * retail investor spot a trending ticker, join the herd, and follow it
 * straight off the cliff. Then the instrument answers: herds aren't research.
 */

const GROUND_Y = 1210;

/** Documentary subtitle — italic, centered, gentle fade in/out. */
const Caption: React.FC<{
  at: number;
  out?: number;
  size?: number;
  children: React.ReactNode;
}> = ({at, out, size = 40, children}) => {
  const frame = useCurrentFrame();
  const op =
    lerp(frame, [at, at + 14], [0, 1]) *
    (out === undefined ? 1 : lerp(frame, [out, out + 12], [1, 0]));
  if (op <= 0.01) return null;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', pointerEvents: 'none'}}>
      <div
        style={{
          marginBottom: 430,
          maxWidth: 900,
          fontFamily: F.body,
          fontStyle: 'italic',
          fontSize: size,
          fontWeight: 500,
          lineHeight: 1.4,
          textAlign: 'center',
          color: C.ink,
          opacity: op,
          textShadow: '0 4px 30px rgba(0,0,0,0.8)',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** Night-savanna floor + moon. `edge` cuts the ground off (the cliff). */
const Terrain: React.FC<{edge?: number}> = ({edge}) => (
  <>
    <div
      style={{
        position: 'absolute',
        right: 170,
        top: 400,
        width: 120,
        height: 120,
        borderRadius: 999,
        background: 'rgba(231,234,238,0.07)',
        boxShadow: '0 0 80px rgba(231,234,238,0.10), inset -18px -12px 30px rgba(0,0,0,0.35)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: GROUND_Y,
        width: edge ?? 1080,
        height: 1920 - GROUND_Y,
        background: 'linear-gradient(180deg, #0e1219 0%, #080b10 60%)',
        borderTop: `1.5px solid rgba(48,57,80,0.8)`,
      }}
    />
    {edge !== undefined && (
      <>
        {/* the cliff face */}
        <div
          style={{
            position: 'absolute',
            left: edge - 3,
            top: GROUND_Y,
            width: 3,
            height: 260,
            background: 'linear-gradient(180deg, rgba(48,57,80,0.8), transparent)',
          }}
        />
        {/* something red glows far below the fold */}
        <div
          style={{
            position: 'absolute',
            left: edge + 40,
            top: 1700,
            width: 400,
            height: 220,
            borderRadius: 999,
            background: 'radial-gradient(closest-side, rgba(229,83,75,0.16), transparent)',
          }}
        />
      </>
    )}
  </>
);

/** The retail investor: a hunched silhouette lit by his phone. */
const Watcher: React.FC<{x: number; phoneOff?: boolean; red?: number; teeter?: number}> = ({
  x,
  phoneOff,
  red = 0,
  teeter = 0,
}) => {
  const frame = useCurrentFrame();
  const flick = 0.72 + 0.28 * (noise2D('phone-flicker', frame * 0.18, 0) * 0.5 + 0.5);
  const glowColor = `rgba(${Math.round(139 + (229 - 139) * red)}, ${Math.round(
    124 + (83 - 124) * red,
  )}, ${Math.round(255 + (75 - 255) * red)}, ${phoneOff ? 0 : 0.16 * flick})`;
  const breathe = Math.sin(frame / 22) * 2;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: GROUND_Y,
        transform: `rotate(${teeter}deg)`,
        transformOrigin: 'bottom center',
      }}
    >
      {/* phone light cone */}
      {!phoneOff && (
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: -170 + breathe,
            width: 240,
            height: 190,
            borderRadius: 999,
            background: `radial-gradient(closest-side, ${glowColor}, transparent)`,
          }}
        />
      )}
      {/* body */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: -150 + breathe * 0.6,
          width: 130,
          height: 150,
          borderRadius: '52px 60px 14px 14px',
          background: '#05070b',
          border: '1.5px solid rgba(35,41,56,0.9)',
        }}
      />
      {/* head, hunched forward */}
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: -212 + breathe,
          width: 66,
          height: 62,
          borderRadius: 999,
          background: '#05070b',
          border: '1.5px solid rgba(35,41,56,0.9)',
        }}
      />
      {/* the phone */}
      {!phoneOff && (
        <div
          style={{
            position: 'absolute',
            left: 118,
            top: -128 + breathe,
            width: 30,
            height: 46,
            borderRadius: 6,
            background: glowColor.replace('0.16', '0.75'),
            boxShadow: `0 0 24px ${glowColor}`,
            transform: 'rotate(-16deg)',
          }}
        />
      )}
    </div>
  );
};

/** One candle-critter of the herd — a green candlestick with a hop cycle. */
const Critter: React.FC<{x: number; y: number; h: number; s: number; dim?: number; rot?: number}> = ({
  x,
  y,
  h,
  s,
  dim = 0,
  rot = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y - h * s,
      transform: `scale(${s}) rotate(${rot}deg)`,
      transformOrigin: 'bottom center',
      opacity: 1 - dim,
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: -16,
        width: 3,
        height: 16,
        background: 'rgba(95,191,122,0.8)',
      }}
    />
    <div
      style={{
        width: 27,
        height: h,
        borderRadius: 6,
        background: 'linear-gradient(180deg, #6cd489 0%, #3f8f5c 100%)',
        border: '1.5px solid rgba(95,191,122,0.5)',
        boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: h,
        width: 3,
        height: 12,
        background: 'rgba(95,191,122,0.8)',
      }}
    />
  </div>
);

/** N1 — the habitat. */
export const N1_Field: React.FC = () => {
  const frame = useCurrentFrame();
  const red = lerp(frame, [92, 112], [0, 1]);
  return (
    <Void depth>
      <Terrain />
      <Watcher x={300} red={red} />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>A STOCK PICKER’S NATURE DOCUMENTARY</Eyebrow>
        </div>
      </AbsoluteFill>
      <Caption at={26} out={84}>
        The retail investor, in his natural habitat.
      </Caption>
      <Caption at={94}>
        He has not slept. The chart is <span style={{color: C.danger, fontStyle: 'italic'}}>red</span>.
      </Caption>
      <Grain opacity={0.06} />
    </Void>
  );
};

/** N2 — the herd arrives, chasing the same prey. */
export const N2_Herd: React.FC = () => {
  const frame = useCurrentFrame();
  // linear — a stampede doesn't ease; front clears the frame before the cut
  const run = lerp(frame, [24, 200], [0, 1]);
  const packX = -620 + run * 2570;
  return (
    <Void depth>
      <Terrain />
      <Watcher x={300} phoneOff={frame > 46} />
      <Trail layers={3} lagInFrames={2} trailOpacity={0.3}>
        <AbsoluteFill>
          {/* dust behind the pack */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const dx = packX - 120 - i * 64 + noise2D(`dust${i}`, frame * 0.05, 0) * 30;
            return (
              <div
                key={`d${i}`}
                style={{
                  position: 'absolute',
                  left: dx,
                  top: GROUND_Y - 30 - rndIn(`dy${i}`, 0, 40),
                  width: 60 + i * 10,
                  height: 34,
                  borderRadius: 999,
                  background: 'rgba(136,145,161,0.07)',
                  filter: 'blur(7px)',
                }}
              />
            );
          })}
          {/* the alpha: a glowing redacted cashtag leading the charge */}
          <div
            style={{
              position: 'absolute',
              left: packX + 230,
              top: GROUND_Y - 118 - Math.abs(Math.sin(frame * 0.34)) * 34,
              padding: '18px 26px',
              borderRadius: 999,
              background: C.panel,
              border: `1.5px solid rgba(139,124,255,0.5)`,
              boxShadow: '0 0 34px rgba(139,124,255,0.25), 0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            <Redact cash scale={1.05} />
          </div>
          {/* the herd */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
            const row = i % 3;
            const cx = packX - i * 58 - row * 22;
            const hop = Math.abs(Math.sin(frame * 0.34 + i * 1.21)) * 26;
            const h = 44 + rndIn(`h${i}`, 0, 22);
            return (
              <Critter
                key={i}
                x={cx}
                y={GROUND_Y - hop + row * 6}
                h={h}
                s={0.82 + rndIn(`s${i}`, 0, 0.3)}
              />
            );
          })}
        </AbsoluteFill>
      </Trail>
      <Caption at={8} out={64}>
        Suddenly — movement.
      </Caption>
      <Caption at={84} out={142}>
        The herd has found something.
      </Caption>
      <Caption at={152}>
        All of them chasing{' '}
        <span style={{fontFamily: F.mono, fontStyle: 'normal', fontWeight: 700, color: C.discovery}}>
          “the next $NVDA.”
        </span>
      </Caption>
      <Grain opacity={0.06} />
    </Void>
  );
};

/** N3 — the herd does not stop at the edge. Neither does he. */
export const N3_Cliff: React.FC = () => {
  const frame = useCurrentFrame();
  const FREEZE = 118;
  const fr = Math.min(frame, FREEZE); // world freezes; captions live on
  const EDGE = 640;
  const flash = pulse01((frame - FREEZE) / 8) * 0.1;
  const follow = lerp(fr, [70, 112], [180, 470], smooth);
  const teeter = lerp(fr, [104, 118], [0, 6]);
  return (
    <Void depth>
      <Terrain edge={EDGE} />
      <Trail layers={3} lagInFrames={2} trailOpacity={0.3}>
        <AbsoluteFill>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const start = i * 15;
            const t = Math.max(0, fr - start);
            const x = -120 + t * 11;
            const past = Math.max(0, x - EDGE);
            const y = GROUND_Y - (past > 0 ? 0 : Math.abs(Math.sin(fr * 0.34 + i * 1.3)) * 24) + Math.pow(past / 90, 2) * 120;
            const rot = past > 0 ? Math.min(past * 1.4, 160) : 0;
            const dim = lerp(y, [1650, 1880], [0, 1], easeIn);
            if (dim >= 1) return null;
            return <Critter key={i} x={x} y={y} h={52} s={0.9} dim={dim} rot={rot} />;
          })}
        </AbsoluteFill>
      </Trail>
      <Watcher x={follow} phoneOff teeter={teeter} />
      {/* the freeze-frame */}
      {frame >= FREEZE && (
        <AbsoluteFill
          style={{
            border: '2px solid rgba(231,234,238,0.20)',
            margin: 46,
            width: 1080 - 92,
            height: 1920 - 92,
            pointerEvents: 'none',
          }}
        />
      )}
      <AbsoluteFill style={{background: `rgba(231,234,238,${flash})`, pointerEvents: 'none'}} />
      <Caption at={14} out={104}>
        He follows. He always follows.
      </Caption>
      <Caption at={124} out={144} size={46}>
        Magnificent.
      </Caption>
      <Caption at={148} size={46}>
        Devastating.
      </Caption>
      <Grain opacity={frame >= FREEZE ? 0.09 : 0.06} />
    </Void>
  );
};

/** N4 — the instrument does not migrate. */
export const N4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'Herds aren’t\nresearch.'} delay={8} size={70} accents={{2: C.discovery}} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={54}
      stag={18}
      verdictAt={136}
      foot="THREE LENSES · ZERO HERD INSTINCT"
      footAt={172}
      top={640}
    />
  </Void>
);

/** N5 — endcard. */
export const N5_End: React.FC = () => <FunEndcard gag="THE HERD IS NOT A SOURCE" />;
