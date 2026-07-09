/**
 * MAG8 design tokens, mirrored from app/globals.css — the film and the product
 * must be pixel-siblings. GOLD is reserved for verdicts: it may not appear
 * before the fusion moment in S10.
 */
export const C = {
  void: '#0a0d12',
  panel: '#12161f',
  panel2: '#171c28',
  hairline: '#232938',
  hairline2: '#303950',
  ink: '#e7eaee',
  muted: '#8891a1',
  dim: '#5a6274',

  discovery: '#8b7cff',
  macro: '#e0854a',
  consensus: '#3fd1c9',
  fundamentals: '#5fbf7a',
  confluence: '#f2c75c',
  danger: '#e5534b',

  // Chapter 5 (white) palette
  white: '#f6f7f9',
  whiteInk: '#0b0e13',
  whiteMuted: '#5a6274',
  whiteHairline: '#d4d8e0',
} as const;

export const F = {
  display: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  body: "'Manrope', ui-sans-serif, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'Cascadia Mono', monospace",
} as const;

export const W = 1920;
export const H = 1080;
export const FPS = 30;

/**
 * Platform-chrome safe zones (px at native comp size) — keep hero text and
 * must-read UI inside. Portrait covers TikTok/Reels/Shorts overlay chrome
 * (side rail, caption strip); landscape is action-safe padding for YouTube.
 * New scenes import these instead of guessing margins.
 */
export const SAFE = {
  landscape: {top: 72, bottom: 72, sides: 96}, // 1920×1080 master film
  portrait: {top: 150, bottom: 170, sides: 60}, // 1080×1920 shorts + fun campaign
} as const;
