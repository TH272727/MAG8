import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Chip, Void, WaitlistCta} from '../lib/ui';
import {lerp, pop, pulse01} from '../lib/anim';
import {C, F} from '../theme';

/**
 * Shared pieces for the fun campaign shorts. Same brand system as the film —
 * gold stays reserved for verdicts, public lens vocabulary only.
 */

export const LENS_ROWS: Array<{label: string; color: string}> = [
  {label: 'FUNDAMENTALS', color: C.fundamentals},
  {label: 'GAME THEORY', color: C.macro},
  {label: 'STREET CONSENSUS', color: C.consensus},
];

/**
 * The compressed "three methods, one verdict" instrument: three lens chips
 * stamp in with their read, then the score lands under them in gold.
 */
export const DeskStamps: React.FC<{
  at: number;
  stag?: number;
  verdictAt: number;
  glyphs?: [string, string, string];
  score?: string;
  confluence?: boolean;
  /** Custom verdict chip (renders in the confluence slot when confluence=false). */
  chip?: string;
  chipColor?: string;
  foot?: string;
  footAt?: number;
  top?: number;
}> = ({
  at,
  stag = 20,
  verdictAt,
  glyphs = ['▲', '▲', '▲'],
  score = '90.3',
  confluence = true,
  chip,
  chipColor = C.danger,
  foot,
  footAt,
  top = 640,
}) => {
  const frame = useCurrentFrame();
  const scoreIn = pop(frame, verdictAt, 13, 0.9);
  const scoreOp = lerp(frame, [verdictAt, verdictAt + 8], [0, 1]);
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div style={{marginTop: top, display: 'flex', flexDirection: 'column', gap: 26, width: 700}}>
        {LENS_ROWS.map((l, i) => {
          const s = pop(frame, at + i * stag, 12, 0.85);
          const op = lerp(frame, [at + i * stag, at + i * stag + 8], [0, 1]);
          return (
            <div
              key={l.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: C.panel,
                border: `1.5px solid ${C.hairline}`,
                borderRadius: 14,
                padding: '26px 34px',
                opacity: op,
                transform: `translateY(${(1 - s) * 40}px) rotate(${(1 - s) * -3}deg)`,
                boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
              }}
            >
              <Chip color={l.color} border={`${l.color}55`} bg={`${l.color}0e`} size={26}>
                {l.label}
              </Chip>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 49,
                  fontWeight: 700,
                  color: l.color,
                  lineHeight: 1,
                }}
              >
                {glyphs[i]}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 54,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 26,
          opacity: scoreOp,
          transform: `scale(${0.8 + Math.min(scoreIn, 1) * 0.2})`,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 150,
            fontWeight: 700,
            color: C.confluence,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 40px ${C.confluence}55, 0 0 120px ${C.confluence}22`,
          }}
        >
          {score}
        </div>
        {confluence && (
          <Chip
            size={23}
            color={C.confluence}
            border={`${C.confluence}88`}
            bg={`${C.confluence}10`}
            style={{boxShadow: `0 0 14px ${C.confluence}22`, opacity: lerp(frame, [verdictAt + 14, verdictAt + 26], [0, 1])}}
          >
            CONFLUENCE — ALL THREE AGREE
          </Chip>
        )}
        {!confluence && chip && (
          <Chip
            size={23}
            color={chipColor}
            border={`${chipColor}88`}
            bg={`${chipColor}10`}
            style={{boxShadow: `0 0 14px ${chipColor}22`, opacity: lerp(frame, [verdictAt + 14, verdictAt + 26], [0, 1])}}
          >
            {chip}
          </Chip>
        )}
      </div>

      {foot && (
        <div
          style={{
            position: 'absolute',
            bottom: 240,
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: '0.12em',
            color: C.muted,
            textAlign: 'center',
            opacity: lerp(frame, [footAt ?? verdictAt + 30, (footAt ?? verdictAt + 30) + 14], [0, 1]),
          }}
        >
          {foot}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Simplified leaderboard row for the fun shorts (rank · redacted · score). */
export const MiniRow: React.FC<{
  y: number;
  rank: string;
  score: string;
  at: number;
  note?: string;
}> = ({y, rank, score, at, note}) => {
  const frame = useCurrentFrame();
  const s = pop(frame, at, 13, 0.9);
  const op = lerp(frame, [at, at + 10], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        top: y,
        width: 900,
        height: 96,
        background: C.panel,
        border: `1.5px solid ${C.hairline2}`,
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        padding: '0 30px',
        opacity: op,
        transform: `translateY(${(1 - s) * 30}px)`,
      }}
    >
      <span style={{fontFamily: F.mono, fontSize: 30, color: C.muted}}>{rank}</span>
      <Redact cash />
      {note && (
        <Chip size={20} color={C.muted} border={C.hairline}>
          {note}
        </Chip>
      )}
      <div style={{flex: 1}} />
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 41,
          fontWeight: 700,
          color: 'rgba(242,199,92,0.6)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score}
      </span>
    </div>
  );
};

/** Redacted ticker glyph (local copy — the shorts never name the candidate).
 * `cash` prefixes a $ so the bars read as a stock ticker at first glance. */
export const Redact: React.FC<{dim?: boolean; scale?: number; cash?: boolean}> = ({
  dim,
  scale = 1,
  cash,
}) => (
  <div style={{display: 'flex', gap: 7 * scale, alignItems: 'center'}}>
    {cash && (
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 30 * scale,
          fontWeight: 700,
          lineHeight: 1,
          color: dim ? 'rgba(231,234,238,0.4)' : 'rgba(231,234,238,0.75)',
          textShadow: dim ? undefined : '0 0 8px rgba(231,234,238,0.35)',
        }}
      >
        $
      </span>
    )}
    {[24, 16, 20, 13, 18].map((w, i) => (
      <div
        key={i}
        style={{
          width: w * scale,
          height: 18 * scale,
          borderRadius: 4 * scale,
          background: dim ? 'rgba(231,234,238,0.4)' : 'rgba(231,234,238,0.85)',
          boxShadow: dim ? undefined : '0 0 8px rgba(231,234,238,0.4)',
        }}
      />
    ))}
  </div>
);

/** Endcard for the fun campaign (168f): mark, wordmark, gag chip, the
 * waitlist CTA in big type, the disclaimer. */
export const FunEndcard: React.FC<{gag: string}> = ({gag}) => {
  const frame = useCurrentFrame();
  const markIn = pop(frame, 6, 14, 1);
  const beat = Math.max(pulse01((frame - 56) / 26), pulse01((frame - 118) / 26));
  const fadeOut = lerp(frame, [155, 168], [0, 1]);
  return (
    <Void depth>
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div
          style={{
            marginTop: 520,
            opacity: Math.min(markIn * 1.3, 1),
            transform: `scale(${0.82 + markIn * 0.18})`,
            filter:
              'drop-shadow(0 0 1px rgba(231,234,238,0.62)) drop-shadow(0 0 6px rgba(231,234,238,0.26)) drop-shadow(0 0 18px rgba(231,234,238,0.10))',
          }}
        >
          <Img src={staticFile('brand/mark.png')} style={{width: 140, height: 140}} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 34,
            opacity: lerp(frame, [22, 40], [0, 1]),
          }}
        >
          <span
            style={{
              fontFamily: F.display,
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: C.ink,
              lineHeight: 1,
            }}
          >
            MAG8
          </span>
          <span
            style={{
              display: 'inline-block',
              width: 20,
              height: 20,
              borderRadius: 99,
              background: C.confluence,
              marginLeft: 2,
              transform: `scale(${1 + beat * 0.4})`,
              boxShadow: `0 0 ${16 + beat * 30}px ${C.confluence}88`,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 32,
            fontFamily: F.body,
            fontSize: 38,
            fontWeight: 400,
            color: C.muted,
            opacity: lerp(frame, [42, 58], [0, 1]),
          }}
        >
          The next trillion-dollar leaderboard.
        </div>

        <div style={{marginTop: 46, opacity: lerp(frame, [66, 82], [0, 1])}}>
          <Chip color={C.ink} border={C.hairline2} bg={C.panel} size={23}>
            {gag}
          </Chip>
        </div>

        <div style={{marginTop: 96}}>
          <WaitlistCta at={86} />
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 190,
            fontFamily: F.mono,
            fontSize: 22,
            letterSpacing: '0.16em',
            color: C.muted,
            opacity: lerp(frame, [104, 120], [0, 1]),
          }}
        >
          RESEARCH, NOT INVESTMENT ADVICE
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: fadeOut, pointerEvents: 'none'}} />
    </Void>
  );
};
