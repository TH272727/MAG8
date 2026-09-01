import Link from "next/link";
import { RISK_PROFILES, type RiskProfileKey } from "@/lib/insider/profiles";

/* ============================================================================
 * The risk-tolerance selector.
 *
 * A server component and a set of plain links, deliberately. Choosing a
 * tolerance is a whole new reading of the data — a different candidate list,
 * different rejection reasons, different scores — so it belongs in the URL,
 * where it can be shared, bookmarked and read back. Nothing is stored about
 * who chose what.
 *
 * It costs nothing to offer because nothing derived is stored: every figure on
 * the page is recomputed from filings, closes and statements already on disk.
 * That is the whole reason this control can exist for a visitor rather than
 * only for an operator.
 * ========================================================================== */

export default function RiskProfilePicker({
  active,
  basePath,
}: {
  active: RiskProfileKey;
  basePath: string;
}) {
  return (
    <section className="mt-6" aria-labelledby="risk-h">
      <h2 id="risk-h" className="eyebrow">
        Your risk tolerance
      </h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
        How far a stock may have fallen, how convinced the buying has to look, and how much cushion a valuation
        must leave are not facts about the market. They are a statement about what you are willing to carry, and
        this board has no opinion about which answer is right. Pick one and every figure below is recomputed.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {RISK_PROFILES.map((p) => {
          const on = p.key === active;
          return (
            <Link
              key={p.key}
              href={p.key === "house" ? basePath : `${basePath}?risk=${p.key}`}
              aria-current={on ? "true" : undefined}
              className={`rounded-md border px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] transition-colors ${
                on
                  ? "border-hairline bg-panel text-ink"
                  : "border-hairline bg-panel2 text-dim hover:text-ink"
              }`}
            >
              {p.label.toUpperCase()}
            </Link>
          );
        })}
      </div>
      <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-dim">
        {RISK_PROFILES.find((p) => p.key === active)?.blurb}
      </p>
    </section>
  );
}
