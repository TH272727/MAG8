import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Instrument, LensScene, Roll, ReadoutRow} from '../lib/lens';
import {easeOut, lerp, pop} from '../lib/anim';
import {C, F} from '../theme';
import {Void} from '../lib/ui';

const G = C.fundamentals;
const BARS = [0.44, 0.68, 0.5, 0.84, 0.6, 0.9, 0.72];
const CHECKS = ['balance sheet', 'unit economics', 'cash conversion', 'dilution watch', 'segment notes'];

/** S7 — Lens one: Fundamentals reads the books. */
export const S07_Fundamentals: React.FC = () => {
  const frame = useCurrentFrame();
  const needle = -108 + pop(frame, 26, 15, 1.1) * 156; // sweeps to +48°
  return (
    <Void>
      <LensScene color={G} chipLabel="LENS 01 · FUNDAMENTALS" headline={'Fundamentals\nreads the books.'} slideOutAt={155}>
        {/* balance-sheet bars */}
        <Instrument x={0} y={30} w={440} h={310} label="LEDGER" appear={8}>
          <svg width={392} height={210}>
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1={0} x2={392} y1={210 - g * 200} y2={210 - g * 200} stroke={C.hairline} strokeWidth={1} />
            ))}
            {BARS.map((h, i) => {
              const t = lerp(frame, [16 + i * 4, 40 + i * 4], [0, 1], easeOut);
              const bh = h * 195 * t;
              return (
                <g key={i}>
                  <rect x={14 + i * 55} y={210 - bh} width={36} height={bh} rx={4} fill={`${G}2e`} stroke={`${G}88`} strokeWidth={1.5} />
                  <rect x={14 + i * 55} y={210 - bh} width={36} height={Math.min(7, bh)} rx={3} fill={G} opacity={0.9} />
                </g>
              );
            })}
            <line x1={0} x2={392} y1={210} y2={210} stroke={C.hairline2} strokeWidth={1.5} />
          </svg>
        </Instrument>

        {/* quality gauge */}
        <Instrument x={480} y={0} w={430} h={340} label="QUALITY GAUGE" appear={16}>
          <svg width={386} height={230} viewBox="0 0 386 230">
            <path d="M 43 205 A 150 150 0 0 1 343 205" fill="none" stroke={C.hairline2} strokeWidth={11} strokeLinecap="round" />
            <path
              d="M 43 205 A 150 150 0 0 1 343 205"
              fill="none"
              stroke={G}
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={471}
              strokeDashoffset={471 - 471 * lerp(frame, [26, 62], [0, 0.78], easeOut)}
              opacity={0.85}
              style={{filter: `drop-shadow(0 0 6px ${G}66)`}}
            />
            {/* needle */}
            <g transform={`rotate(${needle} 193 205)`}>
              <line x1={193} y1={205} x2={193} y2={78} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
            </g>
            <circle cx={193} cy={205} r={10} fill={C.panel2} stroke={C.hairline2} strokeWidth={2} />
          </svg>
          <div style={{position: 'absolute', right: 4, top: 4, fontFamily: F.mono}}>
            <Roll target={8.6} delay={30} size={34} color={G} suffix=" / 10" />
          </div>
        </Instrument>

        {/* rolling tape */}
        <Instrument x={0} y={380} w={440} h={290} label="TAPE" appear={26}>
          <ReadoutRow label="GROSS MARGIN" delay={30}>
            <Roll target={61.4} delay={32} suffix="%" />
          </ReadoutRow>
          <ReadoutRow label="FCF YIELD" delay={38}>
            <Roll target={3.8} delay={40} suffix="%" />
          </ReadoutRow>
          <ReadoutRow label="NET CASH" delay={46}>
            <Roll target={2.4} delay={48} prefix="$" suffix="B" />
          </ReadoutRow>
          <ReadoutRow label="REV CAGR 3Y" delay={54}>
            <Roll target={38.2} delay={56} suffix="%" />
          </ReadoutRow>
        </Instrument>

        {/* checklist */}
        <Instrument x={480} y={380} w={430} h={290} label="CHECKS" appear={34}>
          {CHECKS.map((label, i) => {
            const at = 46 + i * 9;
            const on = frame >= at;
            const s = pop(frame, at, 11, 0.6);
            return (
              <div key={label} style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 11}}>
                <svg width={24} height={24} style={{transform: `scale(${0.8 + s * 0.2})`}}>
                  <rect x={1.5} y={1.5} width={21} height={21} rx={5} fill={on ? `${G}18` : 'transparent'} stroke={on ? G : C.hairline2} strokeWidth={2} />
                  {on && (
                    <path d="M 6 12.5 L 10.5 17 L 18 7.5" fill="none" stroke={G} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={20} strokeDashoffset={20 - 20 * Math.min((frame - at) / 7, 1)} />
                  )}
                </svg>
                <span style={{fontFamily: F.mono, fontSize: 19, color: on ? C.ink : C.dim, letterSpacing: '0.04em'}}>
                  {label}
                </span>
              </div>
            );
          })}
        </Instrument>
      </LensScene>
    </Void>
  );
};
