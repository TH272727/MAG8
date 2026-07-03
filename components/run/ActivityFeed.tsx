"use client";

import { useEffect, useRef } from "react";

/** Auto-scrolling mono telemetry feed. */
export default function ActivityFeed({
  lines,
  emptyText = "Waiting for activity…",
  maxHeightClass = "max-h-44",
}: {
  lines: string[];
  emptyText?: string;
  maxHeightClass?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  if (lines.length === 0) {
    return <p className="feed text-dim">{emptyText}</p>;
  }

  return (
    <div ref={boxRef} className={`feed overflow-y-auto pr-2 ${maxHeightClass}`} role="log" aria-label="Agent activity">
      {lines.map((line, i) => (
        <div key={`${i}-${line.slice(0, 24)}`} className="feed-line">
          <span aria-hidden="true" className="select-none text-dim">
            ▸
          </span>
          <span className="min-w-0 break-words">{line}</span>
        </div>
      ))}
    </div>
  );
}
