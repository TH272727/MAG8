import Link from "next/link";
import LogoMark from "@/components/logo";
import { launchMode } from "@/lib/config";
import { getActiveRun } from "@/lib/db";

export default async function Nav() {
  // Pre-launch curtain: only Methodology survives in the nav (the hidden pages 404).
  const launch = launchMode();
  const active = launch ? null : getActiveRun();
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-void/90 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Mag8 home">
          <LogoMark size={22} />
          <span className="font-display text-[17px] font-bold tracking-[0.08em]">MAG8</span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-2">
          {active && (
            <Link
              href={`/runs/${active.id}`}
              className="chip mr-1 shrink-0 border-fundamentals/40 text-fundamentals hover:border-fundamentals"
            >
              <span className="live-dot" aria-hidden="true" />
              LIVE RUN
            </Link>
          )}
          {!launch && (
            <Link href="/rankings" className="shrink-0 rounded px-2 py-1.5 text-[13px] text-muted transition-colors hover:text-ink sm:px-2.5 sm:text-sm">
              Rankings
            </Link>
          )}
          {!launch && (
            <Link href="/lab" className="shrink-0 rounded px-2 py-1.5 text-[13px] text-muted transition-colors hover:text-ink sm:px-2.5 sm:text-sm">
              Lab
            </Link>
          )}
          <Link href="/methodology" className="shrink-0 rounded px-2 py-1.5 text-[13px] text-muted transition-colors hover:text-ink sm:px-2.5 sm:text-sm">
            Methodology
          </Link>
          {!launch && (
            <Link href="/admin" className="shrink-0 rounded px-2 py-1.5 text-[13px] text-muted transition-colors hover:text-ink sm:px-2.5 sm:text-sm">
              Admin
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
