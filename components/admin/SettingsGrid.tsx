"use client";

/* ============================================================================
 * The knob grid shared by every settings panel on the desk.
 *
 * Purely presentational: it renders a spec-driven list of settings grouped into
 * sections, with each row showing its provenance badge (DEFAULT / ENV / CUSTOM),
 * its plain-language rationale, its default, and any citations behind it.
 *
 * It owns no actions and no save logic — each panel wires its own, because the
 * Stage-0 screen and the Bottleneck desk need different buttons next to the
 * same grid.
 * ========================================================================== */

/** Serializable view of one setting, prepared server-side. */
export interface PanelSetting {
  key: string;
  label: string;
  group: string;
  kind: "number" | "boolean";
  unit: string;
  scale: number;
  min: number;
  max: number;
  step: number;
  value: number | boolean;
  source: "default" | "env" | "custom";
  defaultDisplay: string;
  blurb: string;
  cites: { short: string; url?: string }[];
}

export interface PanelGroup {
  key: string;
  title: string;
  note: string;
}

export default function SettingsGrid({
  groups,
  settings,
  values,
  onChange,
  accent = "discovery",
}: {
  groups: PanelGroup[];
  settings: PanelSetting[];
  values: Record<string, number | boolean>;
  onChange: (key: string, value: number | boolean) => void;
  /** Design token driving the input focus/checkbox colour. */
  accent?: "discovery" | "fundamentals" | "macro" | "consensus";
}) {
  return (
    <>
      {groups.map((g) => {
        const rows = settings.filter((s) => s.group === g.key);
        if (rows.length === 0) return null;
        return (
          <section key={g.key} className="mt-6 border-t border-hairline pt-5" aria-label={g.title}>
            <h3 className="eyebrow">{g.title}</h3>
            <p className="mt-1 text-[13px] text-dim">{g.note}</p>
            <div className="mt-3 space-y-4">
              {rows.map((s) => (
                <div key={s.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink">{s.label}</span>
                      <span className={`chip ${s.source === "custom" ? "gate-pass" : ""}`}>
                        {s.source.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.blurb}</p>
                    <p className="mt-1 font-mono text-[11px] text-dim">
                      default {s.defaultDisplay}
                      {s.cites.length > 0 && (
                        <>
                          {" · "}
                          {s.cites.map((c, i) => (
                            <span key={c.short}>
                              {i > 0 && " · "}
                              {c.url ? (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline decoration-hairline underline-offset-2 hover:text-ink"
                                >
                                  {c.short}
                                </a>
                              ) : (
                                c.short
                              )}
                            </span>
                          ))}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    {s.kind === "boolean" ? (
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input
                          type="checkbox"
                          checked={Boolean(values[s.key])}
                          onChange={(e) => onChange(s.key, e.target.checked)}
                          style={{ accentColor: `var(--color-${accent})` }}
                        />
                        <span className="w-8 font-mono text-[12px]">{values[s.key] ? "on" : "off"}</span>
                      </label>
                    ) : (
                      <>
                        <input
                          type="number"
                          value={Number(values[s.key]) / s.scale}
                          min={s.min / s.scale}
                          max={s.max / s.scale}
                          step={s.step / s.scale}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) onChange(s.key, n * s.scale);
                          }}
                          className="w-28 rounded-md border border-hairline bg-void px-2 py-1.5 text-right font-mono text-[13px] text-ink focus:border-discovery/60 focus:outline-none"
                        />
                        {s.unit && <span className="w-14 font-mono text-[11px] text-dim">{s.unit}</span>}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/**
 * Best-effort local echo of a setting's baseline after a reset, so the inputs
 * stay coherent until the server re-renders authoritative values.
 */
export function defaultRaw(s: PanelSetting): number | boolean {
  if (s.kind === "boolean") return s.defaultDisplay === "on";
  const n = Number(s.defaultDisplay.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n * s.scale : s.value;
}
