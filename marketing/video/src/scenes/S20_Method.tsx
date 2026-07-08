import React from 'react';
import {useCurrentFrame} from 'remotion';
import {TypeOn, Void} from '../lib/ui';
import {easeInOut, easeOut, lerp, pop} from '../lib/anim';
import {C, F} from '../theme';

const SEGS = [C.discovery, C.fundamentals, C.macro, C.consensus];

/** S20 — Not hype. Not luck. Method. */
export const S20_Method: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = lerp(frame, [4, 44], [0, 1], easeOut);
  const glide = lerp(frame, [80, 100], [0, 1], easeInOut);
  const dotPop = pop(frame, 124, 12, 0.7);
  return (
    <Void depth>
      {/* the discarded explanations */}
      <div
        style={{
          position: 'absolute',
          left: 430 - drift * 260,
          top: 500,
          fontFamily: F.display,
          fontSize: 84,
          fontWeight: 600,
          color: C.dim,
          opacity: 0.55 * (1 - drift),
          filter: `blur(${drift * 12}px)`,
        }}
      >
        Hype.
      </div>
      <div
        style={{
          position: 'absolute',
          right: 430 - drift * 260,
          top: 500,
          fontFamily: F.display,
          fontSize: 84,
          fontWeight: 600,
          color: C.dim,
          opacity: 0.55 * (1 - drift),
          filter: `blur(${drift * 12}px)`,
        }}
      >
        Luck.
      </div>

      {/* the keeper */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 468 - glide * 64,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <TypeOn text="Method." delay={34} seed="s20" base={3.4} size={124} weight={700} tint={C.discovery} />
      </div>

      {/* signature line: four colors fuse to gold */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 634, display: 'flex', justifyContent: 'center', opacity: Math.min(glide * 2, 1)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 0}}>
          {SEGS.map((c, i) => (
            <div
              key={c}
              style={{
                width: 92,
                height: 3,
                background: c,
                transform: `scaleX(${lerp(frame, [88 + i * 7, 100 + i * 7], [0, 1], easeOut)})`,
                transformOrigin: 'left center',
                opacity: 0.9,
              }}
            />
          ))}
          <div
            style={{
              width: 210,
              height: 3,
              background: `linear-gradient(90deg, ${C.confluence}, ${C.confluence})`,
              transform: `scaleX(${lerp(frame, [116, 130], [0, 1], easeOut)})`,
              transformOrigin: 'left center',
              boxShadow: `0 0 12px ${C.confluence}66`,
            }}
          />
          <div
            style={{
              width: 15,
              height: 15,
              marginLeft: 8,
              borderRadius: 99,
              background: C.confluence,
              transform: `scale(${dotPop})`,
              boxShadow: `0 0 18px ${C.confluence}88`,
            }}
          />
        </div>
      </div>
    </Void>
  );
};
