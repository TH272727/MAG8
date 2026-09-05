"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ============================================================================
 * One gauge's history: what it read, and how that ranked against its own past.
 *
 * Two axes on purpose. The reading alone cannot be judged — a credit spread of
 * 1.57 means nothing without knowing where 1.57 usually sits — and the stress
 * score alone hides what actually moved. Showing both is the only way the chart
 * says the same thing the page does.
 *
 * Gold is absent deliberately: it is the leaderboard's verdict colour.
 * ========================================================================== */

export interface ChartPoint {
  date: string;
  value: number;
  stress: number;
}

export default function TideChart({ points, unit }: { points: ChartPoint[]; unit: string }) {
  if (points.length < 2) {
    return (
      <p className="panel p-5 text-[13px] text-dim">
        There is not enough stored history to draw this reading.
      </p>
    );
  }
  return (
    <div className="panel p-4">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "var(--color-dim)" }}
              tickFormatter={(d: string) => d.slice(0, 4)}
              minTickGap={48}
              stroke="var(--color-hairline)"
            />
            <YAxis
              yAxisId="reading"
              tick={{ fontSize: 11, fill: "var(--color-dim)" }}
              stroke="var(--color-hairline)"
              width={56}
            />
            <YAxis
              yAxisId="stress"
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tick={{ fontSize: 11, fill: "var(--color-dim)" }}
              stroke="var(--color-hairline)"
              width={36}
            />
            <ReferenceLine yAxisId="stress" y={50} stroke="var(--color-hairline)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                background: "var(--color-panel)",
                border: "1px solid var(--color-hairline)",
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-dim)" }}
              formatter={(v, name) => {
                const n = typeof v === "number" ? v : Number(v);
                if (!Number.isFinite(n)) return ["—", String(name)];
                return name === "stress"
                  ? [n.toFixed(1), "score out of 100"]
                  : [n.toLocaleString("en-US", { maximumFractionDigits: 3 }), unit];
              }}
            />
            <Line
              yAxisId="reading"
              type="monotone"
              dataKey="value"
              name="value"
              stroke="var(--color-discovery)"
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="stress"
              type="monotone"
              dataKey="stress"
              name="stress"
              stroke="var(--color-macro)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-dim">
        Solid: the reading in its own units, left axis. Dashed: where that ranked against its own history, right
        axis, where a hundred is the worst this desk can report.
      </p>
    </div>
  );
}
