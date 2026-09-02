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

/* ============================================================================
 * The four researched themes (2026-09-01).
 *
 * These carry sourced conversion factors rather than seeded anchors, so they
 * are held to a stricter standard than the assertions above: every factor must
 * name a document, and the numbers themselves are pinned so that a later edit
 * to a figure read out of a primary source has to be a deliberate act.
 * ========================================================================== */

const RESEARCHED = ["drone-industrial-base", "robotics-automation", "quantum-computing", "nuclear-energy"];

describe("researched playbooks", () => {
  const byId = new Map(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p]));

  it.each(RESEARCHED)("%s ships", (id) => {
    expect(byId.get(id)).toBeDefined();
  });

  it.each(RESEARCHED)("%s carries no placeholder factors", (id) => {
    const pb = byId.get(id)!;
    for (const f of pb.conversions.factors) {
      expect(f.source, `factor "${f.key}" is still a placeholder`).not.toMatch(/placeholder/i);
    }
    expect(usesPlaceholderFactors(pb)).toBe(false);
  });

  it.each(RESEARCHED)("%s: every factor names a dated document", (id) => {
    for (const f of byId.get(id)!.conversions.factors) {
      // A source that cannot be looked up is the failure mode this guards:
      // "industry estimate" passes a min-length check and tells a reader nothing.
      expect(f.source.length, `factor "${f.key}" source is too short to be checkable`).toBeGreaterThan(40);
      expect(f.source, `factor "${f.key}" source names no year`).toMatch(/\b(19|20)\d{2}\b/);
      expect(f.asOf).toMatch(/^\d{4}-\d{2}(-\d{2})?$/);
    }
  });

  it("pins the figures read out of the primary sources", () => {
    // Each of these was read from the document named in its own `source` field.
    // Changing one means a new reading of that document, not a tweak.
    const figures: Record<string, Record<string, number>> = {
      "drone-industrial-base": { uas_system: 263_029, ndpr_kg: 69, assembler_year: 71_420 },
      "robotics-automation": { robot_unit: 61_198, ndpr_kg: 69, mechatronics_year: 76_420 },
      "quantum-computing": { helium_mcf: 330, physicist_year: 171_180 },
      "nuclear-energy": { nuclear_mw: 7_861_000, u3o8_lb: 58.46, swu: 108.7 },
    };
    for (const [id, expected] of Object.entries(figures)) {
      const pb = byId.get(id)!;
      const actual = Object.fromEntries(pb.conversions.factors.map((f) => [f.key, f.usdPer]));
      expect(actual, `${id} conversion figures`).toEqual(expected);
    }
  });

  it("names what each theme's demand read actually measures", () => {
    // Quantum reads research spending and homebuilding reads an inventory
    // build; calling either "capital spending" on the page would be false.
    expect(byId.get("quantum-computing")!.demand.measure).toMatch(/research/i);
    expect(byId.get("homebuilding")!.demand.measure).not.toMatch(/^capital spending$/i);
    expect(byId.get("nuclear-energy")!.demand.measure).toBe("Capital spending");
  });
});

describe("structural invariants across every built-in", () => {
  it("a shared series id means the SAME series everywhere it appears", () => {
    // Series ids are the key in one global observations table, so two playbooks
    // declaring the same id share its rows. Reusing an id deliberately (the
    // chemical and electric-power indices serve several themes) is free; doing
    // it with a different handle or unit would silently mix two measurements
    // into one history and no error would ever be raised.
    const seen = new Map<string, { connector: string; handle?: string; unit: string; from: string }>();
    for (const pb of BUILT_IN_PLAYBOOKS) {
      for (const s of pb.supply) {
        const prior = seen.get(s.seriesId);
        if (!prior) {
          seen.set(s.seriesId, { connector: s.connector, handle: s.handle, unit: s.unit, from: pb.id });
          continue;
        }
        expect(
          { connector: s.connector, handle: s.handle, unit: s.unit },
          `series "${s.seriesId}" is declared differently in ${pb.id} than in ${prior.from}`,
        ).toEqual({ connector: prior.connector, handle: prior.handle, unit: prior.unit });
      }
    }
  });

  it("every FRED series carries the handle it needs to fetch anything", () => {
    for (const pb of BUILT_IN_PLAYBOOKS) {
      for (const s of pb.supply) {
        if (s.connector !== "fred") continue;
        // A fred series without a handle returns no observations, forever, in
        // silence — the connector's first line is `if (!series.handle) return []`.
        expect(s.handle, `series "${s.seriesId}" in ${pb.id} has no FRED id`).toBeTruthy();
      }
    }
  });

  it("every conversion unit has at least one series that could measure it", () => {
    for (const pb of BUILT_IN_PLAYBOOKS) {
      const constrained = new Set(pb.supply.map((s) => s.constrains));
      for (const f of pb.conversions.factors) {
        expect(
          constrained.has(f.key),
          `${pb.id}: nothing constrains "${f.key}", so it can never be scored and ranks last forever`,
        ).toBe(true);
      }
    }
  });

  it("owner tickers are uppercase and unique within a group", () => {
    for (const pb of BUILT_IN_PLAYBOOKS) {
      for (const o of pb.owners) {
        expect(new Set(o.tickers).size, `${pb.id}/${o.category} repeats a ticker`).toBe(o.tickers.length);
        for (const t of o.tickers) expect(t).toBe(t.toUpperCase());
      }
    }
  });
});

describe("the demand measure defaults", () => {
  it("reads as capital spending when a playbook does not say otherwise", () => {
    const minimal = PlaybookSchema.parse({
      id: "minimal-measure",
      label: "Minimal",
      blurb: "A theme that never names its measure.",
      demand: { basket: ["AAA"], capexTags: ["SomeTag"] },
      conversions: {
        version: "1",
        asOf: "2026-01",
        factors: [{ key: "u", unit: "units", usdPer: 1, source: "s", asOf: "2026-01" }],
      },
    });
    expect(minimal.demand.measure).toBe("Capital spending");
  });
});
