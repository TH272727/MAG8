import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Chip, Eyebrow, Grain, Kinetic, Void} from '../../lib/ui';
import {lerp, pop, settle, smooth} from '../../lib/anim';
import {C, F} from '../../theme';
import {DeskStamps, FunEndcard, Redact} from '../flib';

/**
 * ENGINE SPECIAL (game theory) — "The table."
 * The market as a poker table: four players scored M×E×C, the pot-committed
 * incumbent's forced move (with base rates), the mispriced hand, and the
 * kill condition. You don't read minds — you read incentives.
 * Episode palette (felt green, card cream) lives only inside this episode;
 * copper stays the game-theory accent, per the house law. Desk and endcard
 * return to house dark.
 */

const FELT = '#0f3d2e';
const FELT_DEEP = '#0a2b21';
const RAIL = '#43301f';

/** Soft felt-green wash that tints the void for the table chapter. */
const FeltWash: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(90% 70% at 50% 52%, ${FELT}59 0%, ${FELT_DEEP}30 55%, transparent 78%)`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

const SEATS: Array<{name: string; m: number; e: number; c: number}> = [
  {name: 'THE INCUMBENT', m: 9, e: 8, c: 7},
  {name: 'THE CHALLENGER', m: 6, e: 9, c: 5},
  {name: 'THE REGULATOR', m: 7, e: 6, c: 8},
  {name: 'THE SUPPLIER', m: 5, e: 7, c: 6},
];

/** PK1 — the market is a poker table. */
export const PK1_Table: React.FC = () => {
  const frame = useCurrentFrame();
  const tableIn = settle(frame, 110);
  const plates: Array<{label: string; at: number; style: React.CSSProperties}> = [
    {label: 'THE INCUMBENT', at: 128, style: {top: 520, left: '50%', transform: 'translateX(-50%)'}},
    {label: 'THE CHALLENGER', at: 136, style: {top: 1268, left: '50%', transform: 'translateX(-50%)'}},
    {label: 'THE REGULATOR', at: 144, style: {top: 880, left: 66}},
    {label: 'THE SUPPLIER', at: 152, style: {top: 880, right: 66}},
  ];
  return (
    <Void depth>
      <FeltWash opacity={lerp(frame, [104, 126], [0, 1])} />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>STOCK MARKET POKER · A GAME THEORY STORY</Eyebrow>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 640}}>
          <Kinetic text={'The market is\na poker table.'} delay={10} size={96} accents={{4: C.macro}} out={104} />
        </div>
      </AbsoluteFill>

      {frame >= 108 && (
        <>
          {/* the felt, top-down */}
          <AbsoluteFill style={{alignItems: 'center'}}>
            <div
              style={{
                marginTop: 600,
                width: 860,
                height: 600,
                borderRadius: '50%',
                border: `22px solid ${RAIL}`,
                background: `radial-gradient(ellipse at 50% 42%, ${FELT} 0%, ${FELT_DEEP} 82%)`,
                boxShadow: '0 46px 120px rgba(0,0,0,0.6), inset 0 0 90px rgba(0,0,0,0.45)',
                opacity: Math.min(tableIn * 2, 1),
                transform: `scale(${0.82 + 0.18 * Math.min(tableIn, 1)})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 740,
                  height: 480,
                  borderRadius: '50%',
                  border: '2px solid rgba(231,234,238,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* the pot */}
                <div
                  style={{
                    background: C.panel,
                    border: `1.5px solid ${C.hairline2}`,
                    borderRadius: 12,
                    padding: '26px 34px',
                    transform: `rotate(-2deg) scale(${0.8 + 0.2 * Math.min(pop(frame, 150, 12, 0.85), 1)})`,
                    opacity: lerp(frame, [150, 158], [0, 1]),
                    boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
                  }}
                >
                  <Redact cash />
                </div>
              </div>
            </div>
          </AbsoluteFill>

          {/* the seats */}
          {plates.map((p) => (
            <div
              key={p.label}
              style={{
                position: 'absolute',
                ...p.style,
                opacity: lerp(frame, [p.at, p.at + 8], [0, 1]),
              }}
            >
              <Chip size={25} color={C.ink} border={C.hairline2} bg={C.panel}>
                {p.label}
              </Chip>
            </div>
          ))}

          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
            <div
              style={{
                marginBottom: 400,
                fontFamily: F.mono,
                fontSize: 25,
                letterSpacing: '0.12em',
                color: C.muted,
                opacity: lerp(frame, [144, 156], [0, 1]),
              }}
            >
              IN THE POT: THE NEXT $NVDA-SIZED WIN
            </div>
          </AbsoluteFill>
        </>
      )}
      <Grain opacity={0.07} />
    </Void>
  );
};

/** One meter row inside a player read. */
const Meter: React.FC<{label: string; value: number; at: number}> = ({label, value, at}) => {
  const frame = useCurrentFrame();
  const fill = lerp(frame, [at, at + 22], [0, value / 10], smooth);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
      <span
        style={{
          width: 214,
          fontFamily: F.mono,
          fontSize: 25,
          letterSpacing: '0.08em',
          color: C.muted,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{flex: 1, height: 12, borderRadius: 99, background: 'rgba(231,234,238,0.10)'}}>
        <div
          style={{
            width: `${Math.max(0, fill * 100)}%`,
            height: '100%',
            borderRadius: 99,
            background: C.macro,
            boxShadow: `0 0 12px ${C.macro}66`,
          }}
        />
      </div>
      <span
        style={{
          width: 44,
          textAlign: 'right',
          fontFamily: F.mono,
          fontSize: 27,
          fontWeight: 700,
          color: C.ink,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
};

/** PK2 — every player, scored M×E×C. */
export const PK2_Reads: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void depth>
      <FeltWash />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>READ INCENTIVES, NOT FACES</Eyebrow>
        </div>
      </AbsoluteFill>

      {SEATS.map((s, i) => {
        const at = 8 + i * 14;
        const sIn = pop(frame, at, 13, 0.9);
        const op = lerp(frame, [at, at + 9], [0, 1]);
        const x = 78 + (i % 2) * 472;
        const y = 420 + Math.floor(i / 2) * 366;
        return (
          <div
            key={s.name}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 452,
              background: C.panel,
              border: `1.5px solid ${C.hairline}`,
              borderRadius: 14,
              padding: '28px 28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              opacity: op,
              transform: `translateY(${(1 - sIn) * 36}px)`,
              boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
            }}
          >
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 25,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: C.ink,
                whiteSpace: 'nowrap',
              }}
            >
              {s.name}
            </span>
            <Meter label="STACK · M" value={s.m} at={at + 16} />
            <Meter label="PRESSURE · E" value={s.e} at={at + 24} />
            <Meter label="ALLIES · C" value={s.c} at={at + 32} />
          </div>
        );
      })}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 330}}>
          <Kinetic text={'Every player, scored.'} delay={138} size={48} accents={{2: C.macro}} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 240,
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.muted,
            opacity: lerp(frame, [172, 186], [0, 1]),
          }}
        >
          MASS × ENERGY × COORDINATION · 1–10 EACH
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/* betting tree geometry */
const ROOT_XY: [number, number] = [540, 760];
const LEAVES: Array<{label: string; pct: string; x: number; win: boolean}> = [
  {label: 'RAISE', pct: '62%', x: 250, win: true},
  {label: 'CALL', pct: '28%', x: 540, win: false},
  {label: 'FOLD', pct: '10%', x: 830, win: false},
];
const LEAF_Y = 1120;
const branch = (x: number) =>
  `M ${ROOT_XY[0]} ${ROOT_XY[1] + 34} Q ${(ROOT_XY[0] + x) / 2} ${(ROOT_XY[1] + LEAF_Y) / 2 + 40} ${x} ${LEAF_Y - 44}`;

/** PK3 — the pot-committed player has exactly one move. */
export const PK3_Forced: React.FC = () => {
  const frame = useCurrentFrame();
  const ignite = lerp(frame, [136, 150], [0, 1]);
  return (
    <Void depth>
      <FeltWash />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>THE FORCED MOVE</Eyebrow>
        </div>
      </AbsoluteFill>

      {/* the spotlit seat */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            marginTop: 400,
            width: 560,
            background: C.panel,
            border: `1.5px solid ${C.hairline2}`,
            borderRadius: 14,
            padding: '30px 36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: lerp(frame, [8, 18], [0, 1]),
            transform: `translateY(${(1 - pop(frame, 8, 13, 0.9)) * 36}px)`,
            boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{fontFamily: F.mono, fontSize: 27, fontWeight: 700, letterSpacing: '0.1em', color: C.ink}}>
            THE INCUMBENT
          </span>
          <span style={{fontFamily: F.mono, fontSize: 25, color: C.macro, whiteSpace: 'nowrap'}}>M 9 · E 8 · C 7</span>
        </div>
      </AbsoluteFill>

      {/* the stamp — lands in the empty band under the seat */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 588,
          transform: `translateX(-50%) rotate(-3deg) scale(${1.45 - 0.45 * Math.min(pop(frame, 36, 11, 0.75), 1)})`,
          opacity: Math.min(pop(frame, 36, 11, 0.75) * 1.3, 1),
          whiteSpace: 'nowrap',
          padding: '12px 24px',
          border: `4px double ${C.danger}`,
          borderRadius: 8,
          fontFamily: F.mono,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: C.danger,
        }}
      >
        POT-COMMITTED
      </div>

      {/* the tree */}
      <svg viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
        {LEAVES.map((l, i) => {
          const d = branch(l.x);
          const p = evolvePath(lerp(frame, [60 + i * 10, 84 + i * 10], [0, 1], smooth), d);
          const dimmed = ignite > 0 && !l.win;
          return (
            <g key={l.label}>
              <path
                d={d}
                fill="none"
                stroke={dimmed ? C.hairline2 : 'rgba(231,234,238,0.5)'}
                strokeWidth={3.5}
                strokeDasharray={p.strokeDasharray}
                strokeDashoffset={p.strokeDashoffset}
                opacity={dimmed ? 0.5 : 1}
              />
              {l.win && ignite > 0 && (
                <path
                  d={d}
                  fill="none"
                  stroke={C.macro}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={p.strokeDasharray}
                  strokeDashoffset={p.strokeDashoffset}
                  opacity={ignite}
                  style={{filter: `drop-shadow(0 0 12px ${C.macro})`}}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* root + leaves */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: ROOT_XY[1] - 26,
          transform: 'translateX(-50%)',
          opacity: lerp(frame, [54, 64], [0, 1]),
        }}
      >
        <Chip size={26} color={C.ink} border={C.hairline2} bg={C.panel}>
          TODAY
        </Chip>
      </div>
      {LEAVES.map((l, i) => {
        const at = 84 + i * 12;
        const s = pop(frame, at, 13, 0.85);
        const op = lerp(frame, [at, at + 8], [0, 1]);
        const dimmed = ignite > 0 && !l.win;
        return (
          <div
            key={l.label}
            style={{
              position: 'absolute',
              left: l.x,
              top: LEAF_Y - 26,
              transform: `translateX(-50%) scale(${0.85 + 0.15 * Math.min(s, 1)})`,
              opacity: op * (dimmed ? 0.45 : 1),
            }}
          >
            <Chip
              size={26}
              color={l.win && ignite > 0.5 ? C.macro : C.ink}
              border={l.win && ignite > 0.5 ? `${C.macro}aa` : C.hairline2}
              bg={l.win && ignite > 0.5 ? `${C.macro}12` : C.panel}
              style={l.win && ignite > 0.5 ? {boxShadow: `0 0 20px ${C.macro}44`} : undefined}
            >
              {l.label} · {l.pct}
            </Chip>
          </div>
        );
      })}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 300}}>
          <Kinetic text={'A pot-committed player\nhas exactly one move.'} delay={158} size={46} accents={{1: C.danger}} />
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
            opacity: lerp(frame, [200, 214], [0, 1]),
          }}
        >
          FORCED MOVES ARE THE PREDICTABLE ONES
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/** PK4 — the hand is priced wrong, and the read carries a kill switch. */
export const PK4_Odds: React.FC = () => {
  const frame = useCurrentFrame();
  const meterFill = lerp(frame, [60, 92], [0, 0.85], smooth);
  const cardIn = settle(frame, 108);
  const stampS = pop(frame, 150, 11, 0.75);
  return (
    <Void depth>
      <FeltWash />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 216, opacity: lerp(frame, [4, 16], [0, 1])}}>
          <Eyebrow color={C.muted}>THE PRICE OF THE HAND</Eyebrow>
        </div>
      </AbsoluteFill>

      {/* market vs tree */}
      {[
        {at: 10, x: 90, head: 'THE MARKET SAYS', big: 'EVEN MONEY', color: C.ink},
        {at: 24, x: 560, head: 'THE TREE SAYS', big: '62 / 38', color: C.macro},
      ].map((card) => {
        const s = pop(frame, card.at, 13, 0.9);
        return (
          <div
            key={card.head}
            style={{
              position: 'absolute',
              left: card.x,
              top: 420,
              width: 430,
              height: 210,
              background: C.panel,
              border: `1.5px solid ${C.hairline}`,
              borderRadius: 14,
              padding: '30px 32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: lerp(frame, [card.at, card.at + 9], [0, 1]),
              transform: `translateY(${(1 - s) * 36}px)`,
              boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{fontFamily: F.mono, fontSize: 25, letterSpacing: '0.1em', color: C.muted}}>{card.head}</span>
            <span
              style={{
                fontFamily: F.display,
                fontSize: 46,
                fontWeight: 700,
                color: card.color,
                whiteSpace: 'nowrap',
              }}
            >
              {card.big}
            </span>
          </div>
        );
      })}

      {/* asymmetry meter */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 706, width: 800, opacity: lerp(frame, [56, 68], [0, 1])}}>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18}}>
            <span style={{fontFamily: F.mono, fontSize: 25, letterSpacing: '0.12em', color: C.muted}}>
              ASYMMETRY — HOW MISPRICED
            </span>
            <span style={{fontFamily: F.mono, fontSize: 36, fontWeight: 700, color: C.macro}}>8.5 / 10</span>
          </div>
          <div style={{height: 14, borderRadius: 99, background: 'rgba(231,234,238,0.10)'}}>
            <div
              style={{
                width: `${Math.max(0, meterFill * 100)}%`,
                height: '100%',
                borderRadius: 99,
                background: `linear-gradient(90deg, ${C.macro}88, ${C.macro})`,
                boxShadow: `0 0 18px ${C.macro}77`,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>

      {/* the falsifier */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            marginTop: 880,
            width: 740,
            background: C.panel,
            border: `1.5px solid ${C.danger}55`,
            borderRadius: 16,
            padding: '38px 46px 108px',
            position: 'relative',
            opacity: Math.min(cardIn * 2, 1),
            transform: `translateY(${(1 - Math.min(cardIn, 1)) * 110}px)`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{fontFamily: F.mono, fontSize: 25, letterSpacing: '0.12em', color: C.muted}}>WRONG IF:</span>
          <div
            style={{
              marginTop: 22,
              fontFamily: F.mono,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.5,
              color: C.ink,
              opacity: lerp(frame, [124, 138], [0, 1]),
            }}
          >
            THE INCUMBENT FOLDS
            <br />
            THE FLAGSHIP LINE.
          </div>
          {/* stamp in the card's empty bottom band */}
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
          <Kinetic text={'A read you can’t kill\nis a superstition.'} delay={172} size={44} accents={{4: C.danger}} />
        </div>
      </AbsoluteFill>
      <Grain opacity={0.07} />
    </Void>
  );
};

/** PK5 — the desk: game theory plays it in the open. */
export const PK5_Desk: React.FC = () => (
  <Void depth>
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: 300}}>
        <Kinetic text={'Game theory plays it\nin the open.'} delay={8} size={58} accents={{0: C.macro, 1: C.macro}} />
      </div>
    </AbsoluteFill>
    <DeskStamps
      at={56}
      stag={18}
      verdictAt={126}
      foot="SEATED BY THE TRILLION-DNA SCREEN · JUDGED BLIND"
      footAt={156}
      top={660}
    />
  </Void>
);

/** PK6 — endcard. */
export const PK6_End: React.FC = () => <FunEndcard gag="NO BLUFFS · BASE RATES" />;
