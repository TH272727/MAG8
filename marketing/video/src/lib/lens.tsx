import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, Eyebrow, Kinetic, Panel} from './ui';
import {easeOut, lerp} from './anim';
import {C, F} from '../theme';

/**
 * Shared stage for S7/S8/S9: color-keyed environment, instrument cluster
 * left, headline + lens chip right. Slides in from the right (the previous
 * lens slides off left) — matched to the storyboard's lateral rack move.
 */
export const LensScene: React.FC<{
  color: string;
  chipLabel: string;
  headline: string;
  slideIn?: boolean;
  slideOutAt?: number;
  children: React.ReactNode;
}> = ({color, chipLabel, headline, slideIn = true, slideOutAt, children}) => {
  const frame = useCurrentFrame();
  const inX = slideIn ? lerp(frame, [0, 14], [420, 0], easeOut) : 0;
  const inOp = slideIn ? lerp(frame, [0, 12], [0, 1]) : 1;
  const outX = slideOutAt === undefined ? 0 : lerp(frame, [slideOutAt, slideOutAt + 16], [0, -480]);
  const outOp = slideOutAt === undefined ? 1 : lerp(frame, [slideOutAt, slideOutAt + 14], [1, 0]);
  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${inX + outX}px)`,
        opacity: inOp * outOp,
      }}
    >
      {/* key light */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(70% 85% at 32% 55%, ${color}1f 0%, ${color}08 45%, transparent 72%)`,
        }}
      />
      {/* instrument cluster */}
      <div style={{position: 'absolute', left: 130, top: 230, width: 950, height: 700}}>
        {children}
      </div>
      {/* headline block */}
      <div
        style={{
          position: 'absolute',
          left: 1170,
          top: 0,
          bottom: 0,
          width: 640,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 30,
        }}
      >
        <Kinetic text={headline} delay={80} size={72} align="left" maxWidth={620} />
        <div style={{opacity: lerp(frame, [104, 116], [0, 1])}}>
          <Chip color={color} border={`${color}55`} bg={`${color}0e`}>
            {chipLabel}
          </Chip>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Small captioned instrument panel. */
export const Instrument: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  appear?: number;
  children: React.ReactNode;
}> = ({x, y, w, h, label, appear = 6, children}) => {
  const frame = useCurrentFrame();
  const op = lerp(frame, [appear, appear + 12], [0, 1]);
  const rise = lerp(frame, [appear, appear + 14], [16, 0], easeOut);
  return (
    <Panel
      style={{
        position: 'absolute',
        left: x,
        top: y + rise,
        width: w,
        height: h,
        opacity: op,
        padding: '18px 22px',
        boxSizing: 'border-box',
      }}
    >
      <Eyebrow size={22} style={{marginBottom: 12}}>
        {label}
      </Eyebrow>
      <div style={{position: 'relative', width: '100%', height: h - 66}}>{children}</div>
    </Panel>
  );
};

/** Numeric readout that counts up and locks. */
export const Roll: React.FC<{
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  duration?: number;
  size?: number;
  color?: string;
}> = ({target, decimals = 1, prefix = '', suffix = '', delay = 12, duration = 26, size = 36, color = C.ink}) => {
  const frame = useCurrentFrame();
  const t = lerp(frame, [delay, delay + duration], [0, 1], easeOut);
  const v = target * t;
  return (
    <span
      style={{
        fontFamily: F.mono,
        fontSize: size,
        fontWeight: 600,
        color,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export const ReadoutRow: React.FC<{
  label: string;
  delay?: number;
  children: React.ReactNode;
}> = ({label, delay = 0, children}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 16,
        opacity: lerp(frame, [delay, delay + 10], [0, 1]),
        marginBottom: 10,
      }}
    >
      <span style={{fontFamily: F.mono, fontSize: 24, letterSpacing: '0.08em', color: C.muted}}>
        {label}
      </span>
      {children}
    </div>
  );
};
