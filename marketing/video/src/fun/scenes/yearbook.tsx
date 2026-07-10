import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Chip, Eyebrow, Grain, Kinetic, Void} from '../../lib/ui';
import {lerp, pop, settle, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard} from '../flib';

/**
 * ENGINE SPECIAL (scout) — "Before they were giants."
 * The giants' yearbook photos: what $NVDA and $AAPL looked like BEFORE the
 * trillion — voted in on traits, not market caps. Then the page everyone
 * actually cares about: the Class of 2026, being written right now.
 * Episode palette (cream paper, school-ink navy, marker red) lives only
 * inside this episode; the desk and endcard return to house dark.
 */

const PAPER = '#f0e9d8';
const PAPER_DARK = '#e2d8c2';
const NAVY = '#22305c';
const MARKER = '#c8443a';

/** Marker handwriting that sweeps on like it's being written. */
const Scribble: React.FC<{
  at: number;
  size?: number;
  color?: string;
  rotate?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({at, size = 40, color = NAVY, rotate = -3, children, style}) => {
  const frame = useCurrentFrame();
  const sweep = lerp(frame, [at, at + 18], [100, 0], smooth);
  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: size,
        fontWeight: 700,
        color,
        transform: `rotate(${rotate}deg)`,
        clipPath: `inset(-20% ${sweep}% -20% -4%)`,
        whiteSpace: 'nowrap',
        lineHeight: 1.1,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const HALFTONE: React.CSSProperties = {
  backgroundImage: `radial-gradient(circle, ${NAVY}26 1.8px, transparent 1.8px)`,
  backgroundSize: '10px 10px',
};

/** Ink-on-paper redacted ticker (white bars vanish on cream). */
const InkRedact: React.FC<{scale?: number}> = ({scale = 1}) => (
  <div style={{display: 'flex', gap: 6 * scale, alignItems: 'center'}}>
    <span style={{fontFamily: F.mono, fontSize: 27 * scale, fontWeight: 700, color: NAVY, lineHeight: 1}}>$</span>
    {[20, 13, 17, 11, 15].map((w, i) => (
      <div key={i} style={{width: w * scale, height: 15 * scale, borderRadius: 3, background: `${NAVY}cc`}} />
    ))}
  </div>
);

/** Y1 — every giant was small once; the yearbook slams in. */
export const Y1_Cover: React.FC = () => {
  const frame = useCurrentFrame();
  const slam = settle(frame, 120);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>STOCK YEARBOOKS · THE BEFORE YEARS</Eyebrow>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 640}}>
          <Kinetic text={'Every giant stock\nwas small once.'} delay={10} size={92} accents={{1: C.discovery}} out={112} />
        </div>
      </AbsoluteFill>

      {frame >= 116 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              width: 700,
              height: 560,
              borderRadius: 14,
              background: `linear-gradient(160deg, ${NAVY} 0%, #182246 100%)`,
              boxShadow: `0 ${46 * Math.min(slam, 1)}px ${110 * Math.min(slam, 1)}px rgba(0,0,0,0.55)`,
              transform: `rotate(-2deg) scale(${1.4 - 0.4 * Math.min(slam, 1)})`,
              opacity: Math.min(slam * 2, 1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 620,
                height: 480,
                border: `3px double ${PAPER}aa`,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 30,
              }}
            >
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 999,
                  border: `3px solid ${PAPER}aa`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: F.mono,
                  fontSize: 25,
                  fontWeight: 700,
                  color: PAPER,
                }}
              >
                4%
              </div>
              <div style={{fontFamily: F.serif, fontSize: 68, fontWeight: 700, color: PAPER, letterSpacing: '0.04em'}}>
                THE GIANTS
              </div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 25,
                  letterSpacing: '0.14em',
                  color: `${PAPER}b8`,
                  whiteSpace: 'nowrap',
                }}
              >
                BEFORE THE TRILLION
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}
      <Grain opacity={0.07} />
    </Void>
  );
};

/** One yearbook page: halftone photo, class year, superlative, trait notes. */
const GiantPage: React.FC<{
  ticker: string;
  year: string;
  superlative: [string, string];
  traits: [string, string];
  base: number; // frame the page starts settling
  x: number; // slide offset driver (already computed by parent)
  rot: number;
}> = ({ticker, year, superlative, traits, base, x, rot}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 100,
        top: 380,
        width: 880,
        height: 1080,
        borderRadius: 10,
        background: `linear-gradient(170deg, ${PAPER} 0%, ${PAPER_DARK} 100%)`,
        boxShadow: '0 34px 90px rgba(0,0,0,0.5)',
        transform: `translateX(${x}px) rotate(${rot}deg)`,
        padding: '58px 60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* the photo */}
      <div
        style={{
          width: 420,
          height: 420,
          border: `3px solid ${NAVY}`,
          borderRadius: 6,
          position: 'relative',
          overflow: 'hidden',
          ...HALFTONE,
          backgroundColor: '#e8dfc9',
        }}
      >
        {/* class-photo silhouette */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 74,
            width: 150,
            height: 150,
            borderRadius: 999,
            transform: 'translateX(-50%)',
            background: `${NAVY}29`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 236,
            width: 300,
            height: 200,
            borderRadius: '110px 110px 0 0',
            transform: 'translateX(-50%)',
            background: `${NAVY}29`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: F.mono,
            fontSize: 64,
            fontWeight: 700,
            color: NAVY,
            textShadow: `0 0 18px ${PAPER}`,
          }}
        >
          {ticker}
        </div>
      </div>

      <div
        style={{
          marginTop: 30,
          fontFamily: F.serif,
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: NAVY,
          opacity: lerp(frame, [base + 24, base + 36], [0, 1]),
        }}
      >
        {year}
      </div>

      <div style={{marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <Scribble at={base + 40} size={52} color={MARKER} rotate={-2.5}>
          {superlative[0]}
        </Scribble>
        <Scribble at={base + 56} size={52} color={MARKER} rotate={-2.5} style={{marginTop: 4}}>
          {superlative[1]}
        </Scribble>
      </div>

      <div
        style={{
          marginTop: 44,
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 26px',
        }}
      >
        <Scribble at={base + 58} size={40} rotate={-5}>
          {traits[0]} ✓
        </Scribble>
        <Scribble at={base + 70} size={40} rotate={4}>
          {traits[1]} ✓
        </Scribble>
      </div>
    </div>
  );
};

/** Y2 — the giants' pages: voted in on traits, not market caps. */
export const Y2_Pages: React.FC = () => {
  const frame = useCurrentFrame();
  // page 1 settles in, then slides off left as page 2 springs in from the right
  const p1In = settle(frame, 8);
  const p1X = (1 - Math.min(p1In, 1)) * 1250 + lerp(frame, [138, 160], [0, -1350], smooth);
  const p2X = (1 - Math.min(settle(frame, 144), 1)) * 1250;
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>VOTED IN ON TRAITS</Eyebrow>
        </div>
      </AbsoluteFill>

      {frame < 164 && (
        <GiantPage
          ticker="$NVDA"
          year="CLASS OF 1999"
          superlative={['most likely to', 'accelerate everything']}
          traits={['founder-led', 'compounding moat']}
          base={8}
          x={p1X}
          rot={-1.6}
        />
      )}
      {frame >= 142 && (
        <GiantPage
          ticker="$AAPL"
          year="CLASS OF 1980"
          superlative={['most likely to', 'think different']}
          traits={['category creation', 'platform economics']}
          base={152}
          x={p2X}
          rot={1.4}
        />
      )}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 240,
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.muted,
            opacity: lerp(frame, [56, 70], [0, 1]),
          }}
        >
          NOBODY VOTED FOR A MARKET CAP
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/* rough hand-drawn ellipse (two passes, slightly offset) around a grid card */
const circlePath = (cx: number, cy: number, rx: number, ry: number, wob: number) =>
  `M ${cx - rx} ${cy} ` +
  `C ${cx - rx} ${cy - ry * 1.35}, ${cx + rx * 1.1} ${cy - ry * 1.3 - wob}, ${cx + rx} ${cy + wob} ` +
  `C ${cx + rx * 0.95} ${cy + ry * 1.3}, ${cx - rx * 1.12} ${cy + ry * 1.28 + wob}, ${cx - rx} ${cy - wob * 2}`;

const CANDIDATES: Array<{trait: string}> = [
  {trait: 'founder-led'},
  {trait: 'category creator'},
  {trait: 'network effects'},
  {trait: 'compounding moat'},
];

/** Y3 — the Class of 2026, in session; the scout is reading it now. */
export const Y3_Class: React.FC = () => {
  const frame = useCurrentFrame();
  const pageIn = settle(frame, 116);
  // grid geometry inside the sheet (sheet at left 100 / top 330, pad 54)
  const cardW = 366;
  const cardH = 372;
  const gx = (i: number) => 154 + (i % 2) * (cardW + 40);
  const gy = (i: number) => 528 + Math.floor(i / 2) * (cardH + 36);
  const circled = 1; // top-right card gets the marker circle
  const ring1 = circlePath(gx(circled) + cardW / 2, gy(circled) + cardH / 2 - 20, 210, 196, 8);
  const ring2 = circlePath(gx(circled) + cardW / 2 + 8, gy(circled) + cardH / 2 - 14, 202, 188, -6);
  const e1 = evolvePath(lerp(frame, [196, 216], [0, 1], smooth), ring1);
  const e2 = evolvePath(lerp(frame, [214, 232], [0, 1], smooth), ring2);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>THE PAGE THAT MATTERS NOW</Eyebrow>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 560}}>
          <Kinetic text={'They voted for traits,\nnot market caps.'} delay={8} size={56} accents={{3: C.discovery}} out={104} />
        </div>
      </AbsoluteFill>

      {frame >= 110 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 100,
              top: 330,
              width: 880,
              height: 1150,
              borderRadius: 10,
              background: `linear-gradient(170deg, ${PAPER} 0%, ${PAPER_DARK} 100%)`,
              boxShadow: '0 34px 90px rgba(0,0,0,0.5)',
              transform: `translateY(${(1 - Math.min(pageIn, 1)) * 160}px)`,
              opacity: Math.min(pageIn * 2, 1),
              padding: '50px 54px',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontFamily: F.serif, fontSize: 46, fontWeight: 700, letterSpacing: '0.06em', color: NAVY}}>
                CLASS OF 2026
              </span>
              <Chip size={25} color={MARKER} border={`${MARKER}88`} bg={`${MARKER}10`}>
                IN SESSION
              </Chip>
            </div>

            {CANDIDATES.map((c, i) => {
              const at = 130 + i * 12;
              const s = pop(frame, at, 13, 0.85);
              const op = lerp(frame, [at, at + 8], [0, 1]);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: gx(i) - 100,
                    top: gy(i) - 330,
                    width: cardW,
                    height: cardH,
                    borderRadius: 8,
                    border: `2.5px solid ${NAVY}55`,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    opacity: op,
                    transform: `translateY(${(1 - s) * 30}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 184,
                      height: 184,
                      border: `2.5px solid ${NAVY}`,
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      ...HALFTONE,
                      backgroundColor: '#e8dfc9',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: 30,
                        width: 66,
                        height: 66,
                        borderRadius: 999,
                        transform: 'translateX(-50%)',
                        background: `${NAVY}29`,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: 102,
                        width: 132,
                        height: 90,
                        borderRadius: '50px 50px 0 0',
                        transform: 'translateX(-50%)',
                        background: `${NAVY}29`,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <InkRedact scale={0.92} />
                    </div>
                  </div>
                  <div style={{marginTop: 22}}>
                    <Scribble at={at + 18} size={36} rotate={i % 2 === 0 ? -4 : 3.5}>
                      {c.trait} ✓
                    </Scribble>
                  </div>
                </div>
              );
            })}
          </div>

          {/* the marker circle */}
          <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
            {[
              {d: ring1, e: e1, w: 7, o: 0.9},
              {d: ring2, e: e2, w: 5, o: 0.55},
            ].map((r, i) => (
              <path
                key={i}
                d={r.d}
                fill="none"
                stroke={MARKER}
                strokeWidth={r.w}
                strokeLinecap="round"
                strokeDasharray={r.e.strokeDasharray}
                strokeDashoffset={r.e.strokeDashoffset}
                opacity={r.o}
              />
            ))}
          </svg>
        </>
      )}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 250}}>
          <Kinetic
            text={'The scout reads yearbooks —\nhunting trillion-dollar DNA\nbefore the trillion.'}
            delay={208}
            size={44}
            accents={{6: C.discovery, 7: C.discovery}}
          />
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/** Y4 — the desk: superlatives don't score. */
export const Y4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'Superlatives don’t score.'} delay={8} size={64} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={52}
      stag={18}
      verdictAt={124}
      foot="VOTED IN · THEN VERIFIED · THEN RANKED"
      footAt={156}
      top={620}
    />
  </Void>
);

/** Y5 — endcard. */
export const Y5_End: React.FC = () => <FunEndcard gag="CLASS OF 2026 · IN SESSION" />;
