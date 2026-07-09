import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Kinetic, Void} from '../../lib/ui';
import {BrowserPanel} from '../../lib/browser';
import {lerp} from '../../lib/anim';
import {C, F} from '../../theme';

/**
 * V12 — receipts, portrait: the real board and a real dossier, stacked.
 * The screenshots ARE the product — pixel for pixel.
 */
export const V12_Receipts: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Void>
      <BrowserPanel
        shot="rankings.png"
        label="MAG8 · RANKINGS"
        x={70}
        y={170}
        w={940}
        h={610}
        pan={[-30, -240]}
        panWindow={[10, 100]}
        appear={2}
        glowColor={C.confluence}
      />
      <BrowserPanel
        shot="stock-vrt.png"
        label="MAG8 · CONFLUENCE DOSSIER"
        x={70}
        y={820}
        w={940}
        h={640}
        pan={[-40, -420]}
        panWindow={[60, 170]}
        appear={54}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
        <div style={{marginBottom: 250}}>
          <Kinetic text="Every verdict shows its work." delay={118} size={56} maxWidth={960} />
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 178,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 24,
          letterSpacing: '0.12em',
          color: C.dim,
          opacity: lerp(frame, [152, 166], [0, 1]),
        }}
      >
        LIVE RUNS · CITED SOURCES · GAPS DISCLOSED
      </div>
    </Void>
  );
};
