import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RunView from "@/components/run/RunView";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { getRunSnapshot, runTally } from "@/lib/db";
import { LENS_SKILLS } from "@/lib/schemas";
import { toPublicSnapshot } from "@/lib/public-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ runId: string }> }): Promise<Metadata> {
  if (launchMode()) return {};
  const { runId } = await params;
  return { title: `Run ${runId.slice(0, 8)} — mission control` };
}

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  // Pre-launch curtain: replays stay in the tree but 404 until launch.
  if (launchMode()) notFound();

  const { runId } = await params;
  const snapshot = getRunSnapshot(decodeURIComponent(runId));
  if (!snapshot) notFound();

  // Resume is an operator affordance: computed only for an unlocked desk, so a
  // visitor's payload never carries it. Mirrors planResume()'s gate; the API
  // re-checks the token and the real plan before anything spends.
  const { run } = snapshot;
  const admin = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
  const stopped = run.status === "error" || run.status === "interrupted";
  let resume: { remaining: number; total: number } | null = null;
  if (admin && stopped && !run.params.mock) {
    const tally = runTally(run.id);
    if (tally.cohort > 0) {
      const total = tally.cohort * LENS_SKILLS.length;
      resume = { remaining: total - tally.banked, total };
    }
  }

  // Public-view boundary: RunView is a client component — its props ride the RSC flight payload.
  return <RunView snapshot={toPublicSnapshot(snapshot)} resume={resume} />;
}
