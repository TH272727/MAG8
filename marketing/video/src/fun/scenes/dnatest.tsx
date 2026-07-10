import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Eyebrow, Grain, Kinetic, Void} from '../../lib/ui';
import {lerp, pop, settle, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * ENGINE SPECIAL (scout) — "Stock DNA: the results are in."
 * The lab sequences the trillion-dollar club, six shared gene markers light
 * up the helix, then a tiny $-redacted unknown matches all six. The desk
 * reminds everyone a match opens a case — it never closes one.
 * Episode palette (lab blue + bio green) lives only inside this episode;
 * the desk and endcard return to house dark.
 */

const LAB = '#57c8ff'; // sequencer / scan beams
const BIO = '#63e6b8'; // gene markers / the match

export const GENES = [
  'FOUNDER-LED',
  'PLATFORM ECONOMICS',
  'COMPOUNDING MOAT',
  'NETWORK EFFECTS',
  'CATEGORY CREATION',
  'EXPANDING TAM',
];

/** One glass vial with a glowing sample. */
const Vial: React.FC<{at: number; label: string; liquid: string}> = ({at, label, liquid}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, 12, 0.85);
  const op = lerp(frame, [at, at + 8], [0, 1]);
  const fill = lerp(frame, [at + 6, at + 26], [0, 1], smooth);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22,
        opacity: op,
        transform: `translateY(${(1 - s) * 44}px)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 108,
          height: 252,
          borderRadius: '18px 18px 54px 54px',
          border: `2.5px solid ${C.hairline2}`,
          background: 'rgba(18,22,31,0.85)',
          overflow: 'hidden',
        }}
      >
        {/* cap */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 30,
            background: C.panel2,
            borderBottom: `2px solid ${C.hairline2}`,
          }}
        />
        {/* the sample */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: Math.max(0, 150 * fill),
            background: `linear-gradient(180deg, ${liquid}cc, ${liquid}66)`,
            boxShadow: `0 0 34px ${liquid}88`,
          }}
        />
        {/* glass shine */}
        <div
          style={{
            position: 'absolute',
            top: 36,
            bottom: 12,
            left: 14,
            width: 10,
            borderRadius: 8,
            background: 'rgba(231,234,238,0.14)',
          }}
        />
      </div>
      <span style={{fontFamily: F.mono, fontSize: 30, fontWeight: 700, color: C.ink}}>{label}</span>
    </div>
  );
};

/** DN1 — the club goes into the sequencer. */
export const DN1_Vials: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>STOCK DNA · LAB FILE 001</Eyebrow>
        </div>
      </AbsoluteFill>

      {/* the hook — big, holds, then hands off to the vials */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 560}}>
          <Kinetic
            text={'Trillion-dollar\nstocks share\nthe same DNA.'}
            delay={10}
            size={100}
            accents={{5: C.discovery}}
            out={112}
          />
        </div>
      </AbsoluteFill>

      {frame >= 114 && (
        <>
          <AbsoluteFill style={{alignItems: 'center'}}>
            <div style={{marginTop: 660, display: 'flex', gap: 96}}>
              <Vial at={118} label="$AAPL" liquid={C.discovery} />
              <Vial at={128} label="$NVDA" liquid={LAB} />
              <Vial at={138} label="$MSFT" liquid={BIO} />
            </div>
          </AbsoluteFill>
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
            <div
              style={{
                marginBottom: 400,
                fontFamily: F.mono,
                fontSize: 25,
                letterSpacing: '0.12em',
                color: C.muted,
                opacity: lerp(frame, [140, 152], [0, 1]),
              }}
            >
              THE TRILLION-DOLLAR CLUB · SAMPLES IN
            </div>
          </AbsoluteFill>
        </>
      )}
      <Grain opacity={0.07} />
    </Void>
  );
};

/* Helix geometry — a pure function of frame (slow continuous twist). */
const H_TOP = 480;
const H_BOT = 1270;
const H_AMP = 120;
const RUNGS = 24;
const GENE_RUNGS = [2, 6, 9, 13, 17, 20];
const GENE_AT = [70, 90, 110, 130, 150, 170];

const helixPts = (rot: number) => {
  const a: Array<[number, number]> = [];
  const b: Array<[number, number]> = [];
  const steps = 72;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = H_TOP + t * (H_BOT - H_TOP);
    const ph = t * Math.PI * 3 + rot;
    a.push([540 + Math.sin(ph) * H_AMP, y]);
    b.push([540 + Math.sin(ph + Math.PI) * H_AMP, y]);
  }
  return {a, b};
};

const pathFrom = (pts: Array<[number, number]>, frac: number) => {
  const n = Math.max(2, Math.floor(pts.length * Math.min(Math.max(frac, 0), 1)));
  return pts
    .slice(0, n)
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
};

/** DN2 — the shared genome: six markers light the helix. */
export const DN2_Helix: React.FC = () => {
  const frame = useCurrentFrame();
  const rot = frame * 0.004;
  const {a, b} = helixPts(rot);
  const drawn = lerp(frame, [8, 70], [0, 1], smooth);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>THE SHARED GENOME</Eyebrow>
        </div>
      </AbsoluteFill>

      <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        {/* rungs */}
        {Array.from({length: RUNGS}, (_, i) => {
          const t = (i + 0.5) / RUNGS;
          if (t > drawn) return null;
          const idx = Math.round(t * 72);
          const gi = GENE_RUNGS.indexOf(i);
          const lit = gi >= 0 ? lerp(frame, [GENE_AT[gi], GENE_AT[gi] + 10], [0, 1]) : 0;
          const [x1, y1] = a[Math.min(idx, 72)];
          const [x2, y2] = b[Math.min(idx, 72)];
          // lit gene bands keep a minimum span so the twist never collapses
          // a marker to a dot at the strand crossovers
          const mid = (x1 + x2) / 2;
          const half = Math.max(Math.abs(x1 - x2) / 2, lit > 0 ? 36 : 0);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.hairline2} strokeWidth={3} opacity={0.6} />
              {lit > 0 && (
                <line
                  x1={mid - half}
                  y1={(y1 + y2) / 2}
                  x2={mid + half}
                  y2={(y1 + y2) / 2}
                  stroke={BIO}
                  strokeWidth={7}
                  strokeLinecap="round"
                  opacity={lit}
                  style={{filter: `drop-shadow(0 0 10px ${BIO})`}}
                />
              )}
            </g>
          );
        })}
        {/* strands */}
        <path d={pathFrom(a, drawn)} fill="none" stroke={C.discovery} strokeWidth={6} strokeLinecap="round" opacity={0.92} />
        <path d={pathFrom(b, drawn)} fill="none" stroke={LAB} strokeWidth={6} strokeLinecap="round" opacity={0.6} />
        {/* connectors to the gene labels */}
        {GENE_RUNGS.map((r, gi) => {
          const op = lerp(frame, [GENE_AT[gi] + 4, GENE_AT[gi] + 14], [0, 1]);
          if (op <= 0) return null;
          const t = (r + 0.5) / RUNGS;
          const y = H_TOP + t * (H_BOT - H_TOP);
          const left = gi % 2 === 0;
          return (
            <line
              key={r}
              x1={left ? 420 : 660}
              y1={y}
              x2={left ? 390 : 690}
              y2={y}
              stroke={BIO}
              strokeWidth={2.5}
              opacity={op * 0.8}
            />
          );
        })}
      </svg>

      {/* gene labels, alternating sides */}
      {GENE_RUNGS.map((r, gi) => {
        const op = lerp(frame, [GENE_AT[gi] + 4, GENE_AT[gi] + 14], [0, 1]);
        const s = pop(frame, GENE_AT[gi] + 4, 13, 0.85);
        const t = (r + 0.5) / RUNGS;
        const y = H_TOP + t * (H_BOT - H_TOP);
        const left = gi % 2 === 0;
        return (
          <div
            key={r}
            style={{
              position: 'absolute',
              top: y - 26,
              ...(left ? {right: 1080 - 390} : {left: 690}),
              opacity: op,
              transform: `translateX(${(1 - s) * (left ? -20 : 20)}px)`,
            }}
          >
            <Chip size={25} color={BIO} border={`${BIO}66`} bg={`${BIO}0e`}>
              {GENES[gi]}
            </Chip>
          </div>
        );
      })}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 300}}>
          <Kinetic
            text={'Six markers. Every giant had them —\nbefore it was a giant.'}
            delay={186}
            size={46}
            accents={{0: BIO, 1: BIO}}
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
            opacity: lerp(frame, [238, 252], [0, 1]),
          }}
        >
          ~4% OF STOCKS CREATED ALL THE NET WEALTH
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/** DN3 — run it in reverse: a tiny unknown matches 6 / 6. */
export const DN3_Match: React.FC = () => {
  const frame = useCurrentFrame();
  const cardIn = settle(frame, 106);
  const beamY = lerp(frame, [126, 158], [520, 810], smooth);
  const beamOp = lerp(frame, [126, 134], [0, 1]) * lerp(frame, [150, 162], [1, 0]);
  const matchS = pop(frame, 200, 12, 0.8);
  const matchOp = lerp(frame, [200, 210], [0, 1]);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>RUN IT IN REVERSE</Eyebrow>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 340}}>
          <Kinetic text={'Who has these genes\nright now?'} delay={10} size={60} accents={{3: BIO}} out={100} />
        </div>
      </AbsoluteFill>

      {frame >= 104 && (
        <>
          {/* the specimen */}
          <AbsoluteFill style={{alignItems: 'center'}}>
            <div
              style={{
                marginTop: 540,
                width: 660,
                borderRadius: 16,
                background: C.panel,
                border: `1.5px solid ${C.hairline2}`,
                boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
                padding: '38px 44px',
                display: 'flex',
                flexDirection: 'column',
                gap: 26,
                opacity: Math.min(cardIn * 2, 1),
                transform: `translateY(${(1 - Math.min(cardIn, 1)) * 90}px)`,
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <Redact cash scale={1.15} />
                <Chip size={23} color={C.muted} border={C.hairline}>
                  UNKNOWN
                </Chip>
              </div>
              <div style={{fontFamily: F.mono, fontSize: 25, letterSpacing: '0.1em', color: C.muted}}>
                SMALL CAP · MARKET CAP $2.1B
              </div>
            </div>
          </AbsoluteFill>

          {/* the scan beam */}
          <div
            style={{
              position: 'absolute',
              left: 190,
              width: 700,
              top: beamY,
              height: 60,
              background: `linear-gradient(180deg, transparent, ${LAB}44 45%, ${LAB}66 50%, ${LAB}44 55%, transparent)`,
              opacity: beamOp,
              pointerEvents: 'none',
            }}
          />

          {/* six markers tick in */}
          <AbsoluteFill style={{alignItems: 'center'}}>
            <div
              style={{
                marginTop: 880,
                width: 780,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 20,
              }}
            >
              {GENES.map((g, i) => {
                const at = 144 + i * 8;
                const s = pop(frame, at, 13, 0.85);
                const op = lerp(frame, [at, at + 7], [0, 1]);
                return (
                  <div key={g} style={{opacity: op, transform: `scale(${0.85 + 0.15 * Math.min(s, 1)})`}}>
                    <Chip size={25} color={BIO} border={`${BIO}66`} bg={`${BIO}0e`}>
                      ✓ {g}
                    </Chip>
                  </div>
                );
              })}
            </div>
          </AbsoluteFill>

          {/* the verdict of the lab (not of the desk) */}
          <AbsoluteFill style={{alignItems: 'center'}}>
            <div style={{marginTop: 1170, opacity: matchOp, transform: `scale(${0.85 + 0.15 * Math.min(matchS, 1)})`}}>
              <Chip
                size={27}
                color={BIO}
                border={`${BIO}aa`}
                bg={`${BIO}12`}
                style={{boxShadow: `0 0 26px ${BIO}44`}}
              >
                GENOME MATCH · 6 / 6 MARKERS
              </Chip>
            </div>
          </AbsoluteFill>
        </>
      )}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 260}}>
          <Kinetic
            text={'The scout hunts trillion-dollar DNA —\nbefore the trillion.'}
            delay={212}
            size={44}
            accents={{3: C.discovery}}
          />
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/** DN4 — the desk: a match opens a case; three blind lenses close it. */
export const DN4_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'A match opens a case.'} delay={8} size={62} accents={{1: BIO}} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={52}
      stag={18}
      verdictAt={124}
      foot="MATCHED · THEN ATTACKED BLIND · THEN SCORED"
      footAt={156}
      top={620}
    />
  </Void>
);

/** DN5 — endcard. */
export const DN5_End: React.FC = () => <FunEndcard gag="SIX MARKERS · CHECKED" />;
