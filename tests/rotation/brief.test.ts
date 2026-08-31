import { describe, expect, it } from "vitest";
import {
  allowedNumbers,
  briefPrompt,
  templateBrief,
  verifyBriefNumbers,
  type BriefChange,
} from "../../lib/rotation/brief";
import type { Reading } from "../../lib/rotation/score";
import type { StateChange } from "../../lib/rotation/state";

/* ============================================================================
 * The written note.
 *
 * The deterministic writer is checked for the things it must always say. The
 * guard is checked for the one thing it exists to catch: a figure in a note
 * about markets that was never computed. An instruction not to invent numbers
 * lives in the prompt; this is the half that does not depend on being obeyed.
 * ========================================================================== */

const reading = (over: Partial<Reading> = {}): Reading =>
  ({
    id: "rsp-spy",
    label: "RSP / SPY — mega-cap concentration",
    category: "breadth",
    kind: "ratio",
    asOf: "2026-08-28",
    sessions: 1255,
    value: 0.28685,
    smaFast: 0.2868,
    smaSlow: 0.28535,
    separationPct: 0.51,
    confirmed: true,
    zScore: 0.35,
    percentile: 22,
    rsi: 48.1,
    roc1m: -1.22,
    roc3m: 4.05,
    roc6m: -3.72,
    components: { trend: 1.7, stretch: 1.16, momentum: 0.38, percentile: null },
    score: 1.1,
    tier: "none",
    direction: "favors-base",
    directionLabel: "Favors RSP — the average company, equally weighted",
    meaning: "The average company is outperforming the index.",
    falsification: "Wrong if the ratio crosses back through its 200-day average and holds.",
    falsificationLevel: 0.28535,
    basis: { source: "yahoo", adjusted: true, mixed: false },
    stale: false,
    signalEligible: true,
    flags: [],
    ...over,
  }) as Reading;

const change = (over: Partial<StateChange> = {}): StateChange => ({
  indicatorId: "rsp-spy",
  date: "2026-08-28",
  kind: "tier",
  from: { tier: "neutral", direction: "favors-base" },
  to: { tier: "building", direction: "favors-base" },
  ...over,
});

const item = (o: Partial<Reading> = {}, c: Partial<StateChange> = {}): BriefChange => ({
  change: change(c),
  reading: reading(o),
});

describe("the deterministic writer", () => {
  it("carries the disclaimer every time", () => {
    expect(templateBrief([item()], "2026-08-28")).toMatch(/Not financial advice/);
    expect(templateBrief([], "2026-08-28")).toMatch(/Not financial advice/);
  });

  it("says plainly when nothing changed", () => {
    const out = templateBrief([], "2026-08-28");
    expect(out).toMatch(/No indicator changed state/);
    expect(out).toMatch(/2026-08-28/);
  });

  it("names the indicator and what it did", () => {
    const out = templateBrief([item()], "2026-08-28");
    expect(out).toMatch(/RSP \/ SPY/);
    expect(out).toMatch(/strengthened from Neutral \/ Rangebound to Building/);
  });

  it("reports an easing change as prominently as a strengthening one", () => {
    // A note that only ever announces signals building is an advertisement.
    const easing = templateBrief(
      [item({}, { from: { tier: "strong", direction: "favors-base" }, to: { tier: "neutral", direction: "favors-base" } })],
      "2026-08-28",
    );
    expect(easing).toMatch(/eased from Strong Pivot Signal to Neutral \/ Rangebound/);
    expect(easing).toMatch(/1 indicator changed state/);
  });

  it("counts strengthening and easing separately in the summary", () => {
    const out = templateBrief(
      [
        item(),
        item({ id: "b", label: "B / C" }, { from: { tier: "strong", direction: "favors-base" }, to: { tier: "none", direction: "favors-base" } }),
      ],
      "2026-08-28",
    );
    expect(out).toMatch(/2 indicators changed state/);
    expect(out).toMatch(/1 strengthened/);
    expect(out).toMatch(/1 eased/);
  });

  it("includes how the reading could be wrong", () => {
    expect(templateBrief([item()], "2026-08-28")).toMatch(/How this could be wrong/);
  });

  it("contains only figures that were computed", () => {
    // The deterministic writer must itself pass the guard, or the guard would
    // be rejecting the fallback it falls back to.
    const items = [item()];
    const out = templateBrief(items, "2026-08-28");
    expect(verifyBriefNumbers(out, allowedNumbers(items, "2026-08-28")).offenders).toEqual([]);
  });
});

describe("the guard", () => {
  const items = [item()];
  const allowed = allowedNumbers(items, "2026-08-28");

  it("accepts a note built only from the computed figures", () => {
    const text =
      "## Rotation brief — 2026-08-28\n\nThe composite reads 1.1 and the ratio sits at the 22 percentile, " +
      "0.35 deviations from its own mean, having moved +4.05% over three months.";
    expect(verifyBriefNumbers(text, allowed).ok).toBe(true);
  });

  it("rejects an invented price target", () => {
    // The failure that matters: a plausible figure that came from nowhere.
    const text = "The composite reads 1.1, and the ratio should reach 0.35 by 2027 with a target of 412.60.";
    const res = verifyBriefNumbers(text, allowed);
    expect(res.ok).toBe(false);
    expect(res.offenders).toContain("412.60");
  });

  it("rejects a historical statistic recalled rather than computed", () => {
    const text = "The composite reads 1.1. This ratio fell 37.4% during the 2008 drawdown.";
    const res = verifyBriefNumbers(text, allowed);
    expect(res.ok).toBe(false);
    expect(res.offenders).toContain("37.4");
    expect(res.offenders).toContain("2008");
  });

  it("accepts the session date and the method's own constants", () => {
    const text =
      "## Rotation brief — 2026-08-28\n\nThe 50-day average crossed the 200-day. Momentum reads 48.1 " +
      "against a neutral 50, measured over 252 sessions.";
    expect(verifyBriefNumbers(text, allowed).ok).toBe(true);
  });

  it("accepts a figure rendered to a different precision than it was given", () => {
    // 0.28685 may reasonably be written 0.2869 or 0.287.
    const text = "The ratio is 0.2869, or 0.287 rounded.";
    expect(verifyBriefNumbers(text, allowed).ok).toBe(true);
  });

  it("ignores thousands separators", () => {
    expect(verifyBriefNumbers("Across 1,255 sessions.", allowed).ok).toBe(true);
  });

  it("reports every distinct offender once", () => {
    const res = verifyBriefNumbers("Targets of 999.9 and 999.9 and 888.8.", allowed);
    expect(res.offenders).toEqual(["999.9", "888.8"]);
  });

  it("passes a note with no numbers at all", () => {
    expect(verifyBriefNumbers("Breadth improved and credit appetite rose.", allowed).ok).toBe(true);
  });
});

describe("the prompt", () => {
  const items = [item()];
  const prompt = briefPrompt(items, "2026-08-28");

  it("hands over the computed figures rather than asking for them", () => {
    expect(prompt).toMatch(/composite score \(0-10\): 1\.1/);
    expect(prompt).toMatch(/percentile of its three-year range: 22/);
    expect(prompt).toMatch(/deviations from its own one-year mean: 0\.35/);
  });

  it("forbids introducing a figure", () => {
    expect(prompt).toMatch(/Do NOT introduce any number that is not in the data above/);
    expect(prompt).toMatch(/discarded in full/);
  });

  it("forbids predicting or advising", () => {
    expect(prompt).toMatch(/Do not predict, recommend, or advise/);
  });

  it("requires an easing signal be reported as plainly as a strengthening one", () => {
    expect(prompt).toMatch(/Report an easing signal as plainly as a strengthening one/);
  });

  it("bans naming the machinery, so public copy stays clean", () => {
    expect(prompt).toMatch(/Do not name or describe the tools, systems, models or/);
  });

  it("names the session it is describing", () => {
    expect(prompt).toMatch(/Session: 2026-08-28/);
  });
});
