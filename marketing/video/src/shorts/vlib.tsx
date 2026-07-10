import React, {createContext, useContext} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {Chip, Kinetic} from '../lib/ui';
import {lerp} from '../lib/anim';
import type {ShortId} from './timeline';

/** Which lens this composition deep-dives — read by V04/V13 and the deep scenes. */
export const ShortCtx = createContext<ShortId>('fundamentals');
export const useShort = () => useContext(ShortCtx);

export type LensInfo = {
  color: string;
  label: string;
  chip: string;
  ord: number;
};

export const LENS: Record<ShortId, LensInfo> = {
  fundamentals: {color: C.fundamentals, label: 'FUNDAMENTALS', chip: 'LENS 01 · FUNDAMENTALS', ord: 1},
  macro: {color: C.macro, label: 'GAME THEORY', chip: 'LENS 02 · GAME THEORY', ord: 2},
  consensus: {color: C.consensus, label: 'STREET CONSENSUS', chip: 'LENS 03 · STREET CONSENSUS', ord: 3},
};

/** Soft color key light for a lens chapter, radiating from the upper half. */
export const VKeyLight: React.FC<{color: string; opacity?: number}> = ({color, opacity = 1}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(90% 42% at 50% 30%, ${color}1c 0%, ${color}07 48%, transparent 75%)`,
      opacity,
    }}
  />
);

/**
 * Deep-dive headline block: kinetic title near the top, lens chip beneath,
 * optional mono strapline. Sized for the 1080-wide portrait stage.
 */
export const VHead: React.FC<{
  title: string;
  color: string;
  chip?: string;
  strap?: string;
  delay?: number;
  size?: number;
  top?: number;
}> = ({title, color, chip, strap, delay = 6, size = 68, top = 210}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{alignItems: 'center'}}>
      <div
        style={{
          marginTop: top,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <Kinetic text={title} delay={delay} size={size} maxWidth={950} />
        {chip && (
          <div style={{opacity: lerp(frame, [delay + 26, delay + 38], [0, 1])}}>
            <Chip color={color} border={`${color}55`} bg={`${color}0e`} size={24}>
              {chip}
            </Chip>
          </div>
        )}
        {strap && (
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 25,
              letterSpacing: '0.12em',
              color: C.muted,
              opacity: lerp(frame, [delay + 44, delay + 58], [0, 1]),
            }}
          >
            {strap}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Bottom-anchored mono footnote (the quiet system-truth line). */
export const VFoot: React.FC<{children: React.ReactNode; at: number; bottom?: number}> = ({
  children,
  at,
  bottom = 200,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end'}}>
      <div
        style={{
          marginBottom: bottom,
          fontFamily: F.mono,
          fontSize: 24,
          letterSpacing: '0.12em',
          color: C.muted,
          textAlign: 'center',
          opacity: lerp(frame, [at, at + 14], [0, 1]),
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** Redacted ticker glyph — the film never names the candidate. */
export const Redacted: React.FC<{dim?: boolean; scale?: number}> = ({dim, scale = 1}) => (
  <div style={{display: 'flex', gap: 7 * scale, alignItems: 'center'}}>
    {[24, 16, 20, 13, 18].map((w, i) => (
      <div
        key={i}
        style={{
          width: w * scale,
          height: 18 * scale,
          borderRadius: 4 * scale,
          background: dim ? 'rgba(231,234,238,0.4)' : 'rgba(231,234,238,0.85)',
          boxShadow: dim ? undefined : '0 0 8px rgba(231,234,238,0.4)',
        }}
      />
    ))}
  </div>
);
