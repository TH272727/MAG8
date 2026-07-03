"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { DiscoveryCandidate } from "@/lib/schemas";

export default function CandidateCard({
  candidate,
  index,
  entrance,
}: {
  candidate: DiscoveryCandidate;
  index: number;
  /** Animate in only when cards arrive live mid-run; terminal renders settle instantly. */
  entrance: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const animateIn = entrance && !reduced;
  const shownTraits = candidate.matchedTraits.slice(0, 3);
  const more = candidate.matchedTraits.length - shownTraits.length;

  return (
    <motion.article
      initial={animateIn ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.6), ease: "easeOut" }}
      className="panel flex flex-col p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xl font-bold tracking-wide">{candidate.ticker}</span>
        <span className="truncate text-right font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
          {candidate.sector}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-muted">{candidate.companyName}</p>
      <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-muted">{candidate.thesis}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {shownTraits.map((t) => (
          <span key={t} className="chip inline-block max-w-full truncate border-discovery/40 text-discovery">
            {t}
          </span>
        ))}
        {more > 0 && <span className="chip">+{more}</span>}
      </div>
    </motion.article>
  );
}
