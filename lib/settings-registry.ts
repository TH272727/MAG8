import { z } from "zod";
import { getAppSettingJson, setAppSettingJson } from "./db";

/* ============================================================================
 * Owner-tunable settings — the generic registry behind every knob panel.
 *
 * A registry is a list of SPECS (default, range, env var, plain-language
 * rationale, citations) plus a resolver with fixed precedence:
 *
 *     DB override  >  environment variable  >  research-backed default
 *
 * Nothing that a knob controls may be hard-coded at its use site, and every
 * knob carries the reasoning for its default so /admin and /methodology can
 * render the SAME values from the SAME source and cannot drift apart.
 *
 * Two registries use this: the Stage-0 universe screen (lib/universe-settings)
 * and the Bottleneck desk (lib/bottleneck-settings). They share the machinery
 * and nothing else — separate specs, separate storage keys, separate panels.
 * ========================================================================== */

export interface SpecBase<G extends string> {
  key: string;
  label: string;
  group: G;
  envVar: string;
  /** Plain-language rationale, including measurement caveats. Shown on /admin and /methodology. */
  blurb: string;
  /** Compact short cites resolving in lib/citations.ts (e.g. "Kumar 2009"). */
  cites: string[];
}

export interface NumberSettingSpec<G extends string = string> extends SpecBase<G> {
  kind: "number";
  default: number;
  min: number;
  max: number;
  step: number;
  /** Display divisor for the admin input (raw units stay raw in logic). */
  scale: number;
  unit: string;
  integer?: boolean;
}

export interface BooleanSettingSpec<G extends string = string> extends SpecBase<G> {
  kind: "boolean";
  default: boolean;
}

export type SettingSpec<G extends string = string> = NumberSettingSpec<G> | BooleanSettingSpec<G>;

/** Spec builders: `kind` and the display defaults are filled in for you. */
export const numSetting = <G extends string>(
  s: Omit<NumberSettingSpec<G>, "kind" | "scale" | "unit"> & { scale?: number; unit?: string },
): NumberSettingSpec<G> => ({ kind: "number", scale: 1, unit: "", ...s });

export const boolSetting = <G extends string>(
  s: Omit<BooleanSettingSpec<G>, "kind">,
): BooleanSettingSpec<G> => ({ kind: "boolean", ...s });

export type SettingSource = "default" | "env" | "custom";

export interface EffectiveSettings<V> {
  values: V;
  sources: Record<keyof V, SettingSource>;
}

function clampNumber(spec: NumberSettingSpec<string>, raw: number): number {
  const v = Math.min(spec.max, Math.max(spec.min, raw));
  return spec.integer ? Math.round(v) : v;
}

function envValue(spec: SettingSpec<string>): number | boolean | undefined {
  const raw = process.env[spec.envVar]?.trim();
  if (!raw) return undefined;
  if (spec.kind === "boolean") {
    if (raw === "0" || raw.toLowerCase() === "false") return false;
    if (raw === "1" || raw.toLowerCase() === "true") return true;
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? clampNumber(spec, n) : undefined;
}

/**
 * Build a registry over one spec list persisted under one app_settings key.
 * Every returned function reads the DB on call — cheap, and an /admin edit
 * applies to the very next read with no restart.
 */
export function createSettingsRegistry<G extends string, V extends object>(config: {
  spec: SettingSpec<G>[];
  /** app_settings key holding the owner's overrides (a partial map of key → value). */
  storageKey: string;
}) {
  const { spec, storageKey } = config;
  const specByKey = new Map(spec.map((s) => [s.key, s]));

  /** Overrides validator: unknown keys dropped, numbers clamped to the spec range. */
  function clean(input: unknown): Partial<V> {
    const parsed = z.record(z.string(), z.union([z.number(), z.boolean()])).safeParse(input);
    if (!parsed.success) return {};
    const out: Record<string, number | boolean> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      const s = specByKey.get(key);
      if (!s) continue;
      if (s.kind === "boolean" && typeof value === "boolean") out[key] = value;
      if (s.kind === "number" && typeof value === "number" && Number.isFinite(value)) {
        out[key] = clampNumber(s, value);
      }
    }
    return out as Partial<V>;
  }

  /** Effective settings with per-key provenance. */
  function effective(): EffectiveSettings<V> {
    const overrides = clean(getAppSettingJson(storageKey)) as Record<string, number | boolean>;
    const values = {} as Record<string, number | boolean>;
    const sources = {} as Record<string, SettingSource>;
    for (const s of spec) {
      const fromDb = overrides[s.key];
      const fromEnv = envValue(s);
      if (fromDb !== undefined) {
        values[s.key] = fromDb;
        sources[s.key] = "custom";
      } else if (fromEnv !== undefined) {
        values[s.key] = fromEnv;
        sources[s.key] = "env";
      } else {
        values[s.key] = s.default;
        sources[s.key] = "default";
      }
    }
    return { values: values as unknown as V, sources: sources as Record<keyof V, SettingSource> };
  }

  const values = (): V => effective().values;

  /**
   * Defaults + env only (no DB overrides) — what /admin diffs against when
   * persisting, so a value typed back to its baseline reverts to default/env
   * provenance instead of being stored as an override.
   */
  function baseline(): V {
    const out = {} as Record<string, number | boolean>;
    for (const s of spec) out[s.key] = envValue(s) ?? s.default;
    return out as unknown as V;
  }

  /** Persist overrides (replaces the stored set; pass {} to reset everything). */
  function save(input: unknown): Partial<V> {
    const cleaned = clean(input);
    setAppSettingJson(storageKey, cleaned);
    return cleaned;
  }

  /**
   * Store only what actually differs from the default/env baseline. This is the
   * shape /admin saves: the client posts the whole map, and a value typed back
   * to its baseline stops being an override.
   */
  function saveDiff(input: Record<string, number | boolean>): { stored: Partial<V>; count: number } {
    const cleaned = clean(input) as Record<string, number | boolean>;
    const base = baseline() as unknown as Record<string, number | boolean>;
    const diff: Record<string, number | boolean> = {};
    for (const [key, value] of Object.entries(cleaned)) {
      if (value !== undefined && base[key] !== value) diff[key] = value;
    }
    setAppSettingJson(storageKey, diff);
    return { stored: diff as Partial<V>, count: Object.keys(diff).length };
  }

  return { spec, storageKey, clean, effective, values, baseline, save, saveDiff };
}

/** Pretty-print a setting value for UI/methodology (respects scale + unit; "$B" units read "$1B", 1-of-plural units singularize). */
export function formatSettingValue(spec: SettingSpec<string>, value: number | boolean): string {
  if (spec.kind === "boolean") return value ? "on" : "off";
  const n = Number(value) / spec.scale;
  const shown = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  let unit = spec.unit;
  if (!unit) return shown;
  if (unit.startsWith("$")) return `$${shown}${unit.slice(1)}`;
  if (unit.startsWith("%")) return `${shown}${unit}`;
  if (n === 1 && unit.endsWith("s")) unit = unit.slice(0, -1);
  return `${shown} ${unit}`;
}
