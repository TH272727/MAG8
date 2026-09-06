/**
 * The chart set-piece library — the moving parts of the format.
 *
 * The look this reproduces has four signature moves, and each one is a
 * component here: an x axis that grows as time passes, a y axis whose units
 * ratchet upward, a big date under the plot that counts with the animation, and
 * a badge riding the head of every line. Everything else on screen is the house
 * system (theme tokens, type floors, safe zones) so a chart film and a lens film
 * are visibly the same brand.
 *
 * The render-model rules in this project's engineering notes apply without
 * exception:
 * every value is a pure function of the frame, nothing reads a clock, and every
 * style must be valid at EVERY frame (the encode path reuses one DOM, so a NaN
 * or a negative blur sticks around for the rest of the film).
 */
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {C, F, SAFE} from '../theme';
import {lerp, pop, pulse01, easeInOut, easeOut} from '../lib/anim';
import {
  deOverlap,
  pointsUpTo,
  standingsAt,
  ticks,
  valueAt,
  xSpan,
  yDomain,
  yFrac,
  type Head,
} from './cmath';
import {formatDate, formatTick, formatValue, type ChartData, type ChartSpec} from './spec';

export const VW = 1080;
export const VH = 1920;

/** The plot box. A right gutter is deliberately absent: the head badge is allowed
 *  to sit on the right edge, and its text flips to the other side when it would
 *  overhang. Everything stays inside SAFE.portrait. */
export const PLOT = {x: 176, y: 516, w: 784, h: 610} as const;
const PLOT_R = PLOT.x + PLOT.w;
const PLOT_B = PLOT.y + PLOT.h;

/**
 * Reveal easing. Almost linear, because the point of the format is that time
 * passes at a steady rate — but with just enough softening at both ends that the
 * first month does not snap into place and the last does not slam.
 */
export const driftEase = (t: number) => t * 0.82 + easeInOut(t) * 0.18;

/** Fractional index into the dataset at this frame. */
export const revealIndex = (frame: number, raceFrames: number, n: number): number => {
  // Nothing precedes the race any more, so the line starts moving almost at
  // once — ten still frames at the top of a scroll feed is a third of a second
  // of nothing. The 46-frame tail is kept: the finished chart holds ~1.5s, and
  // that held frame is where the film loops.
  const p = lerp(frame, [4, raceFrames - 46], [0, 1], driftEase);
  return p * (n - 1);
};

/* -------------------------------------------------------------------------- */
/*  Brand furniture — on every chart frame, per the owner's branding note      */
/* -------------------------------------------------------------------------- */

/**
 * Mark and wordmark left, what MAG8 IS and where to find it right.
 *
 * With the endcard cut (owner call, 2026-09-04) this row is the only place the
 * brand speaks, so it carries the tagline as well as the address — and because
 * it is on every frame of every chart, it promotes by being present rather than
 * by interrupting. Deliberately quiet: muted weight, no gold, no ask. The film
 * is a chart; this is the byline on it.
 */
export const BrandRow: React.FC<{at?: number}> = ({at = 0}) => {
  const frame = useCurrentFrame();
  const op = lerp(frame, [at, at + 10], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE.portrait.top - 4,
        left: SAFE.portrait.sides,
        right: SAFE.portrait.sides,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        opacity: op,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <Img
          src={staticFile('brand/mark.png')}
          style={{
            width: 46,
            height: 46,
            filter: 'drop-shadow(0 0 1px rgba(231,234,238,0.6)) drop-shadow(0 0 8px rgba(231,234,238,0.2))',
          }}
        />
        <span
          style={{
            fontFamily: F.display,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '0.09em',
            color: C.ink,
            lineHeight: 1,
          }}
        >
          MAG8
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 9,
        }}
      >
        <span
          style={{
            fontFamily: F.body,
            fontSize: 26,
            fontWeight: 400,
            color: C.muted,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          The next trillion-dollar leaderboard.
        </span>
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 25,
            letterSpacing: '0.1em',
            color: C.ink,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          themag8.com
        </span>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Headline block                                                            */
/* -------------------------------------------------------------------------- */

export const ChartHead: React.FC<{spec: ChartSpec; at?: number}> = ({spec, at = 0}) => {
  const frame = useCurrentFrame();
  const lines = spec.title.split('\n');
  return (
    <div
      style={{
        position: 'absolute',
        top: 228,
        left: SAFE.portrait.sides,
        width: VW - SAFE.portrait.sides * 2,
      }}
    >
      {lines.map((line, i) => {
        const s = pop(frame, at + i * 4, 14, 0.9);
        return (
          <div
            key={i}
            style={{
              fontFamily: F.display,
              fontSize: 62,
              fontWeight: 700,
              letterSpacing: '-0.015em',
              lineHeight: 1.14,
              color: C.ink,
              opacity: lerp(frame, [at + i * 4, at + i * 4 + 10], [0, 1]),
              transform: `translateY(${(1 - Math.min(s, 1)) * 22}px)`,
            }}
          >
            {line}
          </div>
        );
      })}
      {spec.subtitle ? (
        <div
          style={{
            marginTop: 16,
            fontFamily: F.body,
            fontSize: 31,
            fontWeight: 400,
            color: C.muted,
            lineHeight: 1.3,
            opacity: lerp(frame, [at + 14, at + 26], [0, 1]),
          }}
        >
          {spec.subtitle}
        </div>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Source block — the receipts, on screen, on every chart                    */
/* -------------------------------------------------------------------------- */

/**
 * The two fixed y positions at the foot of the frame. The live rail sits
 * between them, so it has to know where the receipts start — named here rather
 * than repeated as literals, because the rail now sizes its rows to the gap.
 */
export const RAIL_TOP = 1396;
export const SOURCE_TOP = 1548;

export const SourceBlock: React.FC<{data: ChartData; at?: number}> = ({data, at = 0}) => {
  const frame = useCurrentFrame();
  const op = lerp(frame, [at, at + 14], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        top: SOURCE_TOP,
        left: SAFE.portrait.sides,
        width: VW - SAFE.portrait.sides * 2,
        opacity: op,
      }}
    >
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 22,
          lineHeight: 1.5,
          letterSpacing: '0.02em',
          color: C.muted,
        }}
      >
        {data.method}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: F.mono,
          fontSize: 21,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: C.dim,
          lineHeight: 1.5,
        }}
      >
        {data.sourceLabel} · PULLED {data.fetchedAt}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  The big date under the plot                                               */
/* -------------------------------------------------------------------------- */

export const BigDate: React.FC<{
  data: ChartData;
  idx: number;
  mode?: 'month' | 'year';
}> = ({data, idx, mode = 'month'}) => {
  const i = Math.min(Math.max(Math.round(idx), 0), data.dates.length - 1);
  const text = formatDate(data.dates[i], mode);
  const progress = data.dates.length > 1 ? idx / (data.dates.length - 1) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        top: 1206,
        left: SAFE.portrait.sides,
        width: VW - SAFE.portrait.sides * 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22,
      }}
    >
      <div
        style={{
          fontFamily: F.display,
          fontSize: 118,
          fontWeight: 700,
          letterSpacing: '0.02em',
          lineHeight: 1,
          color: C.ink,
          whiteSpace: 'nowrap',
          // Tabular figures stop the date jittering as digits change width.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {text}
      </div>
      <div
        style={{
          width: '100%',
          height: 5,
          borderRadius: 99,
          background: C.hairline,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
            height: '100%',
            borderRadius: 99,
            background: C.confluence,
            boxShadow: `0 0 14px ${C.confluence}66`,
          }}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  The plot                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Year labels along the x axis, thinned so at most six are ever drawn.
 *
 * The cap was in this comment and not in the code: the ladder stopped at a
 * five-year step, so a fifty-year run asked for ELEVEN labels, which arrive at
 * 78px apart and print into each other — four digits of 25px mono need about
 * that much on their own. The ladder is unchanged for every span it already
 * handled (a re-render of a published film is byte-identical); it is only
 * widened, through the same round steps a reader expects to see on an axis,
 * when it would otherwise blow the cap.
 */
const MAX_X_LABELS = 6;
const YEAR_STEPS = [1, 2, 4, 5, 10, 20, 25, 50] as const;

const xAxisYears = (dates: string[], span: number): {i: number; label: string}[] => {
  const first = Number(dates[0]?.slice(0, 4) ?? 0);
  const lastIdx = Math.min(Math.ceil(span), dates.length - 1);
  const last = Number(dates[lastIdx]?.slice(0, 4) ?? first);
  const years = last - first;
  let step = years <= 5 ? 1 : years <= 11 ? 2 : years <= 20 ? 4 : 5;
  for (const s of YEAR_STEPS) {
    if (s < step) continue;
    step = s;
    if (Math.floor(years / s) + 1 <= MAX_X_LABELS) break;
  }
  const out: {i: number; label: string}[] = [];
  for (let y = first; y <= last; y++) {
    if ((y - first) % step !== 0) continue;
    const i = dates.findIndex((d) => Number(d.slice(0, 4)) === y);
    if (i >= 0 && i <= span) out.push({i, label: String(y)});
  }
  return out;
};

export const Plot: React.FC<{
  spec: ChartSpec;
  data: ChartData;
  idx: number;
  /** 0..1 wipe-in of the frame furniture. */
  intro?: number;
}> = ({spec, data, idx, intro = 1}) => {
  const log = spec.scale === 'log';
  const dom = yDomain(data, idx, {log, floor: spec.yFloor, headroom: log ? 0.35 : 0.14});
  const span = xSpan(idx, data.dates.length);
  const gridValues = ticks(dom.min, dom.max, log, log ? 4 : 5);

  const xOf = (i: number) => PLOT.x + (i / (span || 1)) * PLOT.w;
  const yOf = (v: number) => PLOT_B - yFrac(v, dom.min, dom.max, log) * PLOT.h;

  const byKey = new Map(data.series.map((s) => [s.key, s.values]));

  // Line heads, de-overlapped as a group so no two badges collide.
  const rawHeads: Head[] = [];
  for (const s of spec.series) {
    const values = byKey.get(s.key);
    if (!values) continue;
    const v = valueAt(values, idx);
    if (v === null || !Number.isFinite(v)) continue;
    const y = yOf(v);
    rawHeads.push({key: s.key, y, yLine: y, v});
  }
  // A badge is 62 tall and centred on its y, so the clamp has to leave half of
  // it inside the frame — clamping to the plot edge itself cropped the leading
  // badge, which is the one the whole film is about.
  const heads = new Map(
    deOverlap(rawHeads, 84, PLOT.y + 34, PLOT_B + 4).map((h) => [h.key, h]),
  );
  const headX = xOf(idx);

  /**
   * With no hook card in front of it, frame 0 IS the cover frame. At idx 0 every
   * series is worth exactly the same, so de-overlap fans eight identical heads
   * into an 84px-spaced column parked at the left edge — which reads as a
   * floating legend of eight different values that are in fact all the same
   * number, above lines that have no length yet. So the head furniture emerges
   * with the lines rather than preceding them: invisible at the first point,
   * fully present once the run is a few percent in and the ranking means
   * something.
   */
  const emerge = Math.min(Math.max(idx / Math.max((data.dates.length - 1) * 0.05, 1), 0), 1);

  const leaderKey = standingsAt(data, idx)[0]?.key;

  return (
    <>
      <svg
        width={VW}
        height={VH}
        viewBox={`0 0 ${VW} ${VH}`}
        style={{position: 'absolute', inset: 0}}
      >
        <defs>
          {spec.series.map((s) => (
            <linearGradient key={s.key} id={`fill-${spec.id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* gridlines + y labels */}
        {gridValues.map((v) => {
          const y = yOf(v);
          if (!Number.isFinite(y)) return null;
          // Fade a line in as it enters from the top rather than popping.
          const edge = Math.min(1, Math.max(0, (y - PLOT.y) / 26));
          return (
            <g key={`g${v}`} opacity={edge * intro}>
              <line
                x1={PLOT.x}
                y1={y}
                x2={PLOT_R + 24}
                y2={y}
                stroke={C.hairline}
                strokeWidth={1.5}
              />
              <text
                x={PLOT.x - 18}
                y={y + 8}
                textAnchor="end"
                fill={C.muted}
                fontFamily={F.mono}
                fontSize={25}
                letterSpacing="0.04em"
              >
                {formatTick(v, spec.unit)}
              </text>
            </g>
          );
        })}

        {/* baseline + x labels */}
        <line
          x1={PLOT.x}
          y1={PLOT_B}
          x2={PLOT_R + 24}
          y2={PLOT_B}
          stroke={C.hairline2}
          strokeWidth={2}
          opacity={intro}
        />
        {xAxisYears(data.dates, span)
          // The right end of the axis is where the head badges live; a year
          // label there gets printed straight through a value readout.
          .filter((t) => xOf(t.i) < PLOT_R - 175)
          .map((t) => (
          <text
            key={t.label}
            x={xOf(t.i)}
            y={PLOT_B + 42}
            textAnchor="middle"
            fill={C.dim}
            fontFamily={F.mono}
            fontSize={25}
            letterSpacing="0.06em"
            opacity={intro}
          >
            {t.label}
          </text>
          ))}

        {/* the lines */}
        {spec.series.map((s) => {
          const values = byKey.get(s.key);
          if (!values) return null;
          const pts = pointsUpTo(values, idx);
          if (pts.length < 2) return null;
          const d = pts
            .map((p, k) => {
              const x = xOf(p.i);
              const y = yOf(p.v);
              if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
              return `${k === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(' ');
          if (!d.trim()) return null;
          const area = `${d} L${xOf(pts[pts.length - 1].i).toFixed(2)} ${PLOT_B} L${xOf(pts[0].i).toFixed(2)} ${PLOT_B} Z`;
          const lead = s.key === leaderKey;
          const width = s.emphasis || lead ? 7 : 4.5;
          return (
            <g key={s.key}>
              {(s.emphasis || lead) && <path d={area} fill={`url(#fill-${spec.id}-${s.key})`} />}
              {/* glow underlay — a wide, faint copy of the same path */}
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={width + 10}
                strokeOpacity={lead ? 0.16 : 0.08}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={width}
                strokeOpacity={lead || s.emphasis ? 1 : 0.85}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* A badge nudged clear of its neighbours is no longer sitting on its own
            number, so the true point keeps a dot and a connector to it. The
            value being read is always the one at the dot. */}
        {spec.series.map((s) => {
          const h = heads.get(s.key);
          if (!h) return null;
          const offset = Math.abs(h.y - h.yLine);
          return (
            <g key={`stub-${s.key}`} opacity={emerge}>
              {offset >= 4 ? (
                <line
                  x1={headX}
                  y1={h.yLine}
                  x2={headX}
                  y2={h.y}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeOpacity={0.45}
                  strokeDasharray="4 5"
                />
              ) : null}
              <circle cx={headX} cy={h.yLine} r={6} fill={s.color} />
            </g>
          );
        })}
      </svg>

      {/* head badges live in the DOM so they can use real type */}
      {spec.series.map((s) => {
        const h = heads.get(s.key);
        if (!h) return null;
        return (
          <HeadBadge
            key={s.key}
            color={s.color}
            label={s.label}
            medallion={s.medallion}
            value={formatValue(h.v, spec.unit)}
            x={headX}
            y={h.y}
            leading={s.key === leaderKey}
            opacity={emerge}
          />
        );
      })}

      {/* what the axis is, said out loud — its own row, clear of the subtitle
          above it and of the plot below (both of which it used to sit on) */}
      <div style={{position: 'absolute', top: 440, right: SAFE.portrait.sides, display: 'flex', gap: 12}}>
        {log ? <AxisChip text="LOG SCALE" accent /> : null}
        <AxisChip text={axisChipText(spec, data)} />
      </div>
    </>
  );
};

/**
 * What the y axis is holding, read from the dataset's own method line rather
 * than guessed from the unit.
 *
 * It used to be `unit === 'pct' ? 'CUMULATIVE %' : 'PORTFOLIO VALUE'`, which is
 * true of a rebased chart and FALSE of one that draws levels: the interest-rate
 * film is six published rates, nothing is cumulative and nothing is rebased,
 * and the chip sat over it announcing "CUMULATIVE %". A chip is a claim about
 * the arithmetic, so it comes from the line that records the arithmetic — the
 * one the fetcher writes and the source block prints underneath.
 */
const axisChipText = (spec: ChartSpec, data: ChartData): string => {
  if (/^Cumulative % change/.test(data.method)) return 'CUMULATIVE %';
  if (/^Value of \$/.test(data.method)) return 'PORTFOLIO VALUE';
  return 'AS PUBLISHED';
};

const AxisChip: React.FC<{text: string; accent?: boolean}> = ({text, accent}) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: 25,
      fontWeight: 500,
      letterSpacing: '0.12em',
      lineHeight: 1,
      padding: '13px 20px',
      borderRadius: 999,
      border: `1.5px solid ${accent ? C.macro : C.hairline2}`,
      color: accent ? C.macro : C.muted,
      background: C.panel,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

/**
 * The badge at the head of a line. Text sits to the LEFT of the medallion —
 * behind the direction of travel, so it never covers the line's own future —
 * and flips to the right when the head is still close to the left edge.
 */
const HeadBadge: React.FC<{
  color: string;
  label: string;
  value: string;
  medallion?: ChartSpec['series'][number]['medallion'];
  x: number;
  y: number;
  leading: boolean;
  opacity: number;
}> = ({color, label, value, medallion, x, y, leading, opacity}) => {
  const frame = useCurrentFrame();
  const glow = leading ? pulse01((frame % 70) / 48) : 0;
  const D = 62;
  const TEXT_W = 268;
  const flipRight = x - TEXT_W - D / 2 - 14 < PLOT.x;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        display: 'flex',
        flexDirection: flipRight ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        opacity,
        transform: `translate(${flipRight ? -D / 2 : -(TEXT_W + 12 + D / 2)}px, -50%)`,
      }}
    >
      <div
        style={{
          width: TEXT_W,
          textAlign: flipRight ? 'left' : 'right',
          lineHeight: 1.08,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 25,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color,
            whiteSpace: 'nowrap',
            // Deliberately NOT `overflow: hidden`: a clipped label reads as a
            // shorter word rather than as a bug ("Median home sold" printed as
            // "Median home so"), so overflow is left visible for the stills
            // sweep to catch.
            // The badge sits ON the lines. Without a backing, a label crossing a
            // bright line becomes unreadable for the frames it takes to pass.
            textShadow: '0 0 12px rgba(10,13,18,0.98), 0 0 4px rgba(10,13,18,1)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 30,
            fontWeight: 700,
            color: leading ? C.ink : C.muted,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 12px rgba(10,13,18,0.98), 0 0 4px rgba(10,13,18,1)',
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          width: D,
          height: D,
          borderRadius: 999,
          border: `3px solid ${color}`,
          background: C.panel2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          overflow: 'hidden',
          boxShadow: `0 0 ${12 + glow * 22}px ${color}${leading ? '99' : '55'}`,
        }}
      >
        {medallion && medallion.kind === 'image' ? (
          <Img
            src={staticFile(`faces/${medallion.file}`)}
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        ) : (
          <span
            style={{
              fontFamily: F.mono,
              fontSize: medallion && medallion.text.length > 2 ? 22 : 26,
              fontWeight: 700,
              letterSpacing: '0.02em',
              color,
              lineHeight: 1,
            }}
          >
            {medallion ? medallion.text : label.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Live rail — the order, as it stands right now                             */
/* -------------------------------------------------------------------------- */

/**
 * A running leaderboard under the date. It re-sorts as the race runs, which is
 * the one thing a line chart cannot show on its own: WHO IS AHEAD is obvious at
 * the end and unreadable in the middle, where six lines are a centimetre apart.
 *
 * Positions are absolute and animated, so a series overtaking another slides
 * past it rather than teleporting.
 */
export const LiveRail: React.FC<{
  spec: ChartSpec;
  data: ChartData;
  idx: number;
  at?: number;
}> = ({spec, data, idx, at = 0}) => {
  const frame = useCurrentFrame();
  const order = standingsAt(data, idx);
  const meta = new Map(spec.series.map((s) => [s.key, s]));
  const AVAIL = VW - SAFE.portrait.sides * 2;
  /**
   * The column count is a starting preference that YIELDS TO THE LABELS.
   *
   * Four fixed columns are right for tickers and wrong for words: at 240px a
   * cell holds about ten characters of 25px mono, and "10-yr Treasury" is
   * fourteen — so the rail printed each label straight through its neighbour,
   * `nowrap` and unclipped, and the bottom of the frame read as noise. Type
   * floors forbid shrinking the text, so the grid gives way instead. The
   * preference is kept as it was, and only ever reduced, so the two published
   * films lay out exactly as they were published (their labels already fit).
   */
  const CHAR = 16; // 25px JetBrains Mono advance (0.6em) + 0.04em tracking
  const FURNITURE = 78; // rank column, dot, both gaps, and the cell's own inset
  const widest = Math.max(...order.map((r) => (meta.get(r.key)?.label ?? r.key).length));
  let COLS = order.length > 4 ? 4 : 2;
  while (COLS > 1 && AVAIL / COLS < FURNITURE + CHAR * widest) COLS--;
  const CW = AVAIL / COLS;
  /**
   * Fewer columns means more rows, and the band between the rail and the source
   * block is fixed. Rows are compressed to fit it rather than allowed to print
   * over the receipts — at two rows this is a no-op, which is every chart made
   * before words arrived in the rail.
   */
  const rows = Math.ceil(order.length / COLS);
  const RH = Math.min(52, Math.floor((SOURCE_TOP - RAIL_TOP) / rows));
  return (
    <div
      style={{
        position: 'absolute',
        top: RAIL_TOP,
        left: SAFE.portrait.sides,
        width: VW - SAFE.portrait.sides * 2,
        height: RH * Math.ceil(order.length / COLS),
        opacity: lerp(frame, [at, at + 16], [0, 1]),
      }}
    >
      {order.map((r, rank) => {
        const s = meta.get(r.key);
        const col = rank % COLS;
        const row = Math.floor(rank / COLS);
        return (
          <div
            key={r.key}
            style={{
              position: 'absolute',
              left: col * CW,
              top: row * RH,
              width: CW - 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              // Rank changes animate because left/top are read from the CURRENT
              // standing every frame; a transition would be wall-clock driven
              // and is forbidden here, so the slide comes from the data itself.
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 22,
                color: C.dim,
                width: 26,
                flex: '0 0 auto',
              }}
            >
              {rank + 1}
            </span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: s?.color ?? C.ink,
                flex: '0 0 auto',
              }}
            />
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 25,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: rank === 0 ? C.ink : C.muted,
                whiteSpace: 'nowrap',
              }}
            >
              {s?.label ?? r.key}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Final standings — derived, never typed                                    */
/* -------------------------------------------------------------------------- */

/**
 * The payoff table. Every number here is read out of the frozen dataset at
 * render time, so no figure on screen can drift away from the file the source
 * line points at — the same discipline the product's own written briefs use.
 */
export const Standings: React.FC<{
  spec: ChartSpec;
  data: ChartData;
  at?: number;
  rows?: number;
}> = ({spec, data, at = 0, rows = 8}) => {
  const frame = useCurrentFrame();
  const last = data.dates.length - 1;
  const order = standingsAt(data, last).slice(0, rows);
  const meta = new Map(spec.series.map((s) => [s.key, s]));
  const top = order[0]?.v ?? 1;
  // A log chart followed by linear bars contradicts itself: the six lines the
  // viewer just watched climb hard would all collapse to a dot. The bar uses
  // whatever scale the plot used.
  const dom = yDomain(data, last, {log: spec.scale === 'log', floor: spec.yFloor, headroom: 0});
  const barFrac = (v: number) =>
    spec.scale === 'log' ? yFrac(v, dom.min, dom.max, true) : Math.min(v / (top || 1), 1);
  return (
    <div
      style={{
        position: 'absolute',
        top: 500,
        left: SAFE.portrait.sides,
        width: VW - SAFE.portrait.sides * 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {order.map((r, i) => {
        const s = meta.get(r.key);
        const app = pop(frame, at + i * 5, 13, 0.8);
        const bar = lerp(frame, [at + i * 5 + 6, at + i * 5 + 30], [0, 1], easeOut);
        const frac = r.v !== null && r.v > 0 ? Math.max(barFrac(r.v), 0.015) : 0;
        return (
          <div
            key={r.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              opacity: lerp(frame, [at + i * 5, at + i * 5 + 9], [0, 1]),
              transform: `translateX(${(1 - Math.min(app, 1)) * -26}px)`,
            }}
          >
            <div
              style={{
                width: 46,
                fontFamily: F.mono,
                fontSize: 26,
                color: C.dim,
                lineHeight: 1,
                flex: '0 0 auto',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
            <div
              style={{
                width: 210,
                fontFamily: F.mono,
                fontSize: 27,
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: s?.color ?? C.ink,
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}
            >
              {s?.label ?? r.key}
            </div>
            <div style={{flex: 1, height: 12, borderRadius: 99, background: C.panel, overflow: 'hidden'}}>
              <div
                style={{
                  width: `${frac * bar * 100}%`,
                  height: '100%',
                  borderRadius: 99,
                  background: s?.color ?? C.ink,
                }}
              />
            </div>
            <div
              style={{
                width: 214,
                textAlign: 'right',
                fontFamily: F.display,
                fontSize: 31,
                fontWeight: 700,
                color: i === 0 ? C.confluence : C.ink,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                flex: '0 0 auto',
              }}
            >
              {r.v === null ? 'n/a' : formatValue(r.v, spec.unit)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
