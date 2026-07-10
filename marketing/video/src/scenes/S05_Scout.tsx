import React from 'react';
import {useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {AbsoluteFill} from 'remotion';
import {Chip, Kinetic, Void} from '../lib/ui';
import {BLOCKS, CHOSEN_IDS, threadPath} from '../lib/scout';
import {easeInOut, lerp} from '../lib/anim';
import {C, F} from '../theme';

/** S5 — The scout: a violet beam lifts eight blocks out of the index. */
export const S05_Scout: React.FC = () => {
  const frame = useCurrentFrame();
  const beamX = lerp(frame, [16, 96], [40, 1880], easeInOut);
  const beamOp = lerp(frame, [12, 22], [0, 1]) * lerp(frame, [92, 108], [1, 0]);
  const fieldDim = lerp(frame, [100, 118], [1, 0.4]);
  const thread = threadPath();
  const threadDraw = evolvePath(lerp(frame, [96, 128], [0, 1], easeInOut), thread);

  return (
    <Void>
      {/* index field */}
      {BLOCKS.map((b) => {
        const chosen = CHOSEN_IDS.includes(b.id);
        const passed = beamX > b.x;
        const near = Math.exp(-((b.x - beamX) ** 2) / (2 * 95 ** 2));
        const lift = chosen && passed ? 1 : near * 0.55;
        const litOp = chosen && passed ? 1 : 0;
        return (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x - 9,
              top: b.y - 9 - lift * 9,
              width: 18,
              height: 18,
              borderRadius: 4.5,
              background: chosen && passed ? '#1e2440' : '#1a2030',
              border: `1.5px solid ${
                chosen && passed ? C.discovery : `rgba(64,74,100,${0.6 + near * 0.4})`
              }`,
              opacity: chosen ? 1 : (0.55 + b.jitter * 0.45 + near * 0.5) * fieldDim,
              boxShadow: litOp
                ? `0 0 16px rgba(139,124,255,0.6), 0 0 4px rgba(139,124,255,0.85)`
                : undefined,
            }}
          />
        );
      })}

      {/* scanner beam */}
      <AbsoluteFill style={{pointerEvents: 'none', opacity: beamOp}}>
        <div
          style={{
            position: 'absolute',
            left: beamX - 130,
            top: 340,
            width: 260,
            height: 660,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(139,124,255,0.14) 38%, rgba(139,124,255,0.30) 50%, rgba(139,124,255,0.14) 62%, transparent 100%)',
            filter: 'blur(2px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: beamX - 1.5,
            top: 340,
            width: 3,
            height: 660,
            background: 'rgba(139,124,255,0.75)',
            filter: 'blur(0.5px)',
            boxShadow: '0 0 18px rgba(139,124,255,0.8)',
          }}
        />
      </AbsoluteFill>

      {/* cohort thread */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <path
          d={thread}
          fill="none"
          stroke="rgba(139,124,255,0.28)"
          strokeWidth={7}
          strokeDasharray={threadDraw.strokeDasharray}
          strokeDashoffset={threadDraw.strokeDashoffset}
          style={{filter: 'blur(4px)'}}
        />
        <path
          d={thread}
          fill="none"
          stroke={C.discovery}
          strokeWidth={2.5}
          strokeDasharray={threadDraw.strokeDasharray}
          strokeDashoffset={threadDraw.strokeDashoffset}
        />
      </svg>

      {/* headline */}
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 168, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
          <Kinetic text="One scout hunts trillion-dollar DNA." delay={90} size={78} />
          <div
            style={{
              fontFamily: F.body,
              fontSize: 33,
              fontWeight: 500,
              color: C.muted,
              opacity: lerp(frame, [112, 126], [0, 1]),
            }}
          >
            The traits trillion-dollar stocks had — before they became trillion-dollar stocks.
          </div>
          <div style={{opacity: lerp(frame, [122, 134], [0, 1])}}>
            <Chip color={C.discovery} border="rgba(139,124,255,0.45)" bg="rgba(139,124,255,0.08)">
              DISCOVERY SCOUT
            </Chip>
          </div>
        </div>
      </AbsoluteFill>
    </Void>
  );
};
