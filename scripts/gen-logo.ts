/**
 * gen-logo.ts — regenerate every brand asset from marketing/logo-source.png.
 *
 * The source is the black four-blade X mark on a white field. This script:
 *   1. flattens + trims the white border, converts darkness -> alpha
 *      (anti-aliased edges keep partial alpha), squares the canvas
 *   2. emits transparent marks for in-page use (black + ink tints)
 *   3. emits favicon/app icons on a light rounded badge — the black mark
 *      stays legible on any browser-tab theme
 *
 * Run: npm run gen:logo   (app/opengraph-image.png is produced separately —
 * it needs the vendored display fonts, so it is screenshot from real HTML.)
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "marketing", "logo-source.png");
const BRAND = path.join(ROOT, "public", "brand");
const APP = path.join(ROOT, "app");

const INK = { r: 231, g: 234, b: 238 }; // --color-ink
const PAPER = "#eef1f5"; // favicon badge — ink-family light

async function main() {
  mkdirSync(BRAND, { recursive: true });

  // -- 1. white field -> trimmed, squared, alpha-carrying raw pixels --------
  const flat = await sharp(SRC).flatten({ background: "#ffffff" }).toBuffer();
  const trimmed = await sharp(flat)
    .trim({ background: "#ffffff", threshold: 16 })
    .toBuffer();
  const { data, info } = await sharp(trimmed)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const side = Math.max(w, h);
  const offX = Math.floor((side - w) / 2);
  const offY = Math.floor((side - h) / 2);

  /** Solid-color mark on a transparent square canvas; alpha = source darkness. */
  function tinted(rgb: { r: number; g: number; b: number }): sharp.Sharp {
    const px = Buffer.alloc(side * side * 4); // zeroed = transparent
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = 255 - data[y * w + x];
        if (a === 0) continue;
        const j = ((y + offY) * side + (x + offX)) * 4;
        px[j] = rgb.r;
        px[j + 1] = rgb.g;
        px[j + 2] = rgb.b;
        px[j + 3] = a;
      }
    }
    return sharp(px, { raw: { width: side, height: side, channels: 4 } });
  }

  const black = () => tinted({ r: 10, g: 11, b: 13 }); // near-black, matches void family
  const ink = () => tinted(INK);

  // -- 2. transparent marks --------------------------------------------------
  const out: Array<[string, Promise<sharp.OutputInfo>]> = [];
  const emit = (file: string, job: Promise<sharp.OutputInfo>) => out.push([file, job]);

  emit("public/brand/mark.png", black().resize(640, 640).png().toFile(path.join(BRAND, "mark.png")));
  emit("public/brand/mark-96.png", black().resize(96, 96).png().toFile(path.join(BRAND, "mark-96.png")));
  emit("public/brand/mark-ink.png", ink().resize(640, 640).png().toFile(path.join(BRAND, "mark-ink.png")));

  // -- 3. badge icons ----------------------------------------------------------
  const badge = (s: number, rx: number) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
        `<rect width="${s}" height="${s}" rx="${rx}" fill="${PAPER}"/></svg>`,
    );
  const markPng = async (px: number) => black().resize(px, px).png().toBuffer();

  const icon512 = await sharp(badge(512, 116))
    .composite([{ input: await markPng(352), gravity: "centre" }])
    .png()
    .toBuffer();

  emit("app/icon.png", sharp(icon512).toFile(path.join(APP, "icon.png")));
  emit("public/brand/icon-512.png", sharp(icon512).toFile(path.join(BRAND, "icon-512.png")));
  emit("public/brand/icon-192.png", sharp(icon512).resize(192, 192).toFile(path.join(BRAND, "icon-192.png")));
  emit(
    "app/apple-icon.png", // iOS masks its own corners — full-bleed opaque square
    sharp(badge(180, 0))
      .composite([{ input: await markPng(124), gravity: "centre" }])
      .flatten({ background: PAPER })
      .png()
      .toFile(path.join(APP, "apple-icon.png")),
  );

  for (const [file, job] of out) {
    const r = await job;
    console.log(`${file}  ${r.width}x${r.height}  ${(r.size / 1024).toFixed(1)}kb`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
