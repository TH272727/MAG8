"use client";

import { useEffect, useRef, useState } from "react";
import ConfluenceLine from "./ConfluenceLine";

/* ============================================================================
 * HeroConfluence — homepage-only ambient signature.
 *
 * A single-pass WebGL fragment shader renders the four lens signals as
 * simplex-noise flow lines (per-line seed/frequency/speed, tapered widths)
 * fusing at a convergence node into the gold braid and verdict dot. Glow is
 * analytic falloff accumulated as light + filmic tonemap — real bloom look,
 * not opacity tricks. Timing is irregular by construction (noise-gated packet
 * cycles, incommensurate pulse periods), so nothing ever visibly loops.
 *
 * Everywhere else in the app keeps <ConfluenceLine>; that component is also
 * the fallback here when WebGL is unavailable.
 *
 * ?heroT=<seconds> renders one frozen frame and skips the RAF loop — used for
 * screenshots (headless Edge freezes rAF) and handy for tuning.
 * ==========================================================================*/

/** Line colors are hero-graded variants of the lens tokens (desaturated,
 *  lightness-unified) — tuned for additive light, not UI fills. Keep in the
 *  same hue families as --color-discovery/-fundamentals/-macro/-consensus. */
const SIGNALS = [
  { label: "Discovery Scout", hex: "#9184f2", y: 0.06 },
  { label: "Fundamentals", hex: "#57c28c", y: 0.36 },
  { label: "Game Theory", hex: "#ef8c47", y: 0.64 },
  { label: "Street Consensus", hex: "#52b4cf", y: 0.94 },
];

/** Glow may bleed past the stage box; the section's overflow-hidden clips it. */
const BLEED_X = 96;
const BLEED_TOP = 120;
const BLEED_BOTTOM = 88;

/** Frozen-frame time for prefers-reduced-motion (post-entrance, braid lit). */
const SETTLED_T = 21.4;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;    // canvas backing px
uniform vec4 uStage;  // stage rect in backing px: x, y (bottom-left), w, h
uniform float uPx;    // backing px per CSS px (dpr * adaptive scale)
uniform float uTime;

#define TAU 6.28318530718
#define PI 3.14159265359

/* Simplex 2D noise — Ian McEwan / Ashima Arts (MIT). */
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float hash1(float n) { return fract(sin(n) * 43758.5453123); }
float easeOutCubic(float x) { x = clamp(x, 0.0, 1.0); float u = 1.0 - x; return 1.0 - u * u * u; }

/* Composition (stage uv, y down). */
const vec2 CV = vec2(0.615, 0.5);  // convergence node
const vec2 DTP = vec2(0.94, 0.5);  // verdict dot

/* Hero-graded lens colors (linear-ish, for additive light). */
const vec3 C_DISC = vec3(0.545, 0.470, 0.960);
const vec3 C_FUND = vec3(0.300, 0.760, 0.540);
const vec3 C_MACR = vec3(0.945, 0.535, 0.250);
const vec3 C_CONS = vec3(0.270, 0.700, 0.820);
const vec3 GOLD = vec3(1.000, 0.790, 0.380);
const vec3 HOT = vec3(1.000, 0.960, 0.880);

/* Ambient packet schedule per line: period, phase offset, seed. Irregular on
 * purpose — periods share no common beat, and a hash gate skips ~30% of
 * cycles so the rhythm never reads as a loop. */
const vec4 PER = vec4(9.5, 12.5, 8.0, 11.0);
const vec4 OFF = vec4(4.3, 9.1, 6.6, 7.8);
const vec4 SEEDS = vec4(1.7, 7.3, 3.9, 9.2);
const float TRAVEL = 1.9;  // packet flight time entry -> node

/* Base path: entry height easing into the node, plus a per-line arc swoop. */
float yBase(float fx, float ey, float k, float bulge) {
  float s = smoothstep(0.0, 1.0, pow(max(fx, 0.0), k));
  return mix(ey, CV.y, s) + bulge * sin(PI * clamp(fx, 0.0, 1.0));
}

void packetState(float t, float per, float off, float seed,
                 out float pos, out float act, out float sAge, out float gate) {
  float local = t - off;
  float cyc = floor(local / per);
  float ph = local - cyc * per;
  gate = step(0.30, hash1(cyc * 7.31 + seed * 13.7));
  float p = ph / TRAVEL;
  act = (1.0 - step(1.0, p)) * gate;
  pos = pow(clamp(p, 0.0, 1.0), 1.35);
  sAge = ph - TRAVEL;
}

/* Gold pulse that carries an arrived packet down the braid. */
float braidSurge(float t, float per, float off, float seed, float amb, float bxx) {
  float pos, act, sAge, gate;
  packetState(t, per, off, seed, pos, act, sAge, gate);
  float spos = sAge / 0.85;
  float on = step(0.0, sAge) * (1.0 - step(1.0, spos));
  return gate * amb * on * 1.15 * exp(-pow(bxx - spos, 2.0) * 230.0);
}

/* Node flash the moment a packet lands. */
float nodeKick(float t, float per, float off, float seed, float amb) {
  float pos, act, sAge, gate;
  packetState(t, per, off, seed, pos, act, sAge, gate);
  return gate * amb * step(0.0, sAge) * 0.9 * exp(-max(sAge, 0.0) * 7.0);
}

/* Dot blink when the braid pulse reaches it. */
float dotBlink(float t, float per, float off, float seed, float amb) {
  float pos, act, sAge, gate;
  packetState(t, per, off, seed, pos, act, sAge, gate);
  return gate * amb * 0.9 * exp(-pow(sAge - 0.85, 2.0) * 30.0);
}

vec3 lineLight(vec2 sp, float t, float ambientOn,
               float ey, float k, float bulge, float amp, float freq, float spd, float seed,
               float t0, float dur, float per, float off,
               vec3 lcol, vec2 pxv, float hw) {
  float fx = sp.x / CV.x;
  if (fx > 1.02) return vec3(0.0);

  // Cheap band cull before any noise.
  float yb = yBase(fx, ey, k, bulge);
  if (abs(sp.y - yb) * pxv.y > 64.0) return vec3(0.0);

  // Organic displacement: settles to zero approaching the node (agreement).
  float env = 1.0 - smoothstep(0.58, 0.965, fx);
  float n1 = snoise(vec2(fx * freq + seed, t * spd));
  float n2 = snoise(vec2(fx * freq * 2.3 + seed * 7.1, t * spd * 1.6 + 3.7));
  float y = yb + amp * env * (n1 + 0.45 * n2);

  // Perpendicular distance (slope from the cheap base path only).
  float sl = (yBase(fx + 0.02, ey, k, bulge) - yb) / 0.02 / CV.x;
  float sc = inversesqrt(1.0 + sl * sl * hw * hw);
  float dpx = abs(sp.y - y) * pxv.y * sc;

  // Tapered width: swells mid-flight, thins into the node; breathes on noise.
  float wp = 0.8 + 0.55 * sin(PI * clamp(fx, 0.0, 1.0));
  wp *= 1.0 - 0.45 * smoothstep(0.78, 1.0, fx);
  float w0 = (1.15 + 1.25 * wp) * (1.0 + 0.22 * n2);

  // Entrance draw-in.
  float he = easeOutCubic((t - t0) / dur);
  float vis = 1.0 - smoothstep(he - 0.045, he + 0.008, fx);
  vis *= smoothstep(-0.085, 0.02, fx);
  vis *= smoothstep(0.0, 0.04, he);
  float headOn = smoothstep(0.0, 0.03, he) * (1.0 - smoothstep(0.9, 1.0, he));
  float headGlow = exp(-max(0.0, he - fx) * 30.0) * 2.1 * headOn * step(fx, he);

  // Ambient packet: sharp leading edge, soft tail.
  float pos, act, sAge, gate;
  packetState(t, per, off, seed, pos, act, sAge, gate);
  float dpk = fx - pos;
  float kk = mix(420.0, 2400.0, step(0.0, dpk));
  float pk = act * ambientOn * 1.35 * exp(-dpk * dpk * kk);

  float breathe = 0.82 + 0.13 * sin(t * 0.31 + seed * 9.0) * sin(t * 0.53 + seed * 4.0);
  float e = (0.52 * breathe + headGlow + pk) * vis;

  // Signals heat toward white-gold as they fuse.
  vec3 c = mix(lcol, vec3(1.0, 0.92, 0.72), smoothstep(0.78, 1.0, fx) * 0.55);
  float Icore = exp(-dpx * dpx / (2.0 * w0 * w0));
  float Ihalo = max(0.0, 0.13 / (1.0 + dpx * dpx * 0.028) - 0.004);
  return c * (Icore + Ihalo) * e;
}

void main() {
  vec2 q = gl_FragCoord.xy;
  vec2 sp = (q - uStage.xy) / uStage.zw;
  sp.y = 1.0 - sp.y;  // stage uv, y down

  // Design-px space: glow sizes track CSS px, shrink gently on short stages.
  float cssH = uStage.w / uPx;
  float PS = clamp(cssH / 300.0, 0.55, 1.0) * uPx;
  vec2 pxv = uStage.zw / PS;
  float hw = uStage.w / uStage.z;

  float t = uTime;
  float ambientOn = smoothstep(5.2, 6.0, t);
  vec3 col = vec3(0.0);

  /* ---- four signal lines ---- */
  col += lineLight(sp, t, ambientOn, 0.06, 1.30, -0.045, 0.034, 2.1, 0.14, SEEDS.x, 0.15, 2.10, PER.x, OFF.x, C_DISC, pxv, hw);
  col += lineLight(sp, t, ambientOn, 0.36, 0.95,  0.028, 0.024, 3.3, 0.10, SEEDS.y, 0.72, 1.75, PER.y, OFF.y, C_FUND, pxv, hw);
  col += lineLight(sp, t, ambientOn, 0.64, 1.10, -0.030, 0.030, 2.7, 0.17, SEEDS.z, 1.05, 2.30, PER.z, OFF.z, C_MACR, pxv, hw);
  col += lineLight(sp, t, ambientOn, 0.94, 1.22,  0.040, 0.026, 3.9, 0.12, SEEDS.w, 1.62, 1.85, PER.w, OFF.w, C_CONS, pxv, hw);

  /* ---- convergence node ---- */
  float dNode = length((sp - CV) * pxv);
  if (dNode < 130.0) {
    // Entrance arrival flashes (t0 + dur per line), then ambient packet kicks.
    float flash = 1.3 * exp(-pow(t - 2.25, 2.0) * 7.0)
                + 1.1 * exp(-pow(t - 2.47, 2.0) * 7.0)
                + 1.2 * exp(-pow(t - 3.35, 2.0) * 7.0)
                + 1.4 * exp(-pow(t - 3.47, 2.0) * 7.0);
    flash += nodeKick(t, PER.x, OFF.x, SEEDS.x, ambientOn);
    flash += nodeKick(t, PER.y, OFF.y, SEEDS.y, ambientOn);
    flash += nodeKick(t, PER.z, OFF.z, SEEDS.z, ambientOn);
    flash += nodeKick(t, PER.w, OFF.w, SEEDS.w, ambientOn);
    float nodeOn = smoothstep(2.1, 2.5, t);
    float ni = 0.32 + 0.10 * sin(t * 1.31) * sin(t * 0.83) + flash;
    vec3 ncol = mix(vec3(1.0, 0.95, 0.86), mix(GOLD, HOT, 0.45), smoothstep(3.4, 4.6, t));
    float Ic = exp(-dNode * dNode / 98.0) * 1.35;
    float Ih = max(0.0, 0.38 / (1.0 + dNode * dNode * 0.016) - 0.008);
    col += ncol * (Ic + Ih) * ni * nodeOn;
  }

  /* ---- gold braid: two interweaving strands + warm channel ---- */
  float bx = (sp.x - CV.x) / (DTP.x - CV.x);
  if (bx > -0.05 && bx < 1.05 && abs(sp.y - CV.y) * pxv.y < 80.0) {
    float ihead = easeOutCubic((t - 3.55) / 1.35);
    if (ihead > 0.0) {
      float bxx = clamp(bx, 0.0, 1.0);
      float ph = bxx * TAU * 2.15 - t * 0.5 + 0.30 * sin(bxx * 3.1 + t * 0.21);
      float ampB = 0.052 * smoothstep(0.0, 0.16, bxx) * (1.0 - smoothstep(0.72, 0.985, bxx));
      ampB *= 1.0 + 0.13 * sin(t * 0.27 + 1.7) * sin(t * 0.181);
      float nB = 0.006 * snoise(vec2(bxx * 2.5 + 40.0, t * 0.24));
      float yA = CV.y + ampB * sin(ph) + nB;
      float yB2 = CV.y - ampB * sin(ph) - nB;
      float slA = ampB * cos(ph) * TAU * 2.15 / (DTP.x - CV.x);
      float scA = inversesqrt(1.0 + slA * slA * hw * hw);
      float dA = abs(sp.y - yA) * pxv.y * scA;
      float dB = abs(sp.y - yB2) * pxv.y * scA;
      float wB0 = 1.85 * (1.0 - 0.35 * smoothstep(0.7, 1.0, bxx));
      float IA = exp(-dA * dA / (2.0 * wB0 * wB0)) + max(0.0, 0.15 / (1.0 + dA * dA * 0.03) - 0.006);
      float IB = exp(-dB * dB / (2.0 * wB0 * wB0)) + max(0.0, 0.15 / (1.0 + dB * dB * 0.03) - 0.006);
      // Over/under weave: strands trade brightness at each crossing.
      float bA = 1.0 + 0.26 * cos(ph);
      float bB = 1.0 - 0.26 * cos(ph);
      float surge = braidSurge(t, PER.x, OFF.x, SEEDS.x, ambientOn, bxx)
                  + braidSurge(t, PER.y, OFF.y, SEEDS.y, ambientOn, bxx)
                  + braidSurge(t, PER.z, OFF.z, SEEDS.z, ambientOn, bxx)
                  + braidSurge(t, PER.w, OFF.w, SEEDS.w, ambientOn, bxx);
      // Slow swell — deliberately a different period than the dot heartbeat.
      float pulse = 0.20 * pow(0.5 + 0.5 * sin(TAU * t / 3.6 + 0.9), 2.0);
      float vis = 1.0 - smoothstep(ihead - 0.05, ihead + 0.005, bxx);
      float tip = exp(-max(0.0, ihead - bxx) * 24.0) * 1.6 * (1.0 - smoothstep(0.88, 1.0, ihead)) * step(bxx, ihead);
      float eB = (0.60 + pulse + surge + tip) * vis;
      float chW = max(ampB * pxv.y * 0.6, 2.5);
      float chan = exp(-pow((sp.y - CV.y) * pxv.y, 2.0) / (2.0 * chW * chW)) * 0.09;
      col += GOLD * (IA * bA + IB * bB) * eB + HOT * (IA * IA + IB * IB) * 0.28 * eB + GOLD * chan * eB;
    }
  }

  /* ---- verdict dot ---- */
  float dd = length((sp - DTP) * pxv);
  if (dd < 120.0) {
    float ig = smoothstep(4.55, 4.95, t);
    // Asymmetric heartbeat: sharp attack, slow decay; 2.7s vs braid 3.6s.
    float hp = fract(t / 2.7);
    float hb = smoothstep(0.0, 0.05, hp) * exp(-hp * 5.0);
    float pop = 1.7 * exp(-pow(t - 4.9, 2.0) * 5.0);
    float blink = dotBlink(t, PER.x, OFF.x, SEEDS.x, ambientOn)
                + dotBlink(t, PER.y, OFF.y, SEEDS.y, ambientOn)
                + dotBlink(t, PER.z, OFF.z, SEEDS.z, ambientOn)
                + dotBlink(t, PER.w, OFF.w, SEEDS.w, ambientOn);
    float eD = ig * (0.52 + 1.0 * hb + pop + blink);
    float IcD = exp(-dd * dd / 13.52) * 2.3;
    float ImD = exp(-dd * dd / 84.0) * 0.8;
    float IhD = max(0.0, 0.5 / (1.0 + dd * dd * 0.012) - 0.012);
    col += (HOT * IcD + GOLD * (ImD + IhD * 0.5)) * eD;
  }

  /* ---- embers shed from the fusion ---- */
  float emberOn = smoothstep(5.0, 6.0, t);
  if (emberOn > 0.001 && abs(sp.y - CV.y) < 0.35 && sp.x > CV.x - 0.05 && sp.x < CV.x + 0.5) {
    for (int j = 0; j < 8; j++) {
      float fj = float(j);
      float h1 = hash1(fj * 17.31 + 3.7);
      float h2 = hash1(fj * 9.13 + 11.0);
      float h3 = hash1(fj * 5.77 + 7.0);
      float per = 2.8 + 2.4 * h1;
      float lf = fract(t / per + h3);
      float gg = step(0.35, hash1(floor(t / per + h3) * 3.1 + fj * 7.7));
      vec2 pe = CV + vec2(lf * (0.09 + 0.13 * h2), (h1 - 0.5) * 0.11 * lf + 0.014 * sin(lf * 8.0 + fj * 5.0));
      float de = length((sp - pe) * pxv);
      if (de < 14.0) {
        float al = sin(PI * lf);
        al *= al;
        vec3 ec = mix(GOLD, vec3(1.0, 0.42, 0.16), 0.5 * h2);
        col += ec * exp(-de * de / 4.0) * al * gg * emberOn * 0.85;
      }
    }
  }

  /* ---- finish: edge fade, filmic tonemap, dither, premultiplied alpha ---- */
  float fw = 26.0 * uPx;
  float edge = smoothstep(0.0, fw, q.x) * smoothstep(0.0, fw, q.y)
             * smoothstep(0.0, fw, uRes.x - q.x) * smoothstep(0.0, fw, uRes.y - q.y);
  col *= edge;
  col = 1.0 - exp(-col * 1.30);
  col = pow(col, vec3(0.4545));
  float lum = max(col.r, max(col.g, col.b));
  float a = clamp(lum * 1.12, 0.0, 1.0);
  // Dither only where there is light — empty pixels must stay fully clear.
  // (Continuous gate: a stepped one draws a visible ring at its threshold.)
  col += (hash1(q.x * 1.37 + q.y * 113.17) - 0.5) * 0.008 * clamp(lum * 60.0, 0.0, 1.0);
  col = clamp(col, 0.0, 1.0);
  col = min(col, vec3(a));
  gl_FragColor = vec4(col, a);
}
`;

export default function HeroConfluence({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      // Stills (reduced motion, ?heroT=) must survive late compositor reads.
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      setFallback(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn("HeroConfluence shader:", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      setFallback(true);
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("HeroConfluence link:", gl.getProgramInfoLog(prog));
      setFallback(true);
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uStage = gl.getUniformLocation(prog, "uStage");
    const uPx = gl.getUniformLocation(prog, "uPx");
    const uTime = gl.getUniformLocation(prog, "uTime");

    // Old mobile GPUs without highp fragment floats lose time precision; wrap
    // (past the entrance) so the ambient math stays smooth.
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const wrapTime = !hp || hp.precision === 0;

    const heroTParam = new URLSearchParams(window.location.search).get("heroT");
    const fixedT = heroTParam !== null && !Number.isNaN(parseFloat(heroTParam)) ? parseFloat(heroTParam) : null;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");

    let scale = Math.min(window.devicePixelRatio || 1, 1.6);
    let raf = 0;
    let running = false;
    let inView = true;
    let last = 0;
    let vt = 0;
    let frames = 0;
    let slow = 0;

    const size = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      canvas.width = Math.max(1, Math.round(r.width * scale));
      canvas.height = Math.max(1, Math.round(r.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (t: number) => {
      const tt = wrapTime && t > 60 ? 60 + ((t - 60) % 300) : t;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform4f(
        uStage,
        BLEED_X * scale,
        BLEED_BOTTOM * scale,
        canvas.width - 2 * BLEED_X * scale,
        canvas.height - (BLEED_TOP + BLEED_BOTTOM) * scale,
      );
      gl.uniform1f(uPx, scale);
      gl.uniform1f(uTime, tt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const stillSync = new Uint8Array(4);
    const renderStill = () => {
      draw(fixedT ?? SETTLED_T);
      // Outside a rAF frame the queue may never flush (frozen-rAF headless,
      // reduced motion); a 1px read forces completion so the still presents.
      gl.flush();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, stillSync);
    };

    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      vt += dt;
      frames += 1;
      if (dt > 0.024) slow += 1;
      if (frames >= 90) {
        if (slow > 45 && scale > 0.8) {
          scale *= 0.78;
          size();
        }
        frames = 0;
        slow = 0;
      }
      draw(vt);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || fixedT !== null || rm.matches || !inView || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const ro = new ResizeObserver(() => {
      size();
      if (!running) renderStill();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        if (inView) start();
        else stop();
      },
      { rootMargin: "80px" },
    );
    io.observe(stage);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    const onRM = () => {
      if (rm.matches) {
        stop();
        renderStill();
      } else start();
    };
    rm.addEventListener("change", onRM);

    size();
    if (fixedT !== null || rm.matches) renderStill();
    else start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      rm.removeEventListener("change", onRM);
    };
  }, []);

  return (
    <div ref={stageRef} className={`relative aspect-[2.6/1] sm:aspect-[4.3/1] ${className ?? ""}`}>
      {fallback ? (
        <ConfluenceLine mode="ambient" className="absolute inset-0 h-full w-full" />
      ) : (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute"
          // Canvas is a replaced element: insets alone won't stretch it.
          style={{
            top: -BLEED_TOP,
            left: -BLEED_X,
            width: `calc(100% + ${2 * BLEED_X}px)`,
            height: `calc(100% + ${BLEED_TOP + BLEED_BOTTOM}px)`,
          }}
        />
      )}
      {/* Input jacks — one per independent lens (unordered, so unnumbered). */}
      {SIGNALS.map((s) => (
        <span
          key={s.label}
          className="absolute left-0 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim"
          style={{ top: `calc(${s.y * 100}% + 9px)` }}
        >
          <span className="h-[9px] w-[2px]" style={{ background: s.hex, opacity: 0.85 }} />
          {s.label}
        </span>
      ))}
      {/* The single output — gold stays reserved for the verdict. */}
      <span
        className="absolute flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim"
        style={{ right: "1.5%", top: "calc(50% + 20px)" }}
      >
        <span className="h-[9px] w-[2px] bg-confluence opacity-80" />
        Confluence
      </span>
    </div>
  );
}
