import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import LabPanel from "@/components/lab/LabPanel";
import type { RunEstimate } from "@/components/admin/AdminPanel";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { CONFIG, estimateRun, launchMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lab",
  description: "Focused Mag8 pipeline runs — point the discovery scout at the slice of the market you care about.",
};

export default async function LabPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  // A directive can arrive pre-filled from elsewhere (the Bottleneck desk sends
  // one). It is a starting point in an editable box, never an instruction: the
  // same 280-character cap the pipeline enforces applies here too.
  const { focus } = await searchParams;
  const initialFocus = typeof focus === "string" ? focus.slice(0, 280) : "";

  const cookieToken = (await cookies()).get(ADMIN_COOKIE)?.value ?? null;
  const adminUnlocked = tokenMatches(cookieToken);

  const estimates: Record<number, RunEstimate> = {};
  for (let c = CONFIG.candidates.min; c <= CONFIG.candidates.max; c++) {
    estimates[c] = estimateRun(c);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The lab</p>
      <h1 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Point the pipeline at your corner of the market.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        The weekly MAG8 board stays canonical — same universe, same rubric, every run. A lab run adds
        a <span className="text-ink">focus directive</span> that scopes which stocks the discovery
        scout hunts (&ldquo;small cap only&rdquo;, &ldquo;tech stocks only&rdquo;, &ldquo;energy
        transition under $10B&rdquo;), and an optional <span className="text-ink">blind-selection</span>{" "}
        experiment that picks the cohort from anonymized fundamentals cards before any research. The
        three lenses and the scoring arithmetic are untouched, so a lab board is directly comparable to
        the main one.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        Focused runs consume real research capacity, so launching one requires the operator token for
        now — the console below is exactly what opens up when member access ships.
      </p>

      <div className="mt-8">
        <LabPanel
          authMode={CONFIG.authMode()}
          allowMock={CONFIG.allowMock()}
          defaultCount={CONFIG.candidates.default}
          estimates={estimates}
          adminUnlocked={adminUnlocked}
          initialFocus={initialFocus}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-5">
          <h2 className="font-display text-base font-semibold">Scopes discovery only</h2>
          <p className="mt-2 text-sm text-muted">
            The directive narrows the hunt. It cannot change the universe rules, the lens methods, or
            a single scoring constant — if it conflicts with the rules, the rules win.
          </p>
        </div>
        <div className="panel p-5">
          <h2 className="font-display text-base font-semibold">Same rigor per ticker</h2>
          <p className="mt-2 text-sm text-muted">
            Every lab candidate still gets all three independent lenses and the deterministic
            arithmetic re-check. Cells completed earlier this week are reused at no extra cost.
          </p>
        </div>
        <div className="panel p-5">
          <h2 className="font-display text-base font-semibold">Blind selection</h2>
          <p className="mt-2 text-sm text-muted">
            Optional: the scout picks its shortlist from anonymized fundamentals cards — no ticker or
            name — then researches the un-blinded names. It measures how much name recognition, not
            data, drives a normal cohort. It reduces name-bias; a distinctive profile can still hint a
            name, so it does not erase it.
          </p>
        </div>
        <div className="panel p-5">
          <h2 className="font-display text-base font-semibold">Labeled everywhere</h2>
          <p className="mt-2 text-sm text-muted">
            Lab runs carry a FOCUS or BLIND chip on the live view and in history, and stay off the
            canonical weekly board, so a scoped or experimental board is never mistaken for it.
          </p>
        </div>
      </div>

      <p className="mt-8 text-[13px] text-dim">
        Curious how scoring works?{" "}
        <Link href="/methodology" className="underline underline-offset-2 hover:text-ink">
          Read the methodology
        </Link>
        . Research, not investment advice.
      </p>
    </main>
  );
}
