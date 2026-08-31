"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ============================================================================
 * One indicator's ratio, over its full stored history.
 *
 * Four layers, in the order the published method asks for them: the ratio, its
 * 50- and 200-day averages, shaded bands over the stretches where the ratio was
 * more than two standard deviations from its own year, and a marker on every
 * session where the reading changed state.
 *
 * The shaded bands are ranges in TIME, not a channel around the line. The
 * deviation is measured against a rolling window, so the boundary moves with
 * the data; drawing it as a fixed envelope would imply a constant it does not
 * have. What the method describes, and what is drawn, is when the ratio was
 * stretched — an interval on the date axis.
 *
 * Gold is the leaderboard's verdict colour and is never used here.
 * ========================================================================== */

export interface ChartPoint {
  date: string;
  value: number;
  fast: number | null;
  slow: number | null;
  z: number | null;
}

export interface ChartMarker {
  date: string;
  value: number;
  label: string;
  strengthening: boolean;
}

export interface Band {
  from: string;
  to: string;
}

const RATIO = "var(--color-discovery)";
const FAST = "var(--color-consensus)";
const SLOW = "var(--color-dim)";
const AXIS_TICK = { fill: "var(--color-dim)", fontSize: 10, fontFamily: "var(--font-mono)" } as const;

const shortDate = (iso: string) => `${iso.slice(2, 4)}-${iso.slice(5, 7)}`;

function ChartTooltip({
  active,
  payload,
  markers,
}: {
  active?: boolean;
  payload?: { payload?: ChartPoint }[];
  markers: Map<string, ChartMarker>;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  const marker = markers.get(d.date);
  return (
    <div className="panel-raised max-w-[260px] px-3 py-2 font-mono text-[12px]">
      <div className="text-dim">{d.date}</div>
      <div className="mt-1 text-ink">
        ratio <span className="tabular">{d.value.toFixed(4)}</span>
      </div>
      {d.fast !== null && (
        <div className="text-muted">
          50-day <span className="tabular">{d.fast.toFixed(4)}</span>
        </div>
      )}
      {d.slow !== null && (
        <div className="text-muted">
          200-day <span className="tabular">{d.slow.toFixed(4)}</span>
        </div>
      )}
      {d.z !== null && (
        <div className="text-muted">
          deviation <span className="tabular">{d.z >= 0 ? "+" : ""}{d.z.toFixed(2)}</span>
        </div>
      )}
      {marker && <div className="mt-1.5 border-t border-hairline pt-1.5 text-macro">{marker.label}</div>}
    </div>
  );
}

/** Contiguous runs where the ratio sat beyond two deviations from its own year. */
export function stretchBands(points: ChartPoint[], threshold = 2): Band[] {
  const bands: Band[] = [];
  let start: string | null = null;
  let last: string | null = null;
  for (const p of points) {
    const beyond = p.z !== null && Math.abs(p.z) > threshold;
    if (beyond && start === null) start = p.date;
    if (!beyond && start !== null) {
      bands.push({ from: start, to: last ?? start });
      start = null;
    }
    last = p.date;
  }
  if (start !== null && last !== null) bands.push({ from: start, to: last });
  return bands;
}

export default function RotationChart({
  points,
  markers,
  label,
  height = 320,
}: {
  points: ChartPoint[];
  markers: ChartMarker[];
  label: string;
  height?: number;
}) {
  // A chart needs something to show. Two points and a flat line is a decoration,
  // not a reading, so render nothing rather than a degenerate axis.
  if (points.length < 30) return null;

  const bands = stretchBands(points);
  const byDate = new Map(markers.map((m) => [m.date, m]));
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.02 || 1;

  const first = points[0].date;
  const last = points[points.length - 1].date;
  const summary =
    `${label}: ratio from ${points[0].value.toFixed(4)} on ${first} to ` +
    `${points[points.length - 1].value.toFixed(4)} on ${last}, with ${markers.length} state ` +
    `change${markers.length === 1 ? "" : "s"} marked and ${bands.length} stretched ` +
    `period${bands.length === 1 ? "" : "s"} shaded.`;

  return (
    <div className="w-full" style={{ height }} role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 14, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--color-hairline)" strokeOpacity={0.55} />
          {bands.map((b) => (
            <ReferenceArea
              key={`${b.from}-${b.to}`}
              x1={b.from}
              x2={b.to}
              fill="var(--color-macro)"
              fillOpacity={0.1}
              stroke="none"
              ifOverflow="hidden"
            />
          ))}
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={AXIS_TICK}
            axisLine={{ stroke: "var(--color-hairline)" }}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            domain={[lo - pad, hi + pad]}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={58}
            tickFormatter={(v: number) => v.toFixed(3)}
          />
          <Tooltip
            content={<ChartTooltip markers={byDate} />}
            cursor={{ stroke: "var(--color-hairline2)" }}
          />
          <Line
            dataKey="slow"
            stroke={SLOW}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            dataKey="fast"
            stroke={FAST}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line dataKey="value" stroke={RATIO} strokeWidth={2} dot={false} isAnimationActive={false} />
          {markers.map((m) => (
            <ReferenceDot
              key={m.date}
              x={m.date}
              y={m.value}
              r={4}
              fill={m.strengthening ? "var(--color-macro)" : "var(--color-panel)"}
              stroke={m.strengthening ? "var(--color-panel)" : "var(--color-macro)"}
              strokeWidth={2}
              ifOverflow="visible"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
