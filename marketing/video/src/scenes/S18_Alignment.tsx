import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Chip, Kinetic, Void} from '../lib/ui';
import {easeOut, lerp, pop, rndIn} from '../lib/anim';
import {C} from '../theme';
import {HBar, TriDown, TriUp} from './S16_Disagree';

const GLYPH_H = 150;
const REELS = [
  {x: 660, color: C.fundamentals, land: 48, spins: 3},
  {x: 895, color: C.macro, land: 64, spins: 4},
  {x: 1130, color: C.consensus, land: 82, spins: 5},
];

/** S18 — Alignment is rare: slot reels click into ▲ ▲ ▲ and gold ignites. */
export const S18_Alignment: React.FC = () => {
  const frame = useCurrentFrame();
  const aligned = frame >= REELS[2].land;
  const chipS = pop(frame, REELS[2].land + 2, 11, 0.7);
  const bloom = lerp(frame, [REELS[2].land, REELS[2].land + 22], [1, 0], easeOut);
  return (
    <Void depth>
      {REELS.map((r, i) => {
        // roll: total strip advance lands exactly on ▲ (index 0 of [▲,─,▼])
        const t = lerp(frame, [6 + i * 5, r.land], [0, 1], easeOut);
        const total = r.spins * 3; // whole cycles → ends on ▲
        const s = total * t;
        const wrapped = ((s % 3) + 3) % 3;
        const settleBounce =
          frame > r.land
            ? -Math.abs(Math.sin((frame - r.land) * 0.55)) * Math.exp(-(frame - r.land) * 0.18) * 12
            : 0;
        const enter = pop(frame, 2 + i * 5, 13, 0.9);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: r.x,
              top: 372,
              width: GLYPH_H,
              height: GLYPH_H,
              overflow: 'hidden',
              opacity: Math.min(enter * 1.5, 1),
              transform: `scale(${0.7 + enter * 0.3})`,
            }}
          >
            <div style={{transform: `translateY(${-(wrapped * GLYPH_H) + settleBounce}px)`}}>
              {[0, 1, 2, 3].map((k) => {
                const Comp = k % 3 === 0 ? TriUp : k % 3 === 1 ? TriDown : HBar;
                return (
                  <div key={k} style={{height: GLYPH_H, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Comp size={130} color={r.color} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* gold confluence ignition */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 578,
          display: 'flex',
          justifyContent: 'center',
          opacity: Math.min(chipS * 1.5, 1),
          transform: `scale(${0.7 + chipS * 0.3})`,
        }}
      >
        <Chip
          size={26}
          color={C.confluence}
          border={`${C.confluence}aa`}
          bg={`${C.confluence}14`}
          style={{boxShadow: `0 0 ${26 + bloom * 60}px ${C.confluence}66, 0 0 6px ${C.confluence}44`}}
        >
          CONFLUENCE
        </Chip>
      </div>
      {/* ember burst on ignition */}
      {aligned &&
        Array.from({length: 14}).map((_, i) => {
          const u = Math.min((frame - REELS[2].land) / 26, 1);
          if (u >= 1) return null;
          const ang = rndIn(`ig${i}`, 0, Math.PI * 2);
          const dist = rndIn(`igd${i}`, 40, 150) * easeOut(u);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 960 + Math.cos(ang) * dist * 1.6,
                top: 604 + Math.sin(ang) * dist * 0.7,
                width: rndIn(`igs${i}`, 2.5, 4.5),
                height: rndIn(`igs${i}`, 2.5, 4.5),
                borderRadius: 99,
                background: C.confluence,
                opacity: (1 - u) * 0.85,
              }}
            />
          );
        })}

      <div style={{position: 'absolute', left: 0, right: 0, top: 706, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
        <Kinetic text="Alignment is rare." delay={94} size={76} />
        <Kinetic text="That's the point." delay={120} size={76} color={C.muted} />
      </div>
    </Void>
  );
};
