"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { RunStreamState } from "@/lib/hooks/useRunStream";
import {
  PUBLIC_DISCOVERY,
  PUBLIC_LENSES,
  PUBLIC_LENS_META,
  publicCellKey,
  type PublicLens,
} from "@/lib/public-lens";

/* ============================================================================
 * PipelineMap — the desk schematic, live. Discovery feeds the candidate
 * cohort, the cohort fans out to three independent lens lanes, the lanes
 * converge on the compiler, and the compiler terminates in the verdict node.
 * Same visual language as ConfluenceLine (hand-authored beziers, offset-path
 * packets, reduced-motion-safe). Gold appears ONLY on the verdict node.
 *
 * Additive to the run page: it complements the StageRail (which stays the
 * coarse status strip); this is the topology view.
 * ========================================================================== */

type NodeState = "idle" | "active" | "done" | "error";

interface LaneRead {
  lens: PublicLens;
  done: number;
  errors: number;
  total: number;
  state: NodeState;
}

function deriveLanes(state: RunStreamState): LaneRead[] {
  return PUBLIC_LENSES.map((lens) => {
    const total = state.candidates.length;
    let done = 0;
    let errors = 0;
    let running = false;
    for (const c of state.candidates) {
      const cell = state.cells[publicCellKey(c.ticker, lens)];
      if (cell?.status === "done") done++;
      else if (cell?.status === "error") errors++;
      else if (cell?.status === "running") running = true;
    }
    const settled = total > 0 && done + errors === total;
    const state_: NodeState = running
      ? "active"
      : settled || state.report !== null
        ? done > 0
          ? "done"
          : errors > 0
            ? "error"
            : "idle"
        : done + errors > 0
          ? "active"
          : "idle";
    return { lens, done, errors, total, state: state_ };
  });
}

const EDGE_OPACITY: Record<NodeState, number> = { idle: 0.18, active: 0.6, done: 0.9, error: 0.3 };
const LENS_VAR: Record<PublicLens, string> = {
  fundamentals: "var(--color-fundamentals)",
  macro: "var(--color-macro)",
  consensus: "var(--color-consensus)",
};

const MONO = "var(--font-mono)";

/** Animated flow edge: opacity by state, a traveling packet while active. */
function FlowEdge({
  d,
  color,
  state,
  reduced,
  width = 1.8,
}: {
  d: string;
  color: string;
  state: NodeState;
  reduced: boolean;
  width?: number;
}) {
  return (
    <g>
      <motion.path
        d={d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
        initial={false}
        animate={{ opacity: EDGE_OPACITY[state] }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      {state === "active" && !reduced && (
        <motion.circle
          r={3.2}
          fill={color}
          initial={{ offsetDistance: "0%", opacity: 0 }}
          animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0.3] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ offsetPath: `path("${d}")`, offsetRotate: "0deg" }}
        />
      )}
    </g>
  );
}

/** Status dot with an active pulse; error renders in danger. */
function StatusDot({
  cx,
  cy,
  r,
  color,
  state,
  reduced,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
  state: NodeState;
  reduced: boolean;
}) {
  const stroke = state === "error" ? "var(--color-danger)" : color;
  const fillOpacity = state === "done" ? 0.95 : state === "active" ? 0.55 : 0.22;
  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill={stroke}
        stroke={stroke}
        strokeWidth={1.4}
        initial={false}
        animate={{ fillOpacity, opacity: state === "idle" ? 0.45 : 1 }}
        transition={{ duration: 0.5 }}
      />
      {state === "active" && !reduced && (
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={1.2}
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}
    </g>
  );
}

/** Verdict terminus — the only gold in the map. */
function VerdictNode({
  cx,
  cy,
  r,
  score,
  error,
  compact,
}: {
  cx: number;
  cy: number;
  r: number;
  score: number | null;
  error: boolean;
  compact?: boolean;
}) {
  if (score !== null) {
    return (
      <motion.g initial={false} animate={{ opacity: 1 }}>
        <circle cx={cx} cy={cy} r={r} fill="var(--color-panel)" stroke="var(--color-confluence)" strokeWidth={2.2} />
        <text
          x={cx}
          y={cy - (compact ? 1 : 2)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-confluence)"
          style={{ font: `700 ${compact ? 11 : 14}px ${MONO}` }}
        >
          {score.toFixed(1)}
        </text>
        <text
          x={cx}
          y={cy + (compact ? 9 : 11)}
          textAnchor="middle"
          fill="var(--color-muted)"
          style={{ font: `500 ${compact ? 6 : 7}px ${MONO}`, letterSpacing: "0.1em" }}
        >
          /100
        </text>
      </motion.g>
    );
  }
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={error ? "var(--color-danger)" : "var(--color-hairline2)"}
        strokeWidth={1.6}
        opacity={error ? 0.8 : 0.7}
      />
      {error ? (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="var(--color-danger)" style={{ font: `600 ${compact ? 11 : 13}px ${MONO}` }}>
          ✕
        </text>
      ) : (
        <circle cx={cx} cy={cy} r={2.5} fill="var(--color-hairline2)" />
      )}
    </g>
  );
}

const label = (x: number, y: number, text: string, size = 9, fill = "var(--color-dim)") => (
  <text x={x} y={y} textAnchor="middle" fill={fill} style={{ font: `500 ${size}px ${MONO}`, letterSpacing: "0.12em" }}>
    {text}
  </text>
);

export default function PipelineMap({ state }: { state: RunStreamState }) {
  const reduced = useReducedMotion() ?? false;

  const discoveryState: NodeState =
    state.candidates.length > 0
      ? "done"
      : state.error
        ? "error"
        : state.stage === "discovery"
          ? "active"
          : "idle";
  const lanes = deriveLanes(state);
  const compileState: NodeState = state.report
    ? "done"
    : state.error && state.stage === "compile"
      ? "error"
      : state.stage === "compile"
        ? "active"
        : "idle";
  const topScore = state.report?.rankings[0]?.finalScore ?? null;
  const settledCells = lanes.reduce((n, l) => n + l.done + l.errors, 0);
  const totalCells = state.candidates.length * lanes.length;

  const aria = state.report
    ? `Pipeline map: run complete, top score ${topScore?.toFixed(1)} of 100.`
    : state.error
      ? "Pipeline map: run ended with an error."
      : state.candidates.length === 0
        ? "Pipeline map: discovery in progress."
        : `Pipeline map: ${state.candidates.length} candidates, ${settledCells} of ${totalCells} lens analyses settled.`;

  const n = state.candidates.length;
  const chipH = n > 0 ? Math.min(15, (176 - (n - 1) * 2) / n) : 0;
  const chipsTop = 100 - (n * chipH + (n - 1) * 2) / 2;

  const E2: Record<PublicLens, string> = {
    fundamentals: "M 208 100 C 248 100, 270 48, 312 48",
    macro: "M 208 100 C 248 100, 270 100, 312 100",
    consensus: "M 208 100 C 248 100, 270 152, 312 152",
  };
  const E3: Record<PublicLens, string> = {
    fundamentals: "M 472 48 C 505 48, 522 88, 542 94",
    macro: "M 472 100 C 505 100, 522 100, 542 100",
    consensus: "M 472 152 C 505 152, 522 112, 542 106",
  };
  const LANE_Y: Record<PublicLens, number> = { fundamentals: 48, macro: 100, consensus: 152 };

  const cohortState: NodeState = n > 0 ? "done" : discoveryState === "active" ? "active" : "idle";
  const anyLaneActive = lanes.some((l) => l.state === "active");

  return (
    <figure aria-label={aria} className="m-0">
      {/* ---- full layout (≥ sm) ---- */}
      <svg viewBox="0 0 760 200" className="hidden w-full sm:block" aria-hidden="true" fill="none">
        {/* scout → cohort */}
        <FlowEdge
          d="M 44 100 C 80 100, 105 100, 140 100"
          color="var(--color-discovery)"
          state={discoveryState === "done" ? (n > 0 ? "done" : "idle") : discoveryState}
          reduced={reduced}
        />
        <StatusDot cx={34} cy={100} r={9} color="var(--color-discovery)" state={discoveryState} reduced={reduced} />
        {label(34, 126, PUBLIC_DISCOVERY.short)}

        {/* cohort column */}
        <rect
          x={142}
          y={12}
          width={64}
          height={176}
          rx={5}
          stroke="var(--color-hairline)"
          strokeWidth={1}
          fill="var(--color-panel2)"
          opacity={n > 0 ? 0.6 : 0.3}
        />
        {n === 0 && label(174, 103, "COHORT", 8)}
        {state.candidates.map((c, i) => (
          <motion.g
            key={c.ticker}
            initial={state.terminal || reduced ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduced ? 0 : i * 0.05, duration: 0.35 }}
          >
            <rect
              x={146}
              y={chipsTop + i * (chipH + 2)}
              width={56}
              height={chipH}
              rx={2.5}
              fill="var(--color-panel)"
              stroke="var(--color-hairline)"
            />
            <text
              x={174}
              y={chipsTop + i * (chipH + 2) + chipH / 2 + 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--color-muted)"
              style={{ font: `500 ${Math.min(8.5, chipH - 4)}px ${MONO}`, letterSpacing: "0.06em" }}
            >
              {c.ticker}
            </text>
          </motion.g>
        ))}

        {/* cohort → lens lanes, lane nodes, lanes → compiler */}
        {lanes.map((lane) => {
          const y = LANE_Y[lane.lens];
          const color = LENS_VAR[lane.lens];
          const meta = PUBLIC_LENS_META[lane.lens];
          return (
            <g key={lane.lens}>
              <FlowEdge d={E2[lane.lens]} color={color} state={n === 0 ? "idle" : lane.state} reduced={reduced} />
              <motion.rect
                x={314}
                y={y - 14}
                width={158}
                height={28}
                rx={5}
                fill="var(--color-panel)"
                stroke={lane.state === "error" ? "var(--color-danger)" : color}
                strokeWidth={1.2}
                initial={false}
                animate={{ strokeOpacity: lane.state === "idle" ? 0.25 : lane.state === "active" ? 0.8 : 0.6 }}
              />
              <text x={323} y={y + 0.5} dominantBaseline="central" fill="var(--color-muted)" style={{ font: `600 8.5px ${MONO}`, letterSpacing: "0.07em" }}>
                {meta.label.toUpperCase()}
              </text>
              <text x={463} y={y + 0.5} textAnchor="end" dominantBaseline="central" style={{ font: `600 10px ${MONO}` }}>
                <tspan fill={lane.total > 0 && lane.done > 0 ? "var(--color-ink)" : "var(--color-dim)"}>
                  {lane.total > 0 ? `${lane.done}/${lane.total}` : "—"}
                </tspan>
                {lane.errors > 0 && <tspan fill="var(--color-danger)"> ✕{lane.errors}</tspan>}
              </text>
              <FlowEdge
                d={E3[lane.lens]}
                color={color}
                state={compileState !== "idle" ? compileState : lane.state === "done" ? "done" : "idle"}
                reduced={reduced}
              />
            </g>
          );
        })}

        {/* compiler */}
        <motion.rect
          x={542}
          y={84}
          width={92}
          height={32}
          rx={5}
          fill="var(--color-panel)"
          stroke={compileState === "error" ? "var(--color-danger)" : "var(--color-hairline2)"}
          strokeWidth={1.4}
          initial={false}
          animate={{ strokeOpacity: compileState === "idle" ? 0.5 : 1, opacity: compileState === "idle" ? 0.6 : 1 }}
        />
        {compileState === "active" && !reduced && (
          <motion.rect
            x={542}
            y={84}
            width={92}
            height={32}
            rx={5}
            fill="none"
            stroke="var(--color-hairline2)"
            strokeWidth={1.2}
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: "588px 100px" }}
          />
        )}
        <text
          x={588}
          y={100.5}
          textAnchor="middle"
          dominantBaseline="central"
          fill={compileState === "idle" ? "var(--color-dim)" : "var(--color-ink)"}
          style={{ font: `600 10px ${MONO}`, letterSpacing: "0.14em" }}
        >
          COMPILE
        </text>

        {/* compiler → verdict */}
        <FlowEdge
          d="M 634 100 C 656 100, 670 100, 690 100"
          color="var(--color-hairline2)"
          state={state.report ? "done" : compileState}
          reduced={reduced}
          width={1.6}
        />
        <VerdictNode cx={714} cy={100} r={22} score={topScore} error={Boolean(state.error)} />
        {label(714, 136, "VERDICT", 8)}

        {/* lane-activity hint under the cohort while the matrix runs */}
        {anyLaneActive && label(174, 196, `${settledCells}/${totalCells} CELLS`, 8)}
      </svg>

      {/* ---- compact layout (< sm) ---- */}
      <svg viewBox="0 0 360 124" className="w-full sm:hidden" aria-hidden="true" fill="none">
        <FlowEdge d="M 30 60 C 42 60, 52 60, 64 60" color="var(--color-discovery)" state={discoveryState} reduced={reduced} />
        <StatusDot cx={22} cy={60} r={7} color="var(--color-discovery)" state={discoveryState} reduced={reduced} />
        {label(22, 80, PUBLIC_DISCOVERY.short, 7)}

        <rect x={66} y={48} width={46} height={24} rx={4} fill="var(--color-panel2)" stroke="var(--color-hairline)" opacity={n > 0 ? 1 : 0.4} />
        <text x={89} y={60.5} textAnchor="middle" dominantBaseline="central" fill={n > 0 ? "var(--color-ink)" : "var(--color-dim)"} style={{ font: `600 9px ${MONO}` }}>
          {n > 0 ? `N=${n}` : "—"}
        </text>

        {lanes.map((lane, i) => {
          const y = 26 + i * 34;
          const color = LENS_VAR[lane.lens];
          return (
            <g key={lane.lens}>
              <FlowEdge
                d={`M 112 60 C 130 60, 138 ${y}, 154 ${y}`}
                color={color}
                state={n === 0 ? "idle" : lane.state}
                reduced={reduced}
                width={1.5}
              />
              <StatusDot cx={162} cy={y} r={6} color={color} state={n === 0 ? "idle" : lane.state} reduced={reduced} />
              <text x={174} y={y + 0.5} dominantBaseline="central" style={{ font: `600 8px ${MONO}` }}>
                <tspan fill="var(--color-dim)">{PUBLIC_LENS_META[lane.lens].short}</tspan>
                <tspan fill={lane.done > 0 ? "var(--color-ink)" : "var(--color-dim)"}> {lane.total > 0 ? `${lane.done}/${lane.total}` : ""}</tspan>
                {lane.errors > 0 && <tspan fill="var(--color-danger)"> ✕</tspan>}
              </text>
              <FlowEdge
                d={`M 214 ${y} C 230 ${y}, 236 60, 250 ${60 + (i - 1) * 6}`}
                color={color}
                state={compileState !== "idle" ? compileState : lane.state === "done" ? "done" : "idle"}
                reduced={reduced}
                width={1.5}
              />
            </g>
          );
        })}

        <rect x={252} y={47} width={58} height={26} rx={4} fill="var(--color-panel)" stroke="var(--color-hairline2)" opacity={compileState === "idle" ? 0.6 : 1} />
        <text x={281} y={60.5} textAnchor="middle" dominantBaseline="central" fill={compileState === "idle" ? "var(--color-dim)" : "var(--color-ink)"} style={{ font: `600 8px ${MONO}`, letterSpacing: "0.1em" }}>
          COMPILE
        </text>
        <FlowEdge d="M 310 60 C 316 60, 318 60, 322 60" color="var(--color-hairline2)" state={state.report ? "done" : compileState} reduced={reduced} width={1.4} />
        <VerdictNode cx={338} cy={60} r={15} score={topScore} error={Boolean(state.error)} compact />
      </svg>
    </figure>
  );
}
