import Link from "next/link";
import { getActiveRun } from "@/lib/db";

/** Tiny four-thread glyph — the brand mark. Gold only appears at the terminus dot. */
function Mark() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" className="shrink-0">
      <path d="M0 2 C 10 2, 14 9, 21 9" stroke="var(--color-discovery)" strokeWidth="1.6" fill="none" />
      <path d="M0 6.7 C 9 6.7, 13 9, 21 9" stroke="var(--color-fundamentals)" strokeWidth="1.6" fill="none" />
      <path d="M0 11.3 C 9 11.3, 13 9, 21 9" stroke="var(--color-macro)" strokeWidth="1.6" fill="none" />
      <path d="M0 16 C 10 16, 14 9, 21 9" stroke="var(--color-consensus)" strokeWidth="1.6" fill="none" />
      <circle cx="23" cy="9" r="2.4" fill="var(--color-confluence)" />
    </svg>
  );
}

export default async function Nav() {
  const active = getActiveRun();
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-void/90 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Mag8 home">
          <Mark />
          <span className="font-display text-[17px] font-bold tracking-[0.08em]">MAG8</span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {active && (
            <Link
              href={`/runs/${active.id}`}
              className="chip mr-1 border-fundamentals/40 text-fundamentals hover:border-fundamentals"
            >
              <span className="live-dot" aria-hidden="true" />
              LIVE RUN
            </Link>
          )}
          <Link href="/rankings" className="rounded px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink">
            Rankings
          </Link>
          <Link href="/methodology" className="rounded px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink">
            Methodology
          </Link>
          <Link href="/admin" className="rounded px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink">
            Admin
          </Link>
        </div>
      </nav>
    </header>
  );
}
