import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Eyebrow, Kinetic, Void} from '../lib/ui';
import {BrowserPanel} from '../lib/browser';
import {lerp, pop} from '../lib/anim';
import {C, F} from '../theme';

const SOURCES = [
  '10-K FILING',
  'Q1 CALL TRANSCRIPT',
  'BANK PT SHEET',
  'SEGMENT DATA',
  'INSIDER FORM 4',
  'CAPEX GUIDANCE',
  'PRICE FEED',
  'SHORT INTEREST',
];

/** S14 — Receipts: the dossier pans while its sources stamp in. */
export const S14_Receipts: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void>
      <BrowserPanel
        shot="stock-vrt.png"
        label="MAG8 · CONFLUENCE DOSSIER"
        x={150}
        y={96}
        w={1010}
        h={888}
        pan={[-16, -300]}
        panWindow={[14, 148]}
        appear={0}
      />

      {/* confidence pips */}
      <div style={{position: 'absolute', left: 1250, top: 130, opacity: lerp(frame, [24, 36], [0, 1])}}>
        <Eyebrow size={23}>CONFIDENCE</Eyebrow>
        <div style={{display: 'flex', gap: 10, marginTop: 14}}>
          {Array.from({length: 5}).map((_, i) => {
            const lit = i < 4;
            const at = 34 + i * 5;
            const s = pop(frame, at, 11, 0.6);
            return (
              <div
                key={i}
                style={{
                  width: 30,
                  height: 10,
                  borderRadius: 5,
                  background: lit ? C.fundamentals : 'transparent',
                  border: `1.5px solid ${lit ? C.fundamentals : C.hairline2}`,
                  opacity: lit ? 0.25 + 0.75 * s : 0.6,
                  transform: `scaleX(${0.6 + s * 0.4})`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* sources stamping in */}
      <div style={{position: 'absolute', left: 1250, top: 250}}>
        <div style={{opacity: lerp(frame, [50, 62], [0, 1])}}>
          <Eyebrow size={23}>SOURCES · CITED IN THE REPORT</Eyebrow>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20}}>
          {SOURCES.map((s, i) => {
            const at = 62 + i * 8;
            const sp = pop(frame, at, 10, 0.55);
            const op = lerp(frame, [at, at + 6], [0, 1]);
            return (
              <div
                key={s}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 18px',
                  borderRadius: 999,
                  border: `1.5px solid ${C.hairline2}`,
                  background: C.panel,
                  width: 'fit-content',
                  fontFamily: F.mono,
                  fontSize: 23,
                  letterSpacing: '0.08em',
                  color: C.ink,
                  opacity: op,
                  transform: `scale(${1.32 - sp * 0.32})`,
                  transformOrigin: 'left center',
                }}
              >
                <span style={{color: C.consensus, fontSize: 25}}>↗</span>
                {s}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{position: 'absolute', left: 1250, top: 836}}>
        <Kinetic text={'Every verdict\nshows its work.'} delay={110} size={62} align="left" />
      </div>
    </Void>
  );
};
