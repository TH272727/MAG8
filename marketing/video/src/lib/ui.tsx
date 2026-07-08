import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {blink, lerp, pop, rndIn} from './anim';

/* Film grain — same SVG turbulence the site uses (hero-field::after). */
const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.05}) => {
  const frame = useCurrentFrame();
  const jx = Math.floor(rndIn(`gx${Math.floor(frame / 2)}`, 0, 4)) * 40;
  const jy = Math.floor(rndIn(`gy${Math.floor(frame / 2)}`, 0, 4)) * 40;
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: GRAIN_URI,
        backgroundSize: '160px 160px',
        backgroundPosition: `${jx}px ${jy}px`,
        pointerEvents: 'none',
      }}
    />
  );
};

/**
 * The stage. Ink-navy void + faint 64px engineering grid + vignette + grain.
 * `light` flips to the white chapter-5 look.
 */
export const Void: React.FC<{
  light?: boolean;
  depth?: boolean;
  children?: React.ReactNode;
}> = ({light = false, depth = false, children}) => {
  const line = light ? 'rgba(10,13,18,0.05)' : 'rgba(35,41,56,0.55)';
  return (
    <AbsoluteFill style={{backgroundColor: light ? C.white : C.void}}>
      {depth && !light && (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(115% 130% at 55% 68%, rgba(18,27,44,0.9) 0%, rgba(13,18,28,0.45) 42%, transparent 70%)',
          }}
        />
      )}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: light ? 0.9 : 0.28,
        }}
      />
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          background: light
            ? 'radial-gradient(120% 120% at 50% 50%, transparent 60%, rgba(11,14,19,0.07) 100%)'
            : 'radial-gradient(120% 120% at 50% 46%, transparent 52%, rgba(0,0,0,0.38) 100%)',
          pointerEvents: 'none',
        }}
      />
      <Grain opacity={light ? 0.03 : 0.05} />
    </AbsoluteFill>
  );
};

/** Silkscreen mono eyebrow — the label stamped on every instrument. */
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({children, color = C.muted, size = 20, style}) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: size,
      fontWeight: 500,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Mono pill chip (statuses, tickers, lens labels). */
export const Chip: React.FC<{
  children: React.ReactNode;
  color?: string;
  border?: string;
  bg?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({children, color = C.muted, border = C.hairline, bg = 'transparent', size = 19, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.45em',
      fontFamily: F.mono,
      fontSize: size,
      fontWeight: 500,
      letterSpacing: '0.06em',
      lineHeight: 1,
      padding: `${size * 0.55}px ${size * 0.85}px`,
      borderRadius: 999,
      border: `1.5px solid ${border}`,
      color,
      background: bg,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Instrument panel. */
export const Panel: React.FC<{
  children?: React.ReactNode;
  raised?: boolean;
  style?: React.CSSProperties;
}> = ({children, raised = false, style}) => (
  <div
    style={{
      background: raised ? C.panel2 : C.panel,
      border: `1.5px solid ${C.hairline}`,
      borderRadius: 10,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Word-staggered kinetic headline. Words spring up out of a slight blur,
 * exactly the aside cadence. `accents` maps a word index to a color.
 */
export const Kinetic: React.FC<{
  text: string;
  delay?: number;
  size?: number;
  weight?: number;
  color?: string;
  accents?: Record<number, string>;
  align?: 'left' | 'center';
  lineHeight?: number;
  stagger?: number;
  maxWidth?: number;
  out?: number; // frame at which the whole line starts fading out
}> = ({
  text,
  delay = 0,
  size = 84,
  weight = 700,
  color = C.ink,
  accents = {},
  align = 'center',
  lineHeight = 1.14,
  stagger = 3,
  maxWidth,
  out,
}) => {
  const frame = useCurrentFrame();
  const fadeOut = out === undefined ? 1 : lerp(frame, [out, out + 14], [1, 0]);
  const lines = text.split('\n');
  let w = 0;
  return (
    <div
      style={{
        fontFamily: F.display,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        letterSpacing: '-0.015em',
        textAlign: align,
        maxWidth,
        opacity: fadeOut,
      }}
    >
      {lines.map((line, li) => (
        <div key={li}>
          {line.split(' ').map((word, wi) => {
            const idx = w++;
            const s = pop(frame, delay + idx * stagger, 15, 0.85);
            const op = lerp(frame, [delay + idx * stagger, delay + idx * stagger + 7], [0, 1]);
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  color: accents[idx] ?? color,
                  opacity: op,
                  transform: `translateY(${(1 - s) * 34}px)`,
                  filter: `blur(${(1 - s) * 5}px)`,
                }}
              >
                {word}
                {wi < line.split(' ').length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Precomputed human typing rhythm: cumulative frame time per character. */
export const typeTimes = (text: string, seed: string, base = 2.1): number[] => {
  const times: number[] = [];
  let acc = 0;
  for (let i = 0; i < text.length; i++) {
    let dt = base * rndIn(`${seed}-${i}`, 0.5, 1.45);
    const ch = text[i];
    if (i > 0 && ',?.!'.includes(text[i - 1])) dt *= 3.4;
    if (rndIn(`${seed}-h${i}`, 0, 1) < 0.07) dt *= 3;
    if (rndIn(`${seed}-b${i}`, 0, 1) < 0.24) dt *= 0.42; // little bursts
    acc += dt;
    times.push(acc);
  }
  return times;
};

/**
 * Typewriter with the storyboard's signature: the newest characters are
 * tinted (violet by default) and cool down to the final color.
 */
export const TypeOn: React.FC<{
  text: string;
  delay: number;
  seed?: string;
  base?: number;
  size?: number;
  color?: string;
  tint?: string;
  font?: 'display' | 'body' | 'mono';
  weight?: number;
  cursor?: boolean;
  cursorColor?: string;
  align?: 'left' | 'center';
  out?: number;
}> = ({
  text,
  delay,
  seed = 'type',
  base = 2.1,
  size = 76,
  color = C.ink,
  tint = C.discovery,
  font = 'display',
  weight = 700,
  cursor = true,
  cursorColor,
  align = 'center',
  out,
}) => {
  const frame = useCurrentFrame();
  const times = typeTimes(text, seed, base);
  const el = frame - delay;
  const shown = times.filter((t) => t <= el).length;
  const lastAge = shown > 0 ? el - times[shown - 1] : 99;
  const idleBlink = lastAge > 8 ? blink(frame) : true;
  const fadeOut = out === undefined ? 1 : lerp(frame, [out, out + 12], [1, 0]);
  const family = font === 'display' ? F.display : font === 'body' ? F.body : F.mono;
  const lines = text.split('\n');
  // Map each line to its [start, end) char range in the full text (newlines counted).
  const ranges: Array<[number, number]> = [];
  let start = 0;
  for (const line of lines) {
    ranges.push([start, start + line.length]);
    start += line.length + 1;
  }
  const lastShownIdx = shown - 1;
  const activeLine =
    shown <= 0
      ? 0
      : Math.max(
          0,
          ranges.findIndex(([a, b]) => lastShownIdx >= a && lastShownIdx < b + 1),
        );
  return (
    <div
      style={{
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.2,
        letterSpacing: font === 'display' ? '-0.01em' : undefined,
        textAlign: align,
        opacity: fadeOut,
      }}
    >
      {lines.map((line, li) => {
        const [a] = ranges[li];
        return (
          <div key={li} style={{minHeight: size * 1.2}}>
            {line.split('').map((ch, i) => {
              const idx = a + i;
              if (idx >= shown) return null;
              const age = el - times[idx];
              const hot = age < 9 && idx >= shown - 3;
              return (
                <span key={i} style={{color: hot ? tint : color, whiteSpace: 'pre'}}>
                  {ch}
                </span>
              );
            })}
            {cursor && li === activeLine && el >= 0 && (
              <span
                style={{
                  display: 'inline-block',
                  width: Math.max(3, size * 0.045),
                  height: size * 0.92,
                  marginLeft: size * 0.06,
                  borderRadius: 2,
                  background: cursorColor ?? color,
                  verticalAlign: 'text-bottom',
                  opacity: idleBlink ? 0.95 : 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Absolute-centered flex column helper. */
export const Center: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({children, style}) => (
  <AbsoluteFill
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);
