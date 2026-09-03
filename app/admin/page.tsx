import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { adminLogout } from "@/app/actions";
import AdminPanel, { type RunEstimate } from "@/components/admin/AdminPanel";
import BottleneckSettingsPanel from "@/components/admin/BottleneckSettingsPanel";
import InsiderSettingsPanel from "@/components/admin/InsiderSettingsPanel";
import ReachSettingsPanel from "@/components/admin/ReachSettingsPanel";
import RotationSettingsPanel from "@/components/admin/RotationSettingsPanel";
import LoginForm from "@/components/admin/LoginForm";
import LogoMark from "@/components/logo";
import RunHistoryTable from "@/components/admin/RunHistoryTable";
import type { PanelSetting } from "@/components/admin/SettingsGrid";
import UniverseSettingsPanel from "@/components/admin/UniverseSettingsPanel";
import { ADMIN_COOKIE, adminConfigured, tokenMatches } from "@/lib/auth";
import { findCitation } from "@/lib/citations";
import { CONFIG, estimateRun, launchMode } from "@/lib/config";
import { listRuns, runTallies } from "@/lib/db";
import { universeEnabled } from "@/lib/universe";
import { getAppSettingJson } from "@/lib/db";
import {
  REACH_SETTING_GROUPS,
  REACH_SETTINGS_SPEC,
  effectiveReachSettings,
} from "@/lib/reach-settings";
import {
  BOTTLENECK_SETTING_GROUPS,
  BOTTLENECK_SETTINGS_SPEC,
  effectiveBottleneckSettings,
} from "@/lib/bottleneck-settings";
import {
  ROTATION_SETTING_GROUPS,
  ROTATION_SETTINGS_SPEC,
  effectiveRotationSettings,
} from "@/lib/rotation-settings";
import {
  effectiveInsiderSettings,
  INSIDER_SETTING_GROUPS,
  INSIDER_SETTINGS_SPEC,
} from "@/lib/insider-settings";
import { allPlaybooks } from "@/lib/bottleneck/playbook";
import { formatSettingValue, type SettingSpec } from "@/lib/settings-registry";
import {
  UNIVERSE_SETTING_GROUPS,
  UNIVERSE_SETTINGS_SPEC,
  effectiveUniverseSettings,
} from "@/lib/universe-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

/**
 * Spec + resolved values → the serializable rows the knob grid renders.
 * Shared by both registries so the two panels can never drift in how they
 * present provenance, defaults, or citations.
 */
function toPanelSettings<G extends string, V extends object>(
  spec: SettingSpec<G>[],
  eff: { values: V; sources: Record<keyof V, "default" | "env" | "custom"> },
): PanelSetting[] {
  const values = eff.values as Record<string, number | boolean>;
  const sources = eff.sources as Record<string, "default" | "env" | "custom">;
  return spec.map((s) => ({
    key: s.key,
    label: s.label,
    group: s.group,
    kind: s.kind,
    unit: s.kind === "number" ? s.unit : "",
    scale: s.kind === "number" ? s.scale : 1,
    min: s.kind === "number" ? s.min : 0,
    max: s.kind === "number" ? s.max : 1,
    step: s.kind === "number" ? s.step : 1,
    value: values[s.key],
    source: sources[s.key],
    defaultDisplay: formatSettingValue(s, s.default),
    blurb: s.blurb,
    cites: s.cites.map((short) => {
      const url = findCitation(short)?.url;
      return url ? { short, url } : { short };
    }),
  }));
}

export default async function AdminPage() {
  // Pre-launch curtain: the desk stays in the tree but 404s until launch
  // (flip MAG8_SITE_MODE=full to operate it on a deployed instance).
  if (launchMode()) notFound();

  const cookieToken = (await cookies()).get(ADMIN_COOKIE)?.value ?? null;
  const authed = tokenMatches(cookieToken);

  if (!authed) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <LogoMark size={32} className="mb-5" />
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

  const universeEff = effectiveUniverseSettings();
  const universePanel = toPanelSettings(UNIVERSE_SETTINGS_SPEC, universeEff);

  const bottleneckEff = effectiveBottleneckSettings();
  const bottleneckPanel = toPanelSettings(BOTTLENECK_SETTINGS_SPEC, bottleneckEff);
  const rotationEff = effectiveRotationSettings();
  const rotationPanel = toPanelSettings(ROTATION_SETTINGS_SPEC, rotationEff);
  const insiderEff = effectiveInsiderSettings();
  const insiderPanel = toPanelSettings(INSIDER_SETTINGS_SPEC, insiderEff);
  const reachEff = effectiveReachSettings();
  const reachPanel = toPanelSettings(REACH_SETTINGS_SPEC, reachEff);
  const reachFeeds = JSON.stringify(getAppSettingJson("reach_feeds") ?? [], null, 2);
  const reachHandles = JSON.stringify(getAppSettingJson("reach_handles") ?? {}, null, 2);
  const playbooks = allPlaybooks().map((p) => ({ id: p.id, label: p.label, builtIn: p.builtIn }));

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
          effortLine={`${CONFIG.effort.discovery} discovery · ${CONFIG.effort.lens} lens · ${CONFIG.effort.compiler} compile`}
        />
      </div>

      <section className="mt-10" aria-labelledby="universe-h">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="universe-h" className="eyebrow">
            Universe screen — Stage 0
          </h2>
          {!universeEnabled() && <span className="chip">DISABLED VIA MAG8_UNIVERSE=0</span>}
        </div>
        <div className="mt-3">
          {/* Keyed on the effective values so a save/reset remounts the panel with fresh server truth. */}
          <UniverseSettingsPanel
            key={JSON.stringify(universeEff.values)}
            groups={UNIVERSE_SETTING_GROUPS}
            settings={universePanel}
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="bottleneck-h">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="bottleneck-h" className="eyebrow">
            Bottleneck desk
          </h2>
          <span className="chip">$0 · NO RESEARCH CAPACITY</span>
        </div>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">
          A separate research product sharing this database: it turns disclosed capital spending into
          physical units and checks them against what can actually be supplied. It is deterministic —
          filings and arithmetic — so it never draws on the research plan, and it never writes to a
          pipeline table or touches the leaderboard.
        </p>
        <div className="mt-3">
          {/* Keyed on the effective values so a save/reset remounts with fresh server truth. */}
          <BottleneckSettingsPanel
            key={JSON.stringify(bottleneckEff.values)}
            groups={BOTTLENECK_SETTING_GROUPS}
            settings={bottleneckPanel}
            playbooks={playbooks}
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="rotation-h">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="rotation-h" className="eyebrow">
            Rotation board
          </h2>
          <span className="chip">$0 · NO RESEARCH CAPACITY</span>
        </div>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">
          A third research product sharing this database: it divides one traded fund by another to strip
          the common market move out, and scores what is left. Only daily closes are stored, so every dial
          below re-derives the whole board — scores, tiers, directions and the marks on every chart — on
          the next read, with no refetch. It never writes to a pipeline table or touches the leaderboard.
        </p>
        <div className="mt-3">
          {/* Keyed on the effective values so a save/reset remounts with fresh server truth. */}
          <RotationSettingsPanel
            key={JSON.stringify(rotationEff.values)}
            groups={ROTATION_SETTING_GROUPS}
            settings={rotationPanel}
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="insider-h">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="insider-h" className="eyebrow">
            Insider turnaround scanner
          </h2>
          <span className="chip">$0 · NO RESEARCH CAPACITY</span>
        </div>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">
          A fourth research product sharing this database: it starts from company insiders buying their own
          shares on the open market and works forward to a valuation. Most of the dials below are not
          measurement choices but a statement of risk tolerance, and there is no correct setting — these are
          the HOUSE answer, which a visitor can depart from on the page. Only filings, closes and statements
          are stored, so every dial re-derives the whole candidate list on the next read. It never writes to a
          pipeline table or touches the leaderboard.
        </p>
        <div className="mt-3">
          {/* Keyed on the effective values so a save/reset remounts with fresh server truth. */}
          <InsiderSettingsPanel
            key={JSON.stringify(insiderEff.values)}
            groups={INSIDER_SETTING_GROUPS}
            settings={insiderPanel}
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="evidence-h">
        <h2 id="evidence-h" className="eyebrow">
          Primary sources
        </h2>
        <p className="mt-1 max-w-3xl text-[13px] text-muted">
          Not a product — a layer under the pipeline. Before the lenses run, deterministic code reads what
          each candidate has itself filed, what official bodies have themselves published, and the public
          developer activity of the minority of names that have any. It costs nothing and draws no research
          budget; what it hands the analysis is dated links that resolve, so the write-ups cite artifacts
          rather than spend turns hunting for them. A source that cannot be read is said so explicitly, never
          silently treated as nothing to report.
        </p>
        <div className="mt-3">
          {/* Keyed on the effective values so a save/reset remounts with fresh server truth. */}
          <ReachSettingsPanel
            key={JSON.stringify(reachEff.values)}
            groups={REACH_SETTING_GROUPS}
            settings={reachPanel}
            feeds={reachFeeds}
            handles={reachHandles}
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="history-h">
        <h2 id="history-h" className="eyebrow">
          Run history
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          A run that stopped mid-flight — plan limit, watchdog, server restart — can be finished in place:
          Resume keeps its cohort and every lens cell it already completed, and only re-runs the gap.
        </p>
        <div className="mt-3">
          <RunHistoryTable runs={listRuns(30)} tallies={runTallies()} />
        </div>
      </section>
    </main>
  );
}
