import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Center, Kinetic, Void} from '../lib/ui';
import {BRAID_END, Braid, Embers, NODE, Threads} from '../lib/braid';
import {easeInOut, heartbeat, lerp, pop} from '../lib/anim';
import {C, F} from '../theme';

const T_OFF = 180; // continue braid phase from S10

/** S11 — The verdict: the braid feeds a heartbeat dot that becomes the score. */
export const S11_Verdict: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame + T_OFF;
  const dim = lerp(frame, [26, 48], [1, 0.4]);
  const beat = heartbeat(frame, 24);
  const dotIn = pop(frame, 2, 12, 0.8);
  const push = lerp(frame, [92, 150], [0, 1], easeInOut);
  const groupFade = lerp(frame, [140, 158], [1, 0]);
  const numIn = pop(frame, 146, 13, 0.9);
  const numOp = lerp(frame, [146, 154], [0, 1]);

  return (
    <Void depth>
      <AbsoluteFill
        style={{
          transform: `scale(${1 + push * 1.15})`,
          transformOrigin: `${BRAID_END}px ${NODE.y}px`,
          opacity: groupFade,
        }}
      >
        <Threads t={t} reveal={1} calm={1} packets labelOp={0.3 * dim} opacity={dim} />
        <Braid t={t} reveal={1} opacity={0.55 + 0.45 * dim} />
        <Embers t={t} reveal={1} opacity={dim} />

        {/* heartbeat rings */}
        {[0, 1].map((r) => {
          const ringT = ((frame + r * 12) % 24) / 24;
          return (
            <div
              key={r}
              style={{
                position: 'absolute',
                left: BRAID_END,
                top: NODE.y,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: `2px solid ${C.confluence}`,
                transform: `translate(-50%, -50%) scale(${1 + ringT * 2.4})`,
                opacity: (1 - ringT) * 0.4 * dotIn,
              }}
            />
          );
        })}
        {/* verdict dot */}
        <div
          style={{
            position: 'absolute',
            left: BRAID_END,
            top: NODE.y,
            width: 36,
            height: 36,
            borderRadius: 999,
            background: C.confluence,
            transform: `translate(-50%, -50%) scale(${dotIn * (1 + beat * 0.22)})`,
            boxShadow: `0 0 26px ${C.confluence}aa, 0 0 70px ${C.confluence}44`,
          }}
        />

        <AbsoluteFill style={{alignItems: 'center'}}>
          <div style={{marginTop: 250, opacity: lerp(frame, [100, 124], [1, 0])}}>
            <Kinetic
              text="— agreement is the signal."
              delay={26}
              size={74}
              accents={{4: C.confluence}}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* the score, in screen space */}
      {frame >= 146 && (
        <Center>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 236,
              fontWeight: 700,
              color: C.confluence,
              fontVariantNumeric: 'tabular-nums',
              transform: `scale(${0.72 + numIn * 0.28})`,
              opacity: numOp,
              textShadow: `0 0 40px ${C.confluence}55, 0 0 120px ${C.confluence}22`,
            }}
          >
            90.3
          </div>
        </Center>
      )}
    </Void>
  );
};
