import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RunView from "@/components/run/RunView";
import { getRunSnapshot } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ runId: string }> }): Promise<Metadata> {
  const { runId } = await params;
  return { title: `Run ${runId.slice(0, 8)} — mission control` };
}

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const snapshot = getRunSnapshot(decodeURIComponent(runId));
  if (!snapshot) notFound();
  return <RunView snapshot={snapshot} />;
}
