import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PLAYBOOKS,
  DEFAULT_PLAYBOOK_ID,
  PlaybookSchema,
  conversionFactor,
  ownersFor,
  seriesFor,
  usesPlaceholderFactors,
  type Playbook,
} from "../../lib/bottleneck/playbook";

/* ============================================================================
 * Playbook integrity. These assertions catch the class of config error that
 * produces NO error at runtime — a supply series that constrains a unit nobody
 * computes, or an owner group attached to a category that does not exist, both
 * of which quietly yield an empty bottleneck ranking rather than a failure.
 *
 * Reads only module constants, so nothing here opens the database.
 * ========================================================================== */

describe("built-in playbooks", () => {
  it("ships at least one, including the default", () => {
    expect(BUILT_IN_PLAYBOOKS.length).toBeGreaterThan(0);
    expect(BUILT_IN_PLAYBOOKS.map((p) => p.id)).toContain(DEFAULT_PLAYBOOK_ID);
  });

  it.each(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p] as const))("%s validates against its own schema", (_id, pb) => {
    expect(() => PlaybookSchema.parse(pb)).not.toThrow();
  });

  it.each(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p] as const))("%s has unique conversion keys", (_id, pb) => {
    const keys = pb.conversions.factors.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p] as const))(
    "%s: every supply series constrains a real conversion unit",
    (_id, pb) => {
      const keys = new Set(pb.conversions.factors.map((f) => f.key));
      for (const s of pb.supply) {
        expect(keys, `series "${s.seriesId}" constrains "${s.constrains}", which no factor defines`).toContain(
          s.constrains,
        );
      }
    },
  );

  it.each(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p] as const))(
    "%s: every owner group maps to a real conversion unit",
    (_id, pb) => {
      const keys = new Set(pb.conversions.factors.map((f) => f.key));
      for (const o of pb.owners) {
        expect(keys, `owner group "${o.label}" targets "${o.category}", which no factor defines`).toContain(
          o.category,
        );
      }
    },
  );

  it.each(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p] as const))("%s has unique series ids", (_id, pb) => {
    const ids = pb.supply.map((s) => s.seriesId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p] as const))(
    "%s: basket tickers are uppercase and unique",
    (_id, pb) => {
      const b = pb.demand.basket;
      expect(new Set(b).size).toBe(b.length);
      for (const t of b) expect(t).toBe(t.toUpperCase());
    },
  );

  it.each(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p] as const))(
    "%s: every conversion factor is sourced and dated",
    (_id, pb) => {
      for (const f of pb.conversions.factors) {
        expect(f.source.length, `factor "${f.key}" has no source`).toBeGreaterThan(0);
        expect(f.asOf, `factor "${f.key}" has no as-of date`).toMatch(/^\d{4}(-\d{2}){0,2}$/);
        expect(f.usdPer).toBeGreaterThan(0);
      }
    },
  );
});

describe("schema validation", () => {
  const valid: Playbook = PlaybookSchema.parse(BUILT_IN_PLAYBOOKS[0]);

  it("rejects an id that is not url-safe", () => {
    expect(() => PlaybookSchema.parse({ ...valid, id: "Not Safe" })).toThrow();
  });

  it("rejects an empty demand basket", () => {
    expect(() => PlaybookSchema.parse({ ...valid, demand: { ...valid.demand, basket: [] } })).toThrow();
  });

  it("rejects a conversion factor priced at zero", () => {
    const broken = {
      ...valid,
      conversions: {
        ...valid.conversions,
        factors: [{ ...valid.conversions.factors[0], usdPer: 0 }],
      },
    };
    expect(() => PlaybookSchema.parse(broken)).toThrow();
  });

  it("defaults owners and supply to empty rather than failing", () => {
    const minimal = PlaybookSchema.parse({
      id: "minimal",
      label: "Minimal",
      blurb: "A theme with demand only.",
      demand: { basket: ["AAA"], capexTags: ["SomeTag"] },
      conversions: {
        version: "1",
        asOf: "2026-01",
        factors: [{ key: "u", unit: "units", usdPer: 1, source: "s", asOf: "2026-01" }],
      },
    });
    expect(minimal.supply).toEqual([]);
    expect(minimal.owners).toEqual([]);
    expect(minimal.builtIn).toBe(false);
  });
});

describe("lookup helpers", () => {
  const pb = BUILT_IN_PLAYBOOKS[0];

  it("finds a conversion factor by key", () => {
    const key = pb.conversions.factors[0].key;
    expect(conversionFactor(pb, key)?.key).toBe(key);
    expect(conversionFactor(pb, "no-such-key")).toBeNull();
  });

  it("selects only the series constraining one unit", () => {
    for (const f of pb.conversions.factors) {
      for (const s of seriesFor(pb, f.key)) expect(s.constrains).toBe(f.key);
    }
    expect(seriesFor(pb, "no-such-key")).toEqual([]);
  });

  it("finds the owner group for a unit", () => {
    for (const o of pb.owners) expect(ownersFor(pb, o.category)?.label).toBe(o.label);
    expect(ownersFor(pb, "no-such-key")).toBeNull();
  });
});

describe("honesty about seeded assumptions", () => {
  it("flags the seeded playbook as carrying placeholder factors", () => {
    // The desk must say so rather than presenting order-of-magnitude anchors
    // as researched benchmarks. When real sourced figures replace these, this
    // assertion flips — and that is the intended signal to update it.
    expect(usesPlaceholderFactors(BUILT_IN_PLAYBOOKS[0])).toBe(true);
  });

  it("stops flagging once every factor carries a real source", () => {
    const sourced: Playbook = {
      ...BUILT_IN_PLAYBOOKS[0],
      conversions: {
        ...BUILT_IN_PLAYBOOKS[0].conversions,
        factors: BUILT_IN_PLAYBOOKS[0].conversions.factors.map((f) => ({
          ...f,
          source: "EIA Annual Energy Outlook 2026, Table 8.2",
        })),
      },
    };
    expect(usesPlaceholderFactors(sourced)).toBe(false);
  });
});
