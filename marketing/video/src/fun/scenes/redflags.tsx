import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Eyebrow, Kinetic, Void} from '../../lib/ui';
import {easeIn, lerp, pop, rndIn} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * "Red flags" — the swipe format, but for value traps. Two horror profiles
 * get swiped left; the clean one earns a look — and then the desk.
 */

type Line = {icon: string; text: string; bad?: boolean};

const CardStamp: React.FC<{good?: boolean; at: number}> = ({good, at}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, 11, 0.75);
  if (frame < at) return null;
  const color = good ? C.fundamentals : C.danger;
  return (
    <div
      style={{
        position: 'absolute',
        left: good ? 54 : undefined,
        right: good ? undefined : 54,
        top: 60,
        transform: `rotate(${good ? -12 : 12}deg) scale(${s})`,
        border: `5px solid ${color}`,
        borderRadius: 18,
        padding: '10px 24px',
        fontFamily: F.display,
        fontSize: 56,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color,
        background: `${color}10`,
        boxShadow: `0 0 40px ${color}33`,
      }}
    >
      {good ? 'WORTH A LOOK' : 'NOPE'}
    </div>
  );
};

const ProfileCard: React.FC<{
  sub: string;
  lines: Line[];
  bio?: string;
  at: number;
  linesAt: number;
  stampAt: number;
  swipeAt: number;
  dir: -1 | 1;
  good?: boolean;
}> = ({sub, lines, bio, at, linesAt, stampAt, swipeAt, dir, good}) => {
  const frame = useCurrentFrame();
  const inS = pop(frame, at, 13, 0.95);
  const sw = lerp(frame, [swipeAt, swipeAt + 22], [0, 1], easeIn);
  const wob = Math.sin(frame / 26) * 0.8;
  return (
    <div
      style={{
        position: 'absolute',
        left: 540,
        top: 1000,
        transform: `translate(-50%, -50%) translate(${dir * 1500 * sw}px, ${-140 * sw}px) rotate(${
          wob + (1 - inS) * 4 + dir * 26 * sw
        }deg) translateY(${(1 - inS) * 90}px)`,
        opacity: Math.min(inS * 1.3, 1),
        width: 890,
        height: 1220,
        background: C.panel2,
        border: `1.5px solid ${C.hairline2}`,
        borderRadius: 30,
        boxShadow: '0 50px 140px rgba(0,0,0,0.6)',
        padding: '56px 58px',
      }}
    >
      {/* header */}
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 999,
            background: C.panel,
            border: `1.5px solid ${C.hairline2}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Redact scale={0.7} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
          <Redact cash scale={1.35} />
          <span style={{fontFamily: F.mono, fontSize: 22, letterSpacing: '0.1em', color: C.dim, whiteSpace: 'nowrap'}}>
            {sub}
          </span>
        </div>
      </div>
      <div style={{height: 1.5, background: C.hairline, margin: '40px 0 44px'}} />

      {/* profile lines */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 34}}>
        {lines.map((l, i) => {
          const s = pop(frame, linesAt + i * 16, 12, 0.8);
          const op = lerp(frame, [linesAt + i * 16, linesAt + i * 16 + 7], [0, 1]);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                opacity: op,
                transform: `translateX(${(1 - s) * -26}px)`,
              }}
            >
              <span style={{fontSize: 43, lineHeight: 1}}>{l.icon}</span>
              <span
                style={{
                  fontFamily: F.body,
                  fontSize: 40,
                  fontWeight: 600,
                  color: l.bad ? C.ink : C.fundamentals,
                }}
              >
                {l.text}
              </span>
            </div>
          );
        })}
      </div>

      {bio && (
        <div
          style={{
            position: 'absolute',
            left: 58,
            right: 58,
            bottom: 64,
            fontFamily: F.body,
            fontSize: 36,
            fontStyle: 'italic',
            color: C.muted,
            opacity: lerp(frame, [linesAt + lines.length * 16 + 8, linesAt + lines.length * 16 + 20], [0, 1]),
          }}
        >
          {bio}
        </div>
      )}

      <CardStamp good={good} at={stampAt} />
    </div>
  );
};

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 250, opacity: lerp(frame, [4, 16], [0, 1])}}>
        <Eyebrow size={29} color={C.ink}>
          STOCK RED FLAGS · A FIELD GUIDE
        </Eyebrow>
      </div>
    </AbsoluteFill>
  );
};

/** R1 — the dilution enjoyer. */
export const R1_Swipe1: React.FC = () => (
  <Void depth>
    <Header />
    <ProfileCard
      sub="SMALL CAP · CALLS ITSELF “THE NEXT TSLA”"
      lines={[
        {icon: '🚩', text: 'loves: dilution', bad: true},
        {icon: '🚩', text: '“adjusted” everything', bad: true},
        {icon: '🚩', text: 'profitable “eventually”', bad: true},
      ]}
      bio="“this time it’s different.”"
      at={10}
      linesAt={40}
      stampAt={112}
      swipeAt={134}
      dir={-1}
    />
  </Void>
);

/** R2 — the moonshot. */
export const R2_Swipe2: React.FC = () => (
  <Void depth>
    <Header />
    <ProfileCard
      sub="UP +340% THIS MONTH"
      lines={[
        {icon: '🚩', text: 'insiders selling the rip', bad: true},
        {icon: '🚩', text: 'free cash flow: −$2.1B', bad: true},
        {icon: '🚩', text: '“going concern” footnote', bad: true},
      ]}
      bio="“don’t overthink it. 🚀”"
      at={8}
      linesAt={36}
      stampAt={114}
      swipeAt={136}
      dir={-1}
    />
  </Void>
);

/** R3 — the keeper (still not a verdict). */
export const R3_Keeper: React.FC = () => {
  const frame = useCurrentFrame();
  const burst = pop(frame, 150, 11, 0.7);
  return (
    <Void depth>
      <Header />
      <ProfileCard
        sub="BORING. IN A GOOD WAY."
        lines={[
          {icon: '✓', text: 'F-Score 8 / 9'},
          {icon: '✓', text: 'free cash flow positive'},
          {icon: '✓', text: 'insiders buying'},
          {icon: '✓', text: 'guidance raised twice'},
        ]}
        at={8}
        linesAt={34}
        stampAt={118}
        swipeAt={152}
        dir={1}
        good
      />
      {/* a small green burst as it swipes right */}
      {frame >= 150 &&
        Array.from({length: 8}).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 + rndIn(`b${i}`, -0.3, 0.3);
          const r = burst * rndIn(`r${i}`, 120, 260);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 540 + Math.cos(a) * r,
                top: 980 + Math.sin(a) * r,
                width: rndIn(`s${i}`, 6, 12),
                height: rndIn(`s${i}`, 6, 12),
                borderRadius: 99,
                background: C.fundamentals,
                opacity: Math.max(0, 1 - burst) * 0.9 + 0.1,
              }}
            />
          );
        })}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 210,
            fontFamily: F.mono,
            fontSize: 26,
            letterSpacing: '0.14em',
            color: C.dim,
            opacity: lerp(frame, [120, 134], [0, 1]),
          }}
        >
          FINALLY.
        </div>
      </AbsoluteFill>
    </Void>
  );
};

/** R4 — one good profile isn't a verdict. */
export const R4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'One good profile\nisn’t a verdict.'} delay={8} size={66} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={56}
      stag={18}
      verdictAt={132}
      glyphs={['▲', '─', '▲']}
      score="73.9"
      confluence={false}
      foot="THREE METHODS · GATES FIRST · SOURCES REQUIRED"
      footAt={166}
      top={660}
    />
  </Void>
);

/** R5 — endcard. */
export const R5_End: React.FC = () => <FunEndcard gag="SWIPE LESS. VERIFY MORE." />;
