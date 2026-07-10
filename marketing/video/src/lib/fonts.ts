import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

/** Vendored variable fonts (same woff2 files the site ships — app/fonts),
 * plus two OFL accent faces for the engine-special episodes (fetched from
 * jsdelivr/fontsource 2026-07-09 — google font hosts stay blackholed). */
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
    loadFont({
      family: 'Libre Baskerville',
      url: staticFile('fonts/libre-baskerville-latin-700.woff2'),
      weight: '700',
    }),
    loadFont({
      family: 'Caveat',
      url: staticFile('fonts/caveat-latin-700.woff2'),
      weight: '700',
    }),
  ]);
