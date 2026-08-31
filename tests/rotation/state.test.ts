import { describe, expect, it } from "vitest";
import type { DailyState, DirectionKey, Reading, Tier } from "../../lib/rotation/score";
import {
  changesOn,
  daysSinceChange,
  describeChange,
  detectChanges,
  hashString,
  latestChange,
  sessionsSinceChange,
  stateHash,
} from "../../lib/rotation/state";

/* ============================================================================
 * State changes — the ONLY thing that may raise a written note, which is what
 * makes the definition load-bearing rather than cosmetic.
 *
 * Two failure modes are guarded here. Reporting only the half that strengthens
 * would turn an instrument into an advertisement. Treating drift in and out of
 * "balanced" as a flip would raise a note nearly every day for a ratio doing
 * nothing, and teach a reader to ignore every one of them.
 * ========================================================================== */

const day = (n: number): string => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

const hist = (spec: [Tier, DirectionKey][]): DailyState[] =>
  spec.map(([tier, direction], i) => ({ date: day(i), score: null, tier, direction }));

describe("tier changes", () => {
  it("reports a strengthening crossing", () => {
    const changes = detectChanges("x", hist([
      ["neutral", "favors-base"],
      ["neutral", "favors-base"],
      ["building", "favors-base"],
    ]));
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("tier");
    expect(changes[0].from.tier).toBe("neutral");
    expect(changes[0].to.tier).toBe("building");
    expect(changes[0].date).toBe(day(2));
  });

  it("reports an easing crossing exactly as readily", () => {
    // A board that only announces signals building is not an instrument.
    const changes = detectChanges("x", hist([
      ["strong", "favors-base"],
      ["building", "favors-base"],
    ]));
    expect(changes).toHaveLength(1);
    expect(changes[0].to.tier).toBe("building");
  });

  it("says nothing while the tier holds", () => {
    expect(detectChanges("x", hist([
      ["building", "favors-base"],
      ["building", "favors-base"],
      ["building", "favors-base"],
    ]))).toHaveLength(0);
  });

  it("never reports a change on the first session it can see", () => {
    // There is no prior state to have changed from.
    expect(detectChanges("x", hist([["strong", "favors-base"]]))).toHaveLength(0);
  });
});

describe("direction changes", () => {
  it("reports a flip between the two sides", () => {
    const changes = detectChanges("x", hist([
      ["neutral", "favors-base"],
      ["neutral", "favors-quote"],
    ]));
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("direction");
    expect(changes[0].from.direction).toBe("favors-base");
    expect(changes[0].to.direction).toBe("favors-quote");
  });

  it("does not treat drift into balanced as a flip", () => {
    // This is the noise case the deadband exists for: a ratio resting on its
    // own trend passes through balanced constantly.
    expect(detectChanges("x", hist([
      ["neutral", "favors-base"],
      ["neutral", "balanced"],
      ["neutral", "favors-base"],
      ["neutral", "balanced"],
      ["neutral", "favors-base"],
    ]))).toHaveLength(0);
  });

  it("reports a flip that happens to pass through balanced", () => {
    // A genuine reversal usually crosses the deadband on its way over, and must
    // still be reported once it lands on the other side.
    const changes = detectChanges("x", hist([
      ["neutral", "favors-base"],
      ["neutral", "balanced"],
      ["neutral", "balanced"],
      ["neutral", "favors-quote"],
    ]));
    expect(changes).toHaveLength(1);
    expect(changes[0].date).toBe(day(3));
    expect(changes[0].from.direction).toBe("favors-base");
    expect(changes[0].to.direction).toBe("favors-quote");
  });

  it("says nothing when a ratio has never picked a side", () => {
    expect(detectChanges("x", hist([
      ["none", "balanced"],
      ["none", "balanced"],
      ["none", "balanced"],
    ]))).toHaveLength(0);
  });
});

describe("both at once", () => {
  it("reports a single change rather than two", () => {
    const changes = detectChanges("x", hist([
      ["neutral", "favors-base"],
      ["building", "favors-quote"],
    ]));
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("both");
  });
});

describe("locating a change in time", () => {
  const history = hist([
    ["none", "balanced"],
    ["neutral", "favors-base"],
    ["neutral", "favors-base"],
    ["building", "favors-base"],
    ["building", "favors-base"],
  ]);
  const changes = detectChanges("x", history);

  it("finds the most recent one", () => {
    expect(latestChange(changes)!.date).toBe(day(3));
  });

  it("counts the sessions since it", () => {
    expect(sessionsSinceChange(changes, history)).toBe(1);
  });

  it("counts the calendar days since it", () => {
    expect(daysSinceChange(changes, day(10))).toBe(7);
  });

  it("returns nothing when a state has never changed", () => {
    const flat = hist([["none", "balanced"], ["none", "balanced"]]);
    const none = detectChanges("x", flat);
    expect(latestChange(none)).toBeNull();
    expect(daysSinceChange(none, day(5))).toBeNull();
    expect(sessionsSinceChange(none, flat)).toBeNull();
  });

  it("selects only the changes that fired on a given session", () => {
    expect(changesOn(changes, day(3))).toHaveLength(1);
    expect(changesOn(changes, day(4))).toHaveLength(0);
  });
});

describe("describeChange", () => {
  const reading = {
    label: "A / B — a test pair",
    directionLabel: "Favors B — the second side",
  } as Reading;

  it("says strengthened when the tier rises", () => {
    const [c] = detectChanges("x", hist([["neutral", "favors-base"], ["strong", "favors-base"]]));
    expect(describeChange(c, reading)).toMatch(/strengthened from Neutral \/ Rangebound to Strong Pivot Signal/);
  });

  it("says eased when the tier falls", () => {
    const [c] = detectChanges("x", hist([["strong", "favors-base"], ["neutral", "favors-base"]]));
    expect(describeChange(c, reading)).toMatch(/eased from Strong Pivot Signal to Neutral \/ Rangebound/);
  });

  it("names the side a flip landed on", () => {
    const [c] = detectChanges("x", hist([["neutral", "favors-base"], ["neutral", "favors-quote"]]));
    expect(describeChange(c, reading)).toMatch(/Favors B — the second side/);
  });
});

describe("stateHash", () => {
  const changes = detectChanges("x", hist([["neutral", "favors-base"], ["building", "favors-base"]]));
  const settings = { weightTrend: 1, weightStretch: 1, weightMomentum: 1, weightPercentile: 0 };

  it("is stable for the same state", () => {
    expect(stateHash({ asOf: day(1), changes, settings })).toBe(stateHash({ asOf: day(1), changes, settings }));
  });

  it("does not depend on the order changes arrive in", () => {
    const a = detectChanges("a", hist([["neutral", "favors-base"], ["building", "favors-base"]]));
    const b = detectChanges("b", hist([["neutral", "favors-base"], ["building", "favors-base"]]));
    expect(stateHash({ asOf: day(1), changes: [...a, ...b], settings })).toBe(
      stateHash({ asOf: day(1), changes: [...b, ...a], settings }),
    );
  });

  it("changes when the day changes", () => {
    expect(stateHash({ asOf: day(1), changes, settings })).not.toBe(
      stateHash({ asOf: day(2), changes, settings }),
    );
  });

  it("changes when the weighting changes", () => {
    // Retuning a weight re-derives the whole board, so a note written under the
    // old weighting describes a state that no longer exists.
    expect(stateHash({ asOf: day(1), changes, settings })).not.toBe(
      stateHash({ asOf: day(1), changes, settings: { ...settings, weightPercentile: 1 } }),
    );
  });

  it("changes when a different indicator moved", () => {
    const other = detectChanges("y", hist([["neutral", "favors-base"], ["building", "favors-base"]]));
    expect(stateHash({ asOf: day(1), changes, settings })).not.toBe(
      stateHash({ asOf: day(1), changes: other, settings }),
    );
  });
});

describe("hashString", () => {
  it("is deterministic and fixed width", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).toHaveLength(16);
    expect(hashString("")).toHaveLength(16);
  });

  it("separates inputs that differ by one character", () => {
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });
});
