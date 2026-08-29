import { describe, expect, it } from "vitest";
import { BOTTLENECK_SETTING_GROUPS, BOTTLENECK_SETTINGS_SPEC } from "../../lib/bottleneck-settings";
import { UNIVERSE_SETTINGS_SPEC, UNIVERSE_SETTING_GROUPS } from "../../lib/universe-settings";
import { boolSetting, formatSettingValue, numSetting, type SettingSpec } from "../../lib/settings-registry";

/* ============================================================================
 * Registry integrity for BOTH knob registries. Reads only module constants —
 * the resolver itself talks to SQLite and is exercised in the live desk, not
 * here, so nothing in this file opens the database.
 * ========================================================================== */

const REGISTRIES: [string, SettingSpec<string>[], { key: string }[]][] = [
  ["universe", UNIVERSE_SETTINGS_SPEC, UNIVERSE_SETTING_GROUPS],
  ["bottleneck", BOTTLENECK_SETTINGS_SPEC, BOTTLENECK_SETTING_GROUPS],
];

describe.each(REGISTRIES)("%s settings registry", (_name, spec, groups) => {
  it("has unique keys", () => {
    const keys = spec.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has unique env var names", () => {
    const vars = spec.map((s) => s.envVar);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("assigns every setting to a declared group", () => {
    const declared = new Set(groups.map((g) => g.key));
    for (const s of spec) expect(declared, `"${s.key}" is in undeclared group "${s.group}"`).toContain(s.group);
  });

  it("declares no empty groups", () => {
    const used = new Set(spec.map((s) => s.group));
    for (const g of groups) expect(used, `group "${g.key}" has no settings`).toContain(g.key);
  });

  it("keeps every numeric default inside its own range", () => {
    for (const s of spec) {
      if (s.kind !== "number") continue;
      expect(s.default, `"${s.key}" default below min`).toBeGreaterThanOrEqual(s.min);
      expect(s.default, `"${s.key}" default above max`).toBeLessThanOrEqual(s.max);
      expect(s.min).toBeLessThan(s.max);
      expect(s.step).toBeGreaterThan(0);
      expect(s.scale).toBeGreaterThan(0);
    }
  });

  it("explains every setting in prose", () => {
    // A knob without a stated rationale cannot be rendered honestly on
    // /methodology, which publishes these blurbs verbatim.
    for (const s of spec) expect(s.blurb.length, `"${s.key}" has a thin blurb`).toBeGreaterThan(40);
  });
});

describe("the two registries stay independent", () => {
  it("shares no storage-key collisions via env vars", () => {
    const u = new Set(UNIVERSE_SETTINGS_SPEC.map((s) => s.envVar));
    for (const s of BOTTLENECK_SETTINGS_SPEC) expect(u).not.toContain(s.envVar);
  });

  it("namespaces every Bottleneck env var under MAG8_BN_", () => {
    for (const s of BOTTLENECK_SETTINGS_SPEC) expect(s.envVar).toMatch(/^MAG8_BN_/);
  });
});

describe("formatSettingValue", () => {
  const n = (over: Partial<Parameters<typeof numSetting>[0]> = {}) =>
    numSetting({
      key: "k",
      label: "L",
      group: "g",
      envVar: "E",
      blurb: "b",
      cites: [],
      default: 1,
      min: 0,
      max: 10,
      step: 1,
      ...over,
    });

  it("renders booleans as on/off", () => {
    const b = boolSetting({ key: "k", label: "L", group: "g", envVar: "E", blurb: "b", cites: [], default: true });
    expect(formatSettingValue(b, true)).toBe("on");
    expect(formatSettingValue(b, false)).toBe("off");
  });

  it("applies the display scale", () => {
    expect(formatSettingValue(n({ scale: 1e9, unit: "$B", max: 1e12 }), 50_000_000_000)).toBe("$50B");
    expect(formatSettingValue(n({ scale: 1000, unit: "s", max: 1e6 }), 20_000)).toBe("20 s");
  });

  it("singularizes a unit at exactly one", () => {
    expect(formatSettingValue(n({ unit: "years" }), 1)).toBe("1 year");
    expect(formatSettingValue(n({ unit: "years", max: 10 }), 3)).toBe("3 years");
  });

  it("attaches percent without a space", () => {
    expect(formatSettingValue(n({ unit: "%", max: 100 }), 20)).toBe("20%");
  });

  it("rounds a fractional value to two places", () => {
    expect(formatSettingValue(n({ unit: "", max: 10 }), 1.23456)).toBe("1.23");
  });
});
