"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GATE_MULTIPLIER, WEIGHTS, weightedBase } from "@/lib/ranking";
import type { Gate, SubScores } from "@/lib/schemas";

interface RowDatum {
  key: keyof SubScores;
  name: string;
  weight: number;
  value: number;
  hue: string;
}

/** Fixed pipeline order; hues are the spec's lens colors (validated: CVD ΔE 57, contrast ≥3:1). */
const ROWS: Omit<RowDatum, "value">[] = [
  { key: "fundamentals", name: "Fundamentals", weight: WEIGHTS.fundamentals, hue: "#5fbf7a" },
  { key: "discoveryThesis", name: "Discovery thesis", weight: WEIGHTS.discoveryThesis, hue: "#8b7cff" },
  { key: "gtAsymmetry", name: "GT asymmetry", weight: WEIGHTS.gtAsymmetry, hue: "#e8a34a" },
  { key: "institutionalGap", name: "Institutional gap", weight: WEIGHTS.institutionalGap, hue: "#3fd1c9" },
];

function AxisTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const row = ROWS.find((r) => r.name === payload?.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-8} y={-2} textAnchor="end" fill="var(--color-ink)" fontSize={12} fontFamily="var(--font-body)">
        {payload?.value}
      </text>
      <text x={-8} y={12} textAnchor="end" fill="var(--color-dim)" fontSize={10} fontFamily="var(--font-mono)">
        ×{row?.weight.toFixed(2)}
      </text>
    </g>
  );
}

function ScoreTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: RowDatum }[];
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="panel-raised px-3 py-2 font-mono text-[12px]">
      <div className="text-ink">{d.name}</div>
      <div className="mt-1 text-muted">
        score <span className="text-ink">{d.value}</span> / 100
      </div>
      <div className="text-muted">
        contributes <span className="text-ink">{(d.value * d.weight).toFixed(1)}</span> to base
      </div>
    </div>
  );
}

export default function ScoreBreakdown({
  scores,
  gate,
  confluence,
  finalScore,
}: {
  scores: SubScores;
  gate: Gate;
  confluence: boolean;
  finalScore: number;
}) {
  const data: RowDatum[] = ROWS.map((r) => ({ ...r, value: scores[r.key] }));
  const base = weightedBase(scores);
  const mult = GATE_MULTIPLIER[gate];
  const gateText = gate === "pass" ? "text-fundamentals" : gate === "caution" ? "text-macro" : "text-danger";

  return (
    <div>
      <div className="h-[190px] w-full" role="img" aria-label={`Sub-scores: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 8 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-hairline)" strokeOpacity={0.55} />
            <XAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: "var(--color-dim)", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "var(--color-hairline)" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={126}
              tick={<AxisTick />}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ScoreTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="value" barSize={13} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d) => (
                // 80% mix over the panel keeps the spec hues inside the dark-fill lightness band.
                <Cell key={d.key} fill={`color-mix(in oklab, ${d.hue} 80%, var(--color-panel))`} stroke={d.hue} strokeWidth={1} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => String(v)}
                style={{ fill: "var(--color-ink)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Derivation strip: base → gate → bonus → final */}
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-4">
        <div className="bg-panel px-4 py-3">
          <div className="eyebrow">Weighted base</div>
          <div className="tabular mt-1 font-mono text-lg font-bold">{base.toFixed(1)}</div>
        </div>
        <div className="bg-panel px-4 py-3">
          <div className="eyebrow">Gate</div>
          <div className={`tabular mt-1 font-mono text-lg font-bold ${gateText}`}>
            {gate} ×{mult.toFixed(2)}
          </div>
        </div>
        <div className="bg-panel px-4 py-3">
          <div className="eyebrow">Confluence bonus</div>
          <div className={`tabular mt-1 font-mono text-lg font-bold ${confluence ? "text-confluence" : "text-dim"}`}>
            {confluence ? "+10" : "—"}
          </div>
        </div>
        <div className="bg-panel px-4 py-3">
          <div className="eyebrow">Final score</div>
          <div className="tabular mt-1 font-mono text-lg font-bold text-confluence">{finalScore.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
