import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Kinetic, Void} from '../lib/ui';
import {BLOCKS, CHOSEN_IDS, threadPath} from '../lib/scout';
import {easeInOut, easeOut, lerp, pop} from '../lib/anim';
import {C, F} from '../theme';

const LANES = [
  {cx: 480, label: 'FUNDAMENTALS', color: C.fundamentals},
  {cx: 960, label: 'MACRO ASYMMETRY', color: C.macro},
  {cx: 1440, label: 'STREET CONSENSUS', color: C.consensus},
];
const WALL_X = [240, 720, 1200, 1680];
const CHIP_Y = 520;

const CandidateChip: React.FC<{opacity?: number; glow?: number}> = ({opacity = 1, glow = 1}) => (
  <div
    style={{
      width: 196,
      height: 66,
      borderRadius: 12,
      background: C.panel,
      border: '1.5px solid rgba(139,124,255,0.65)',
      boxShadow: `0 0 ${22 * glow}px rgba(139,124,255,0.35), 0 14px 40px rgba(0,0,0,0.5)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      opacity,
    }}
  >
    {[22, 15, 19, 12, 17].map((w, i) => (
      <div
        key={i}
        style={{width: w, height: 17, borderRadius: 4, background: 'rgba(231,234,238,0.82)', boxShadow: '0 0 8px rgba(231,234,238,0.45)'}}
      />
    ))}
  </div>
);

/** S6 — Blind lanes: the cohort becomes one candidate, copied into three sealed lanes. */
export const S06_Lanes: React.FC = () => {
  const frame = useCurrentFrame();
  const fieldFade = lerp(frame, [0, 16], [0.4, 0]);
  const converge = lerp(frame, [6, 30], [0, 1], easeInOut);
  const chipIn = pop(frame, 24, 13, 0.8);
  const splitT = lerp(frame, [40, 62], [0, 1], easeInOut);
  const wallsT = lerp(frame, [34, 56], [0, 1], easeOut);
  const centerChipOp = splitT > 0 ? Math.max(1 - splitT * 2.2, 0) : chipIn;

  return (
    <Void>
      {/* residual field + thread fading out */}
      <AbsoluteFill style={{opacity: fieldFade}}>
        {BLOCKS.filter((b) => !CHOSEN_IDS.includes(b.id)).map((b) => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x - 9,
              top: b.y - 9,
              width: 18,
              height: 18,
              borderRadius: 4.5,
              background: '#1a2030',
              border: '1.5px solid rgba(64,74,100,0.6)',
              opacity: 0.55 + b.jitter * 0.45,
            }}
          />
        ))}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          <path d={threadPath()} fill="none" stroke={C.discovery} strokeWidth={2} opacity={0.7} />
        </svg>
      </AbsoluteFill>

      {/* chosen blocks converging into the candidate chip */}
      {converge < 1 &&
        BLOCKS.filter((b) => CHOSEN_IDS.includes(b.id)).map((b) => {
          const x = b.x + (960 - b.x) * converge;
          const y = b.y + (CHIP_Y - b.y) * converge;
          return (
            <div
              key={b.id}
              style={{
                position: 'absolute',
                left: x - 9,
                top: y - 9,
                width: 18,
                height: 18,
                borderRadius: 4.5,
                background: '#1e2440',
                border: `1.5px solid ${C.discovery}`,
                boxShadow: '0 0 16px rgba(139,124,255,0.6)',
                opacity: 1 - Math.pow(converge, 3) * 0.9,
              }}
            />
          );
        })}

      {/* lane walls */}
      {WALL_X.map((x, i) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            left: x,
            top: 120,
            width: 1.5,
            height: 840 * lerp(frame, [34 + i * 4, 56 + i * 4], [0, 1], easeOut),
            background: C.hairline2,
            opacity: 0.9,
          }}
        />
      ))}

      {/* lane labels */}
      {LANES.map((lane, i) => (
        <div
          key={lane.label}
          style={{
            position: 'absolute',
            left: lane.cx,
            top: 170,
            transform: `translateX(-50%) scale(${pop(frame, 58 + i * 6, 12, 0.7)})`,
            opacity: lerp(frame, [58 + i * 6, 66 + i * 6], [0, 1]),
          }}
        >
          <Chip color={lane.color} border={`${lane.color}55`} bg={`${lane.color}10`}>
            {lane.label}
          </Chip>
        </div>
      ))}

      {/* center candidate chip */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: CHIP_Y,
          transform: `translate(-50%, -50%) scale(${0.6 + chipIn * 0.4})`,
        }}
      >
        <CandidateChip opacity={centerChipOp} />
      </div>

      {/* three copies sliding into lanes */}
      {splitT > 0 &&
        LANES.map((lane, i) => {
          const x = 960 + (lane.cx - 960) * splitT;
          return (
            <div
              key={lane.label}
              style={{
                position: 'absolute',
                left: x,
                top: CHIP_Y,
                transform: 'translate(-50%, -50%)',
                opacity: Math.min(splitT * 3, 1),
              }}
            >
              <CandidateChip glow={0.7} />
            </div>
          );
        })}

      {/* probes with trails */}
      {LANES.map((lane, li) => {
        const probeOn = lerp(frame, [66, 76], [0, 1]);
        if (probeOn <= 0) return null;
        return (
          <React.Fragment key={lane.label}>
            {Array.from({length: 18}).map((_, k) => {
              const pf = frame - k;
              if (pf < 66) return null;
              const px = lane.cx + 158 * Math.sin(pf * 0.085 + li * 2.1);
              const py = CHIP_Y + 20 + 118 * Math.sin(pf * 0.132 + li * 2.7 + 1.2);
              const fade = 1 - k / 18;
              return (
                <div
                  key={k}
                  style={{
                    position: 'absolute',
                    left: px,
                    top: py,
                    width: k === 0 ? 9 : 6 * fade + 1,
                    height: k === 0 ? 9 : 6 * fade + 1,
                    borderRadius: 99,
                    background: lane.color,
                    opacity: probeOn * (k === 0 ? 0.95 : fade * 0.28),
                    boxShadow: k === 0 ? `0 0 16px ${lane.color}` : undefined,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })}
          </React.Fragment>
        );
      })}

      {/* headline */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 258}}>
          <Kinetic text="Three lenses. Working blind." delay={96} size={80} />
        </div>
      </AbsoluteFill>

      {/* footnote: identical copies */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div
          style={{
            marginBottom: 120,
            fontFamily: F.mono,
            fontSize: 19,
            letterSpacing: '0.1em',
            color: C.dim,
            opacity: lerp(frame, [112, 126], [0, 1]),
          }}
        >
          SAME CANDIDATE · THREE SEALED ROOMS
        </div>
      </AbsoluteFill>
    </Void>
  );
};
