import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RunView from "@/components/run/RunView";
import { launchMode } from "@/lib/config";
import { getRunSnapshot } from "@/lib/db";
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
  // Public-view boundary: RunView is a client component — its props ride the RSC flight payload.
  return <RunView snapshot={toPublicSnapshot(snapshot)} />;
}
