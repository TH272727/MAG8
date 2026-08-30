import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cloneManagerAction, type CloneView } from "@/app/bottleneck/actions";
import CloneConsole from "@/components/bottleneck/CloneConsole";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { bottleneckSettings } from "@/lib/bottleneck-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Institutional clone",
  description:
    "Read any institutional manager's disclosed US equity book straight from their Form 13F-HR, with the position changes since the previous quarter and the filing lag stated on every screen.",
};

/**
 * Module A — the institutional clone.
 *
 * Holdings are public because the filing is. The sizing panel is not: it is
 * decided on the SERVER, so a visitor's payload never carries it, and the
 * action behind it re-checks the token anyway.
 */
export default async function ClonePage({
  searchParams,
}: {
  searchParams: Promise<{ cik?: string }>;
}) {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const { cik: raw } = await searchParams;
  const cik = raw && /^\d{1,10}$/.test(raw) ? Number(raw) : null;

  let initial: CloneView | null = null;
  let initialError: string | null = null;
  if (cik !== null) {
    const res = await cloneManagerAction(cik);
    if (res.ok) initial = res.clone;
    else initialError = res.message;
  }

  const unlocked = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
  const lagDays = bottleneckSettings().filingLagDays;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The bottleneck desk · institutional filings</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        What the money already bought.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        A manager running more than $100 million has to disclose their US equity positions every quarter, on Form
        13F-HR. This reads one straight from the source: the whole long book with each position&apos;s weight, the
        options reported beside it, and what actually changed since the quarter before.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        The rule allows up to {lagDays} days between the quarter it describes and the day it appears, so a book on
        screen may be a month and a half old. Nothing here is a live position, and nothing here is investment advice.
      </p>

      <CloneConsole initial={initial} initialError={initialError} unlocked={unlocked} />

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
