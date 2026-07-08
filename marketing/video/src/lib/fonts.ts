import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

/** Vendored variable fonts (same woff2 files the site ships — app/fonts). */
export const loadAllFonts = () =>
  Promise.all([
    loadFont({
      family: 'Space Grotesk',
      url: staticFile('fonts/space-grotesk-latin.woff2'),
      weight: '300 700',
    }),
    loadFont({
      family: 'Manrope',
      url: staticFile('fonts/manrope-latin.woff2'),
      weight: '200 800',
    }),
    loadFont({
      family: 'JetBrains Mono',
      url: staticFile('fonts/jetbrains-mono-latin.woff2'),
      weight: '100 800',
    }),
  ]);
