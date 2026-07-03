import type { LensSkill } from "@/lib/schemas";

/* ============================================================================
 * Confluence Line geometry — hand-authored beziers, viewBox 0 0 1200 240.
 * Four threads converge at (760,120); a three-strand gold braid carries the
 * agreement to the score chip at (1126,120). No runtime path math.
 * ========================================================================== */

export const VIEWBOX_FULL = "0 0 1200 240";
/** Right half only: convergence, braid, chip — for compact row rendering. */
export const VIEWBOX_COMPACT = "560 30 640 180";

export type ThreadKey = "discovery" | LensSkill;

export interface ThreadDef {
  key: ThreadKey;
  /** CSS custom property carrying the thread color. */
  colorVar: string;
  d: string;
}

export const THREADS: ThreadDef[] = [
  {
    key: "discovery",
    colorVar: "--color-discovery",
    d: "M 0 36 C 240 36, 420 44, 560 70 C 660 89, 722 106, 760 120",
  },
  {
    key: "stock-scanner",
    colorVar: "--color-fundamentals",
    d: "M 0 92 C 240 92, 430 96, 580 104 C 672 109, 726 114, 760 120",
  },
  {
    key: "gt-predictor",
    colorVar: "--color-macro",
    d: "M 0 148 C 240 148, 430 144, 580 136 C 672 131, 726 126, 760 120",
  },
  {
    key: "institutional-forecast",
    colorVar: "--color-consensus",
    d: "M 0 204 C 240 204, 420 196, 560 170 C 660 151, 722 134, 760 120",
  },
];

/** Three pre-baked overlapping gold strands — the braid. */
export const BRAID_PATHS: string[] = [
  "M 760 120 C 805 104, 845 104, 890 120 C 935 136, 975 136, 1020 120 C 1045 111, 1066 111, 1082 120",
  "M 760 120 C 805 136, 845 136, 890 120 C 935 104, 975 104, 1020 120 C 1045 129, 1066 129, 1082 120",
  "M 760 120 C 792 112, 830 128, 872 120 C 917 111, 952 129, 997 120 C 1032 114, 1060 125, 1082 120",
];

export const CHIP = { cx: 1126, cy: 120, r: 38 };
