"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ScoreWithDirection from "./ScoreWithDirection";

/* ============================================================================
 * The signals table: every indicator, sortable and filterable, linking to its
 * own chart.
 *
 * Two rules this table has to respect.
 *
 * An indicator that could not be scored always sinks to the bottom. Sorting by
 * score ascending must not float the unmeasured ones to the top as though they
 * were the quietest readings on the board.
 *
 * And the score is never rendered without the side it favours. It is a
 * magnitude, not a verdict — the highest number in this column can be a strong
 * move against the asset it is filed under.
 * ========================================================================== */

export interface TableRow {
  id: string;
  label: string;
  category: string;
  categoryTitle: string;
  score: number | null;
  tier: string;
  tierLabel: string;
  tierChip: string;
  tierAccent: string;
  direction: string;
  directionLabel: string;
  dirGlyph: string;
  dirTicker: string | null;
  dirLabel: string;
  dirAccent: string;
  daysSince: number | null;
  sinceLabel: string;
  scoreLabel: string;
  mixedBasis: boolean;
  stale: boolean;
}

type SortKey = "score" | "label" | "category" | "since";

const HEADERS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "label", label: "Indicator", numeric: false },
  { key: "category", label: "Category", numeric: false },
  { key: "score", label: "Score", numeric: true },
  { key: "since", label: "Last change", numeric: true },
];

export default function RotationTable({ rows }: { rows: TableRow[] }) {
  const [sort, setSort] = useState<SortKey>("score");
  const [asc, setAsc] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.category, r.categoryTitle);
    return [...seen.entries()];
  }, [rows]);

  const shown = useMemo(() => {
    const filtered = rows.filter(
      (r) => (category === "all" || r.category === category) && (tier === "all" || r.tier === tier),
    );
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      // Unscorable rows sink whichever way the reader sorts.
      if (sort === "score") {
        const aNull = a.score === null;
        const bNull = b.score === null;
        if (aNull !== bNull) return aNull ? 1 : -1;
        if (aNull) return a.label.localeCompare(b.label);
        return (a.score! - b.score!) * dir;
      }
      if (sort === "since") {
        const aNull = a.daysSince === null;
        const bNull = b.daysSince === null;
        if (aNull !== bNull) return aNull ? 1 : -1;
        if (aNull) return a.label.localeCompare(b.label);
        return (a.daysSince! - b.daysSince!) * dir;
      }
      if (sort === "category") return a.categoryTitle.localeCompare(b.categoryTitle) * dir;
      return a.label.localeCompare(b.label) * dir;
    });
  }, [rows, sort, asc, category, tier]);

  function toggle(key: SortKey) {
    if (key === sort) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "label" || key === "category");
    }
  }

  const selectClass =
    "rounded-md border border-hairline bg-void px-2 py-1.5 font-mono text-[12px] text-ink " +
    "focus:border-discovery/60 focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-dim">CATEGORY</span>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All</option>
            {categories.map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-dim">TIER</span>
          <select className={selectClass} value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">All</option>
            <option value="strong">Strong Pivot Signal</option>
            <option value="building">Building</option>
            <option value="neutral">Neutral / Rangebound</option>
            <option value="none">No Signal</option>
          </select>
        </label>
        <span className="font-mono text-[11px] text-dim">
          {shown.length} of {rows.length}
        </span>
      </div>

      <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-dim">
        The score measures how <span className="text-muted">decisively</span> a ratio is moving, not which way.
        The marker beside it names the side that move favours, so a high score can mean a strong move in
        either direction — including against the asset the row is named for.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">
            Every rotation indicator with its score, tier, direction and time since its last state change.
          </caption>
          <thead>
            <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  scope="col"
                  className={`pb-2 font-normal ${h.numeric ? "text-right" : ""}`}
                  aria-sort={sort === h.key ? (asc ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggle(h.key)}
                    className="cursor-pointer tracking-[0.1em] hover:text-ink"
                  >
                    {h.label.toUpperCase()}
                    {sort === h.key && <span aria-hidden="true">{asc ? " ↑" : " ↓"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-hairline align-top">
                <td className="py-2.5 pr-3">
                  <Link href={`/rotation/${r.id}`} className="text-ink hover:underline">
                    {r.label}
                  </Link>
                  <div className="mt-0.5 text-[12px] text-muted">{r.directionLabel}</div>
                  {(r.mixedBasis || r.stale) && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.mixedBasis && <span className="chip">MIXED PRICE BASIS</span>}
                      {r.stale && <span className="chip">STALE</span>}
                    </div>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-[13px] text-muted">{r.categoryTitle}</td>
                <td className="py-2.5 pr-3 text-right">
                  <div className="flex justify-end">
                    <ScoreWithDirection
                      scoreLabel={r.scoreLabel}
                      tierAccent={r.tierAccent}
                      glyph={r.dirGlyph}
                      ticker={r.dirTicker}
                      directionLabel={r.dirLabel}
                      dirAccent={r.dirAccent}
                    />
                  </div>
                  <div className="mt-1 flex justify-end">
                    <span className={`chip ${r.tierChip}`}>{r.tierLabel}</span>
                  </div>
                </td>
                <td className="tabular py-2.5 text-right font-mono text-[13px] text-muted">{r.sinceLabel}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={HEADERS.length} className="py-6 text-center text-[13px] text-dim">
                  No indicator matches that filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
