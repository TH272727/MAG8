import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { exposureAction } from "@/app/bottleneck/actions";
import ExposureConsole from "@/components/bottleneck/ExposureConsole";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { bottleneckSettings } from "@/lib/bottleneck-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Exposure audit",
  description:
    "Cross-reference a portfolio against the companies that produce each constrained input, with concentration and absence flagged. Informational only.",
};

/**
 * Module D — the exposure audit. Admin-only in full: the input is the owner's
 * own portfolio, so a locked desk renders the explanation and nothing else.
 * The actions behind the console re-check the token on every call.
 */
export default async function ExposurePage() {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const unlocked = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
  const initial = unlocked ? await exposureAction() : null;
  const concentrationPct = bottleneckSettings().concentrationPct;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The bottleneck desk · exposure</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Where a portfolio actually sits.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        The desk works out which physical input is the tightest constraint and who produces it. This answers the only
        question that follows: how much of a given portfolio is with those producers, how much is somewhere else, and
        how that compares to a manager whose book you can read.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        It reports and it flags — concentration above {concentrationPct}% of a portfolio in one input&apos;s producers,
        and tight constraints with no exposure at all. It proposes no trade, rebalances nothing, and is not investment
        advice.
      </p>

      {unlocked && initial ? (
        <ExposureConsole initial={initial} />
      ) : (
        <div className="panel mt-8 p-6">
          <h2 className="font-display text-lg font-semibold">This one stays behind the desk</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            An exposure audit takes a real portfolio as its input, so it runs only for the operator. What the desk
            reads about the world — which input is tightest, who produces it, and what any manager disclosed owning —
            is public and needs no key.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/bottleneck" className="btn">
              The bottleneck reading
            </Link>
            <Link href="/bottleneck/clone" className="btn">
              Read an institutional book
            </Link>
          </div>
        </div>
      )}

      <p className="mt-10 text-[13px] text-dim">
        Back to{" "}
        <Link href="/bottleneck" className="underline underline-offset-2 hover:text-ink">
          the bottleneck reading
        </Link>
        . Research, not investment advice.
      </p>
    </main>
  );
}
