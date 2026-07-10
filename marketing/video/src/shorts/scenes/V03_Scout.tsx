import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {Chip, Kinetic, Void} from '../../lib/ui';
import {easeInOut, lerp} from '../../lib/anim';
import {C} from '../../theme';
import {VBLOCKS, VCHOSEN_IDS, vThreadPath} from '../vscout';
import {VH, VW} from '../timeline';

/** V03 — the scout: a violet beam sweeps DOWN the index; eight names lift. */
export const V03_Scout: React.FC = () => {
  const frame = useCurrentFrame();
  const beamY = lerp(frame, [14, 84], [560, 1480], easeInOut);
  const beamOp = lerp(frame, [10, 20], [0, 1]) * lerp(frame, [80, 96], [1, 0]);
  const fieldDim = lerp(frame, [88, 106], [1, 0.4]);
  const thread = vThreadPath();
  const threadDraw = evolvePath(lerp(frame, [84, 116], [0, 1], easeInOut), thread);

  return (
    <Void>
      {/* index field */}
      {VBLOCKS.map((b) => {
        const chosen = VCHOSEN_IDS.includes(b.id);
        const passed = beamY > b.y;
        const near = Math.exp(-((b.y - beamY) ** 2) / (2 * 85 ** 2));
        const lift = chosen && passed ? 1 : near * 0.55;
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
              boxShadow:
                chosen && passed
                  ? '0 0 16px rgba(139,124,255,0.6), 0 0 4px rgba(139,124,255,0.85)'
                  : undefined,
            }}
          />
        );
      })}

      {/* scanner beam — a horizontal blade falling through the field */}
      <AbsoluteFill style={{pointerEvents: 'none', opacity: beamOp}}>
        <div
          style={{
            position: 'absolute',
            top: beamY - 110,
            left: 70,
            width: 940,
            height: 220,
            background:
              'linear-gradient(180deg, transparent 0%, rgba(139,124,255,0.14) 38%, rgba(139,124,255,0.30) 50%, rgba(139,124,255,0.14) 62%, transparent 100%)',
            filter: 'blur(2px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: beamY - 1.5,
            left: 70,
            width: 940,
            height: 3,
            background: 'rgba(139,124,255,0.75)',
            filter: 'blur(0.5px)',
            boxShadow: '0 0 18px rgba(139,124,255,0.8)',
          }}
        />
      </AbsoluteFill>

      {/* cohort thread */}
      <svg width={VW} height={VH} style={{position: 'absolute', inset: 0}}>
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
        <div style={{marginTop: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
          <Kinetic text={'First, a scout hunts\ntrillion-dollar DNA —\nbefore the trillion.'} delay={20} size={68} />
          <div style={{opacity: lerp(frame, [96, 108], [0, 1])}}>
            <Chip color={C.discovery} border="rgba(139,124,255,0.45)" bg="rgba(139,124,255,0.08)" size={24}>
              DISCOVERY SCOUT · 8 CANDIDATES
            </Chip>
          </div>
        </div>
      </AbsoluteFill>
    </Void>
  );
};
