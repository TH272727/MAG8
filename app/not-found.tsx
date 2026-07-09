import Link from "next/link";
import LogoMark from "@/components/logo";
import { launchMode } from "@/lib/config";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-start px-4 py-24 sm:px-6">
      <LogoMark size={36} className="mb-5" />
      <p className="eyebrow">Signal lost</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Nothing at this address.</h1>
      <p className="mt-3 max-w-md text-muted">
        The run, ticker, or page you asked for isn&apos;t in the book. Stocks only get a dossier after a
        completed run has ranked them.
      </p>
      <div className="mt-6 flex gap-3">
        {launchMode() ? (
          <Link href="/" className="btn btn-primary">
            Home
          </Link>
        ) : (
          <>
            <Link href="/rankings" className="btn btn-primary">
              Current rankings
            </Link>
            <Link href="/" className="btn">
              Home
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
