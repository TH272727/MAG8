"use client";

import ActivityFeed from "./ActivityFeed";

export default function DiscoveryFeed({
  lines,
  searching,
  marketContext,
}: {
  lines: string[];
  searching: boolean;
  marketContext: string | null;
}) {
  return (
    <div className="panel border-t-2 border-t-discovery/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-discovery">Discovery scout</h3>
        {searching && (
          <span className="chip border-discovery/40 text-discovery">
            <span className="live-dot" style={{ background: "var(--color-discovery)" }} aria-hidden="true" />
            SEARCHING
          </span>
        )}
      </div>
      <div className="mt-3">
        <ActivityFeed lines={lines} emptyText="Spinning up the scout — first searches land shortly…" />
      </div>
      {marketContext && (
        <p className="mt-4 border-t border-hairline pt-3 text-sm leading-relaxed text-muted">{marketContext}</p>
      )}
    </div>
  );
}
