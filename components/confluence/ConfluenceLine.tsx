"use client";

import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  BRAID_PATHS,
  CHIP,
  THREADS,
  VIEWBOX_COMPACT,
  VIEWBOX_FULL,
  type ThreadKey,
} from "./paths";

export type ThreadState = "idle" | "active" | "done" | "error";

export interface ConfluenceLineProps {
  mode: "ambient" | "live" | "static";
  /** Per-thread state (live mode); static mode treats undefined as done. */
  threads?: Partial<Record<ThreadKey, ThreadState>>;
  /** Final confluence score — mounts the gold chip. */
  score?: number | null;
  /** Crop to the convergence + braid + chip (leaderboard rows, stock headers). */
  compact?: boolean;
  className?: string;
  label?: string;
}

const THREAD_OPACITY: Record<ThreadState, number> = {
  idle: 0.16,
  active: 0.5,
  done: 1,
  error: 0.3,
};

/** One-shot count-up rendered inside the chip. */
function ScoreValue({ value, animateIn }: { value: number; animateIn: boolean }) {
  const mv = useMotionValue(animateIn ? 0 : value);
  const text = useTransform(mv, (v) => v.toFixed(1));
  useEffect(() => {
    if (!animateIn) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return () => controls.stop();
  }, [value, animateIn, mv]);
  return <motion.tspan>{text}</motion.tspan>;
}

/**
 * The Mag8 signature: four lens threads converging into a gold braid that
 * terminates in the confluence score. Gold appears here and only here.
 */
export default function ConfluenceLine({
  mode,
  threads,
  score = null,
  compact = false,
  className,
  label,
}: ConfluenceLineProps) {
  const reduced = useReducedMotion() ?? false;
  const effectiveMode = reduced ? "static" : mode;

  const stateOf = (key: ThreadKey): ThreadState => {
    const s = threads?.[key];
    if (s) return s;
    return mode === "static" ? "done" : "idle";
  };

  const doneCount = THREADS.filter((t) => stateOf(t.key) === "done").length;
  const braidProgress = effectiveMode === "static" || effectiveMode === "ambient" ? 1 : doneCount / THREADS.length;
  const braidOpacity =
    effectiveMode === "ambient" ? 0.75 : 0.25 + 0.7 * braidProgress;

  const showChip = score !== null && score !== undefined;
  const strokeW = compact ? 4.5 : 2.5;
  const braidW = compact ? 3.5 : 2;

  const ariaLabel =
    label ??
    (showChip
      ? `Confluence line — final score ${score?.toFixed(1)}`
      : `Confluence line — ${doneCount} of ${THREADS.length} threads complete`);

  return (
    <svg
      viewBox={compact ? VIEWBOX_COMPACT : VIEWBOX_FULL}
      className={className}
      role="img"
      aria-label={ariaLabel}
      fill="none"
    >
      {/* ---- threads ---- */}
      {THREADS.map((t, i) => {
        const state = stateOf(t.key);
        const stroke = state === "error" ? "var(--color-danger)" : `var(${t.colorVar})`;

        if (effectiveMode === "ambient") {
          return (
            <motion.path
              key={t.key}
              d={t.d}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: [0, 1, 1], opacity: [0.2, 0.9, 0.35] }}
              transition={{
                duration: 5.2,
                times: [0, 0.55, 1],
                repeat: Infinity,
                repeatDelay: 0.6,
                delay: i * 0.45,
                ease: "easeInOut",
              }}
            />
          );
        }

        if (effectiveMode === "live") {
          return (
            <g key={t.key}>
              <motion.path
                d={t.d}
                stroke={stroke}
                strokeWidth={strokeW}
                strokeLinecap="round"
                initial={false}
                animate={{ opacity: THREAD_OPACITY[state] }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
              {state === "active" && (
                <motion.circle
                  r={compact ? 6 : 4.5}
                  fill={stroke}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0.4] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  style={{ offsetPath: `path("${t.d}")`, offsetRotate: "0deg" }}
                />
              )}
            </g>
          );
        }

        // static
        return (
          <path
            key={t.key}
            d={t.d}
            stroke={stroke}
            strokeWidth={strokeW}
            strokeLinecap="round"
            opacity={THREAD_OPACITY[state] === 1 ? 0.92 : THREAD_OPACITY[state]}
          />
        );
      })}

      {/* ---- braid (gold — the verdict forming) ---- */}
      {BRAID_PATHS.map((d, i) =>
        effectiveMode === "ambient" ? (
          <motion.path
            key={i}
            d={d}
            stroke="var(--color-confluence)"
            strokeWidth={braidW}
            strokeLinecap="round"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: [0.25, 0.8, 0.25] }}
            transition={{ duration: 4.4, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
          />
        ) : effectiveMode === "live" ? (
          <motion.path
            key={i}
            d={d}
            stroke="var(--color-confluence)"
            strokeWidth={braidW}
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: Math.max(0.02, braidProgress), opacity: braidOpacity }}
            transition={{ type: "spring", stiffness: 55, damping: 16 }}
          />
        ) : (
          <path
            key={i}
            d={d}
            stroke="var(--color-confluence)"
            strokeWidth={braidW}
            strokeLinecap="round"
            opacity={0.9}
          />
        ),
      )}

      {/* ---- terminus ---- */}
      {showChip ? (
        <motion.g
          initial={effectiveMode === "live" ? { scale: 0.7, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 18 }}
          style={{ transformOrigin: `${CHIP.cx}px ${CHIP.cy}px` }}
        >
          <circle cx={CHIP.cx} cy={CHIP.cy} r={CHIP.r} fill="var(--color-panel)" stroke="var(--color-confluence)" strokeWidth={2.5} />
          <text
            x={CHIP.cx}
            y={CHIP.cy - 4}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-confluence)"
            style={{ font: `700 ${compact ? 30 : 26}px var(--font-mono)` }}
          >
            <ScoreValue value={score as number} animateIn={effectiveMode === "live"} />
          </text>
          <text
            x={CHIP.cx}
            y={CHIP.cy + 18}
            textAnchor="middle"
            fill="var(--color-muted)"
            style={{ font: `500 10px var(--font-mono)`, letterSpacing: "0.12em" }}
          >
            /100
          </text>
        </motion.g>
      ) : effectiveMode === "ambient" ? (
        <motion.circle
          cx={CHIP.cx}
          cy={CHIP.cy}
          r={8}
          fill="var(--color-confluence)"
          initial={{ opacity: 0.3, scale: 0.9 }}
          animate={{ opacity: [0.3, 0.95, 0.3], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${CHIP.cx}px ${CHIP.cy}px` }}
        />
      ) : (
        <circle
          cx={CHIP.cx}
          cy={CHIP.cy}
          r={7}
          fill="var(--color-confluence)"
          opacity={effectiveMode === "live" ? 0.25 + 0.6 * braidProgress : 0.85}
        />
      )}
    </svg>
  );
}
