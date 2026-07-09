import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Kinetic, Void} from '../../lib/ui';
import {VBraid, VEmbers, VFlash, VThreads} from '../vbraid';
import {easeInOut, lerp} from '../../lib/anim';
import {C} from '../../theme';

export const V_FUSE_AT = 108;

/** V10 — convergence, portrait: four signals fall, bend, and fuse into gold. */
export const V10_Fusion: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = lerp(frame, [4, 40], [0, 1], easeInOut);
  const calm = lerp(frame, [86, V_FUSE_AT - 2], [0, 1]);
  const braidReveal = lerp(frame, [V_FUSE_AT + 2, 150], [0, 1], easeInOut);
  return (
    <Void depth>
      <VThreads
        t={frame}
        reveal={reveal}
        calm={calm}
        packets={frame > 42}
        labelOp={lerp(frame, [12, 26], [0, 1])}
      />
      <VBraid t={frame} reveal={braidReveal} />
      <VEmbers t={frame} reveal={braidReveal} />
      <VFlash t={frame} at={V_FUSE_AT} />
      <AbsoluteFill style={{alignItems: 'center'}}>
        <div style={{marginTop: 250}}>
          <Kinetic
            text={'When independent\nmethods agree —'}
            delay={34}
            size={64}
            out={V_FUSE_AT + 4}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 290}}>
          <Kinetic
            text="— agreement is the signal."
            delay={V_FUSE_AT + 12}
            size={58}
            accents={{4: C.confluence}}
            maxWidth={960}
          />
        </div>
      </AbsoluteFill>
    </Void>
  );
};
