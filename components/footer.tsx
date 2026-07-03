import Link from "next/link";

/** §12 disclaimer — present in the footer of every page. */
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-hairline">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="eyebrow mb-3">Important — read this</p>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
          Mag8 is a research experiment, not investment advice. Its output is produced by AI models that
          can be wrong, out of date, or overconfident, applied to public information that may itself be
          wrong. Nothing here is an offer, solicitation, or recommendation to buy or sell any security;
          no fiduciary relationship is created. Scores are arithmetic over model judgments, not
          predictions of returns, and past results never guarantee future ones. Do your own research and
          consider consulting a licensed financial professional before making any investment decision.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/methodology" className="text-[13px] text-muted underline underline-offset-2 hover:text-ink">
            How scoring works
          </Link>
          <span className="font-mono text-[11px] tracking-[0.1em] text-dim">
            MAG8 · FOUR LENSES · ONE SIGNAL
          </span>
        </div>
      </div>
    </footer>
  );
}
