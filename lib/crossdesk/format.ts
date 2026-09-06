import type { ClaimKind, DeskKey } from "./claims";

/* ============================================================================
 * Presentation only. Nothing rounded here ever feeds a calculation.
 *
 * Gold is absent on purpose. On this platform gold marks the pipeline's final
 * verdict, and a crossing is an observation about where four desks happen to
 * overlap — emphatically not a verdict, and not the pipeline's.
 * ========================================================================== */

export const DESK_META: Record<DeskKey, { label: string; short: string; href: string }> = {
  pipeline: { label: "The weekly board", short: "BOARD", href: "/rankings" },
  insider: { label: "The insider scanner", short: "INSIDER", href: "/insider" },
  bottleneck: { label: "The bottleneck desk", short: "BOTTLENECK", href: "/bottleneck" },
  rotation: { label: "The rotation board", short: "ROTATION", href: "/rotation" },
};

export const KIND_META: Record<ClaimKind, { label: string; note: string; chip: string }> = {
  measured: {
    label: "Measured",
    note: "This desk computed a figure about this company.",
    chip: "gate-pass",
  },
  curated: {
    label: "Curated",
    note: "This company sits on a list kept by hand; the state beside it is what was measured.",
    chip: "",
  },
  context: {
    label: "Context",
    note: "About the neighbourhood, never about the company.",
    chip: "",
  },
};

export function fmtCap(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function fmtScore(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toFixed(1);
}

/** "two desks" reads better than "2 desks" in a sentence. */
export function countWord(n: number): string {
  return ["no", "one", "two", "three", "four"][n] ?? String(n);
}
