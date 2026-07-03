import type { Metadata } from "next";
import { cookies } from "next/headers";
import { adminLogout } from "@/app/actions";
import AdminPanel, { type RunEstimate } from "@/components/admin/AdminPanel";
import LoginForm from "@/components/admin/LoginForm";
import RunHistoryTable from "@/components/admin/RunHistoryTable";
import { ADMIN_COOKIE, adminConfigured, tokenMatches } from "@/lib/auth";
import { CONFIG, estimateRun } from "@/lib/config";
import { listRuns } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const cookieToken = (await cookies()).get(ADMIN_COOKIE)?.value ?? null;
  const authed = tokenMatches(cookieToken);

  if (!authed) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="eyebrow">The desk</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Admin</h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          Triggering pipeline runs is gated. Enter the admin token to unlock the desk.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
        {!adminConfigured() && (
          <p className="mt-4 max-w-md text-[13px] text-dim">
            No ADMIN_TOKEN is configured on the server
            {process.env.NODE_ENV === "production"
              ? ", so the desk is locked. Set ADMIN_TOKEN and restart."
              : ". In development the desk would be open — this screen means you are running a production build."}
          </p>
        )}
      </main>
    );
  }

  const estimates: Record<number, RunEstimate> = {};
  for (let c = CONFIG.candidates.min; c <= CONFIG.candidates.max; c++) {
    estimates[c] = estimateRun(c);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">The desk</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Admin</h1>
        </div>
        {adminConfigured() && (
          <form action={adminLogout}>
            <button type="submit" className="btn">
              Lock the desk
            </button>
          </form>
        )}
      </div>

      <div className="mt-8">
        <AdminPanel
          authMode={CONFIG.authMode()}
          isDev={CONFIG.isDev}
          allowMock={CONFIG.allowMock()}
          defaultCount={CONFIG.candidates.default}
          estimates={estimates}
        />
      </div>

      <section className="mt-10" aria-labelledby="history-h">
        <h2 id="history-h" className="eyebrow">
          Run history
        </h2>
        <div className="mt-3">
          <RunHistoryTable runs={listRuns(30)} />
        </div>
      </section>
    </main>
  );
}
