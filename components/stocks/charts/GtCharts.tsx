"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { MetricValue } from "@/lib/schemas";
import { asArr, asNum, asObj, asStr, markFill } from "./chartUtils";

/* ============================================================================
 * Macro-asymmetry instruments: asymmetry dial, horizon probability fan,
 * player map (Mass × Coordination, dot size = Energy). All null-safe — rows
 * persisted before these fields existed render the card unchanged.
 * ========================================================================== */

const ACCENT = "var(--color-macro)";
const AXIS_TICK = { fill: "var(--color-dim)", fontSize: 10, fontFamily: "var(--font-mono)" } as const;

/** Semicircular 1–10 gauge. Fixed-size SVG (text at native scale). */
function AsymmetryDial({ value }: { value: number }) {
  const v = Math.min(10, Math.max(0, value));
  const R = 46;
  const LEN = Math.PI * R;
  const frac = v / 10;
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`Asymmetry score ${v} of 10`}>
      <svg viewBox="0 0 120 70" className="w-[132px]" aria-hidden="true">
        <path d="M 14 62 A 46 46 0 0 1 106 62" stroke="var(--color-hairline2)" strokeWidth={8} strokeLinecap="round" fill="none" />
        <path
          d="M 14 62 A 46 46 0 0 1 106 62"
          stroke={ACCENT}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${Math.max(0.01, frac) * LEN} ${LEN}`}
        />
        <text
          x={60}
          y={54}
          textAnchor="middle"
          fill="var(--color-ink)"
          style={{ font: "700 21px var(--font-mono)" }}
        >
          {Math.round(v * 10) / 10}
        </text>
        <text x={60} y={67} textAnchor="middle" fill="var(--color-dim)" style={{ font: "500 9px var(--font-mono)", letterSpacing: "0.1em" }}>
          / 10
        </text>
      </svg>
      <span className="eyebrow mt-1">Asymmetry</span>
    </div>
  );
}

interface HorizonPoint {
  h: string;
  p: number;
}

function FanTooltip({ active, payload }: { active?: boolean; payload?: { payload?: HorizonPoint }[] }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="panel-raised px-3 py-2 font-mono text-[12px]">
      <span className="text-muted">{d.h}</span> <span className="text-ink">{d.p}%</span>
    </div>
  );
}

/** Primary-outcome probability across the 3→24-month horizons. */
function HorizonFan({ points }: { points: HorizonPoint[] }) {
  const last = points[points.length - 1];
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Horizon probability</span>
        <span className="font-mono text-[11px] text-dim">
          {last.h} <span className="text-muted">{last.p}%</span>
        </span>
      </div>
      <div
        className="mt-1 h-[132px] w-full"
        role="img"
        aria-label={`Primary-outcome probability by horizon: ${points.map((d) => `${d.h} ${d.p}%`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 14, bottom: 0, left: -14 }}>
            <CartesianGrid vertical={false} stroke="var(--color-hairline)" strokeOpacity={0.55} />
            <XAxis dataKey="h" tick={AXIS_TICK} axisLine={{ stroke: "var(--color-hairline)" }} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<FanTooltip />} cursor={{ stroke: "var(--color-hairline2)" }} />
            <Line
              dataKey="p"
              stroke={ACCENT}
              strokeWidth={2}
              isAnimationActive={false}
              dot={{ r: 4, fill: ACCENT, stroke: "var(--color-panel)", strokeWidth: 2 }}
              activeDot={{ r: 5.5, fill: ACCENT, stroke: "var(--color-panel)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface PlayerPoint {
  idx: number;
  name: string;
  role: string | null;
  read: string | null;
  m: number;
  e: number;
  c: number;
}

function PlayerTooltip({ active, payload }: { active?: boolean; payload?: { payload?: PlayerPoint }[] }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="panel-raised max-w-60 px-3 py-2 font-mono text-[12px]">
      <div className="text-ink">
        {d.idx}. {d.name}
      </div>
      <div className="mt-0.5 text-muted">
        M {d.m} · E {d.e} · C {d.c}
      </div>
      {d.read && <div className="mt-1 text-[11px] leading-snug text-dim">{d.read}</div>}
    </div>
  );
}

/** Numbered dot per player; digit ink picked for contrast on the copper fill. */
function PlayerDot(props: { cx?: number; cy?: number; payload?: PlayerPoint; size?: number }) {
  const { cx = 0, cy = 0, payload, size = 80 } = props;
  const r = Math.sqrt(size / Math.PI);
  if (!payload) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={markFill("--color-macro")} stroke="var(--color-panel)" strokeWidth={2} />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fill="var(--color-void)" style={{ font: "700 9px var(--font-mono)" }}>
        {payload.idx}
      </text>
    </g>
  );
}

/** Mass × Coordination map, dot area = Energy; a numbered roster carries names. */
function PlayerMap({ players }: { players: PlayerPoint[] }) {
  return (
    <div className="sm:col-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Player map</span>
        <span className="font-mono text-[10px] text-dim">x mass · y coordination · size energy</span>
      </div>
      <div
        className="mt-1 h-[190px] w-full"
        role="img"
        aria-label={`Player map: ${players.map((p) => `${p.name} mass ${p.m}, energy ${p.e}, coordination ${p.c}`).join("; ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 14, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="var(--color-hairline)" strokeOpacity={0.55} />
            <XAxis
              type="number"
              dataKey="m"
              domain={[0, 10]}
              ticks={[0, 5, 10]}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--color-hairline)" }}
              tickLine={false}
            />
            <YAxis type="number" dataKey="c" domain={[0, 10]} ticks={[0, 5, 10]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <ZAxis type="number" dataKey="e" domain={[0, 10]} range={[60, 240]} />
            <Tooltip content={<PlayerTooltip />} cursor={{ strokeDasharray: "0", stroke: "var(--color-hairline2)" }} />
            <Scatter data={players} shape={<PlayerDot />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ol className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-[11px] text-muted sm:grid-cols-2">
        {players.map((p) => (
          <li key={p.idx} className="truncate" title={p.read ?? undefined}>
            <span className="text-ink">{p.idx}</span> {p.name}
            {p.role ? <span className="text-dim"> — {p.role}</span> : null}
            <span className="text-dim">
              {" "}
              · M{p.m} E{p.e} C{p.c}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function GtCharts({ km }: { km: Record<string, MetricValue> }) {
  const asym = asNum(km.asymmetryScore);

  const hp = asObj(km.horizonProbabilities);
  const points: HorizonPoint[] = [];
  if (hp) {
    for (const [key, label] of [
      ["m3", "3m"],
      ["m6", "6m"],
      ["m12", "12m"],
      ["m24", "24m"],
    ] as const) {
      const p = asNum(hp[key]);
      if (p !== null) points.push({ h: label, p: Math.round(Math.min(100, Math.max(0, p))) });
    }
  }

  const playersRaw = asArr(km.players) ?? [];
  const players: PlayerPoint[] = [];
  for (const raw of playersRaw.slice(0, 8)) {
    const o = asObj(raw);
    if (!o) continue;
    const name = asStr(o.name);
    const m = asNum(o.m);
    const e = asNum(o.e);
    const c = asNum(o.c);
    if (name === null || m === null || e === null || c === null) continue;
    players.push({
      idx: players.length + 1,
      name,
      role: asStr(o.role),
      read: asStr(o.read),
      m: Math.min(10, Math.max(0, m)),
      e: Math.min(10, Math.max(0, e)),
      c: Math.min(10, Math.max(0, c)),
    });
  }

  const showFan = points.length >= 2;
  const showMap = players.length >= 1;
  if (asym === null && !showFan && !showMap) return null;

  return (
    <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {(asym !== null || showFan) && (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4 sm:col-span-2">
          {asym !== null && <AsymmetryDial value={asym} />}
          {showFan && <HorizonFan points={points} />}
        </div>
      )}
      {showMap && <PlayerMap players={players} />}
    </div>
  );
}
