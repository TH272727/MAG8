import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Kinetic, Void} from '../lib/ui';
import {Braid, Embers, Flash, Threads} from '../lib/braid';
import {easeInOut, lerp} from '../lib/anim';

export const FUSE_AT = 124;

/** S10 — Convergence: four independent signals bend toward one node and fuse. */
export const S10_Convergence: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = lerp(frame, [6, 44], [0, 1], easeInOut);
  const calm = lerp(frame, [98, FUSE_AT - 2], [0, 1]);
  const braidReveal = lerp(frame, [FUSE_AT + 2, 168], [0, 1], easeInOut);
  return (
    <Void depth>
      <Threads
        t={frame}
        reveal={reveal}
        calm={calm}
        packets={frame > 46}
        labelOp={lerp(frame, [16, 30], [0, 1])}
      />
      <Braid t={frame} reveal={braidReveal} />
      <Embers t={frame} reveal={braidReveal} />
      <Flash t={frame} at={FUSE_AT} />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 108}}>
          <Kinetic
            text="When independent methods agree —"
            delay={56}
            size={66}
            out={164}
          />
        </div>
      </AbsoluteFill>
    </Void>
  );
};
