import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Center, TypeOn, Void} from '../lib/ui';
import {BUBBLES, Bubble, TrashCan} from '../lib/setpieces';
import {easeIn, easeInOut, lerp, rndIn, settle} from '../lib/anim';
import {C} from '../theme';

const CAN_X = 960;

/** S3 — Take out the trash; then the thesis types on and dissolves. */
export const S03_Trash: React.FC = () => {
  const frame = useCurrentFrame();

  // Trash can: slides up (f6–f26), holds, drops away (f88–f106).
  const canUp = settle(frame, 6);
  const canDrop = lerp(frame, [88, 106], [0, 1], easeIn);
  const canY = 1120 - canUp * 330 + canDrop * 420;

  // Text block dissolve (f157+ — held longer for read time)
  const dis = lerp(frame, [157, 178], [0, 1], easeInOut);

  return (
    <Void depth>
      {/* bubbles tumble into the can */}
      {BUBBLES.map((b) => {
        const start = 12 + b.order * 2.4;
        const t = lerp(frame, [start, start + 30], [0, 1], easeIn);
        if (t >= 1) return null;
        const dx = (CAN_X - b.x) * t;
        const dy = (canY - 40 - b.y) * t * t; // gravity-ish: accelerate down
        const spin = t * (b.order % 2 === 0 ? 150 : -130);
        const shrink = 1 - 0.72 * t;
        return (
          <React.Fragment key={b.text}>
            {/* cheap motion trail */}
            {[6, 3].map((back, gi) => {
              const tt = lerp(frame - back, [start, start + 30], [0, 1], easeIn);
              if (tt >= 1 || tt <= 0) return null;
              return (
                <Bubble
                  key={gi}
                  spec={b}
                  progress={1}
                  wobblePhase={0}
                  opacity={0.1 + gi * 0.08}
                  extraTransform={`translate(${(CAN_X - b.x) * tt}px, ${(canY - 40 - b.y) * tt * tt}px) rotate(${tt * spin}deg) scale(${1 - 0.72 * tt})`}
                />
              );
            })}
            <Bubble
              spec={b}
              progress={1}
              wobblePhase={(frame / 30) * 2.1 + b.order * 1.7}
              opacity={1 - Math.pow(t, 6)}
              extraTransform={`translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${shrink})`}
            />
          </React.Fragment>
        );
      })}

      <TrashCan x={CAN_X} y={canY} />

      {/* thesis */}
      <Center>
        <div
          style={{
            opacity: 1 - dis,
            transform: `translateY(${-16 * dis}px)`,
            filter: `blur(${8 * dis}px)`,
          }}
        >
          <TypeOn
            text={'One opinion can talk itself\ninto anything.'}
            delay={84}
            seed="s3"
            base={0.95}
            size={82}
            weight={700}
            tint={C.discovery}
          />
        </div>
        {/* dissolve particles */}
        {dis > 0 &&
          Array.from({length: 26}).map((_, i) => {
            const px = rndIn(`p${i}x`, -430, 430);
            const py = rndIn(`p${i}y`, -70, 90);
            const drift = rndIn(`p${i}d`, 30, 120);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 960 + px,
                  top: 540 + py - dis * drift,
                  width: rndIn(`p${i}s`, 2, 4.5),
                  height: rndIn(`p${i}s`, 2, 4.5),
                  borderRadius: 99,
                  background: C.ink,
                  opacity: Math.sin(Math.PI * dis) * rndIn(`p${i}o`, 0.2, 0.7),
                }}
              />
            );
          })}
      </Center>
    </Void>
  );
};
