import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Kinetic, Void} from '../lib/ui';
import {lerp} from '../lib/anim';
import {C} from '../theme';

const BOXES = [
  {x: 360, color: C.fundamentals, fx: 0.11, fy: 0.161, ph: 0.4},
  {x: 780, color: C.macro, fx: 0.093, fy: 0.137, ph: 2.2},
  {x: 1200, color: C.consensus, fx: 0.127, fy: 0.101, ph: 4.1},
];
const BOX_Y = 280;
const BOX_S = 360;

/** S15 — Blind by design: three processes, three sealed boxes, white light. */
export const S15_Blind: React.FC = () => {
  const frame = useCurrentFrame();
  const settle = lerp(frame, [116, 144], [1, 0.16]);
  return (
    <Void light>
      {BOXES.map((b, bi) => {
        const boxOp = lerp(frame, [2 + bi * 4, 14 + bi * 4], [0, 1]);
        const cx = b.x + BOX_S / 2;
        const cy = BOX_Y + BOX_S / 2;
        const posAt = (f: number): [number, number] => {
          const amp = f > 116 ? lerp(f, [116, 144], [1, 0.16]) : 1;
          return [
            cx + Math.sin(f * b.fx + b.ph) * 118 * amp,
            cy + Math.sin(f * b.fy + b.ph * 1.7) * 118 * amp,
          ];
        };
        const trail: string[] = [];
        for (let k = 44; k >= 0; k -= 2) {
          const pf = frame - k;
          if (pf < 18) continue;
          const [tx, ty] = posAt(pf);
          trail.push(`${tx.toFixed(1)},${ty.toFixed(1)}`);
        }
        const [dx, dy] = posAt(Math.max(frame, 18));
        return (
          <React.Fragment key={bi}>
            <div
              style={{
                position: 'absolute',
                left: b.x,
                top: BOX_Y,
                width: BOX_S,
                height: BOX_S,
                borderRadius: 16,
                border: `2px solid ${C.whiteHairline}`,
                opacity: boxOp,
                background: '#ffffff55',
              }}
            />
            {/* wall between boxes */}
            {bi < 2 && (
              <div
                style={{
                  position: 'absolute',
                  left: b.x + BOX_S + 29,
                  top: BOX_Y - 30,
                  width: 2,
                  height: (BOX_S + 60) * lerp(frame, [10 + bi * 5, 26 + bi * 5], [0, 1]),
                  background: '#c3c9d4',
                }}
              />
            )}
            {frame >= 18 && (
              <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
                {trail.length > 1 && (
                  <polyline
                    points={trail.join(' ')}
                    fill="none"
                    stroke={b.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    opacity={0.3}
                  />
                )}
                <circle cx={dx} cy={dy} r={9} fill={b.color} opacity={0.95} />
              </svg>
            )}
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 764, display: 'flex', justifyContent: 'center'}}>
        <Kinetic text="The lenses never see each other." delay={58} size={72} color={C.whiteInk} />
      </div>
    </Void>
  );
};
