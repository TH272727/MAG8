import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Instrument, LensScene, Roll, ReadoutRow} from '../lib/lens';
import {easeOut, heartbeat, lerp, rndIn} from '../lib/anim';
import {C, F} from '../theme';
import {Void} from '../lib/ui';

const T = C.consensus;
const N = 13;

/* Price-target brackets: vertical ranges overlapping around a consensus band. */
const BRACKETS = Array.from({length: N}, (_, i) => ({
  x: 60 + i * 62,
  y1: 205 - rndIn(`c${i}a`, 0, 125),
  y2: 305 + rndIn(`c${i}b`, 0, 135),
}));

/** S9 — Lens three: Consensus polls the street. */
export const S09_Consensus: React.FC = () => {
  const frame = useCurrentFrame();
  const merge = lerp(frame, [72, 92], [0, 1], easeOut);
  const beat = heartbeat(frame - 92, 34);
  return (
    <Void>
      <LensScene color={T} chipLabel="LENS 03 · STREET CONSENSUS" headline={'Consensus\npolls the street.'} slideOutAt={155}>
        <Instrument x={0} y={0} w={950} h={520} label="TARGET RANGES" appear={4}>
          <svg width={900} height={430} viewBox="0 0 900 500" style={{overflow: 'visible'}}>
            {/* baseline */}
            <line x1={20} y1={470} x2={880} y2={470} stroke={C.hairline2} strokeWidth={2} />
            {/* consensus band */}
            <rect
              x={30}
              y={205}
              width={840}
              height={100}
              rx={10}
              fill={T}
              opacity={merge * (0.16 + beat * 0.1)}
              style={{filter: `drop-shadow(0 0 18px ${T}55)`}}
            />
            <rect x={30} y={205} width={840} height={100} rx={10} fill="none" stroke={T} strokeWidth={2} opacity={merge * 0.85} />
            {/* marker dot */}
            <circle cx={450} cy={255} r={7 + beat * 3} fill={T} opacity={merge} style={{filter: `drop-shadow(0 0 10px ${T})`}} />
            {/* brackets */}
            {BRACKETS.map((b, i) => {
              const at = 10 + i * 3.4;
              const drop = lerp(frame, [at, at + 16], [0, 1], easeOut);
              const op = drop * (1 - merge * 0.78);
              const dy = (1 - drop) * -90;
              return (
                <g key={i} opacity={op} transform={`translate(0 ${dy})`}>
                  <line x1={b.x} y1={b.y1} x2={b.x} y2={b.y2} stroke={T} strokeWidth={2.5} />
                  <line x1={b.x - 9} y1={b.y1} x2={b.x + 9} y2={b.y1} stroke={T} strokeWidth={2.5} />
                  <line x1={b.x - 9} y1={b.y2} x2={b.x + 9} y2={b.y2} stroke={T} strokeWidth={2.5} />
                </g>
              );
            })}
          </svg>
          {/* band readout */}
          <div
            style={{
              position: 'absolute',
              right: 8,
              top: 128,
              fontFamily: F.mono,
              fontSize: 32,
              fontWeight: 600,
              color: T,
              opacity: merge,
              textShadow: `0 0 12px ${T}66`,
            }}
          >
            236 – 258
          </div>
        </Instrument>

        <Instrument x={0} y={555} w={950} h={130} label="STREET" appear={56}>
          <div style={{display: 'flex', gap: 60, alignItems: 'baseline'}}>
            <ReadoutRow label="TARGETS" delay={60}>
              <Roll target={13} decimals={0} delay={62} />
            </ReadoutRow>
            <ReadoutRow label="MEDIAN" delay={66}>
              <Roll target={247} decimals={0} delay={68} />
            </ReadoutRow>
            <ReadoutRow label="SPREAD" delay={72}>
              <Roll target={9} decimals={0} delay={74} suffix="%" color={T} />
            </ReadoutRow>
          </div>
        </Instrument>
      </LensScene>
    </Void>
  );
};
