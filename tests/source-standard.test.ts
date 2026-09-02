import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findCitation } from "../lib/citations";
import {
  SOURCE_RULES,
  SOURCE_STANDARD_CITES,
  SOURCE_TIERS,
  buildSourceStandardDoc,
  buildSourceStandardText,
  sourceStandardCitations,
} from "../lib/source-standard";
import { discoveryPrompt, lensPrompt, runDateLine } from "../lib/orchestrator/prompts";
import type { DiscoveryCandidate } from "../lib/schemas";

/* ============================================================================
 * The source standard. Three failures this file exists to prevent, each of
 * which would be silent:
 *
 *  1. The text grows. It rides in every discovery prompt and all 24 lens cells,
 *     each of which runs against a hard per-call USD cap that has already
 *     killed a cell once. A budget nobody measures is a budget that drifts.
 *  2. It leaks. This text governs the prose that gets PUBLISHED, so a single
 *     banned word in it is a word the model is invited to echo into a report.
 *     The leak grep bans the bare English words too — including "agent".
 *  3. It drifts. The prompt, the page, and the playbook file must all still be
 *     rendering from the same constants.
 * ========================================================================== */

/** The published leak gate, verbatim from scripts/__leak-probe.js. */
const BANNED = /stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b/gi;

/** Rough but stable: ~4 chars per token. Generous enough not to be brittle. */
const approxTokens = (s: string) => Math.round(s.length / 4);

const CANDIDATE: DiscoveryCandidate = {
  ticker: "TEST",
  companyName: "Test Corp",
  sector: "AI infrastructure",
  thesis: "A hypothesis to verify.",
  matchedTraits: ["platform economics"],
};

describe("the injected prompt block", () => {
  it("stays inside its token budget", () => {
    // 24 lens cells + discovery carry this. Raising the ceiling is a real
    // decision about the per-call cap, not something to do by accident.
    expect(approxTokens(buildSourceStandardText())).toBeLessThanOrEqual(340);
  });

  it("carries no vocabulary the leak gate bans", () => {
    // It governs published prose. A banned word here is one the model is being
    // handed. Note this catches "agent" inside a hyphenated name too.
    expect(buildSourceStandardText().match(BANNED)).toBeNull();
    expect(buildSourceStandardDoc().match(BANNED)).toBeNull();
  });

  it("names both tiers and says what each may do", () => {
    const t = buildSourceStandardText();
    expect(t).toContain("TIER A");
    expect(t).toContain("TIER B");
    // The load-bearing half: Tier B may not move a number on its own.
    expect(t).toMatch(/never stands in for the verification/);
    expect(t).toMatch(/moves no verdict, score, probability, or target/);
  });
});

describe("wiring into the stages that actually research", () => {
  it("reaches every lens prompt", () => {
    for (const skill of ["stock-scanner", "gt-predictor", "institutional-forecast"] as const) {
      expect(lensPrompt(skill, CANDIDATE, runDateLine(new Date("2026-09-02")))).toContain(
        "Source discipline",
      );
    }
  });

  it("reaches the discovery prompt", () => {
    const p = discoveryPrompt(8, { dateLine: runDateLine(new Date("2026-09-02")), coverage: [] });
    expect(p).toContain("Source discipline");
  });
});

describe("single source of truth", () => {
  it("renders the same tiers and rules into both forms", () => {
    const prompt = buildSourceStandardText();
    const doc = buildSourceStandardDoc();
    for (const tier of SOURCE_TIERS) {
      for (const clause of tier.clauses) {
        expect(prompt).toContain(clause);
        expect(doc).toContain(clause);
      }
    }
    for (const rule of SOURCE_RULES) {
      expect(prompt).toContain(rule);
      expect(doc).toContain(rule);
    }
  });

  it("cites only works that resolve in the registry", () => {
    // A typo'd short would vanish from the page and the doc without erroring.
    for (const short of SOURCE_STANDARD_CITES) expect(findCitation(short)).toBeDefined();
    expect(sourceStandardCitations()).toHaveLength(SOURCE_STANDARD_CITES.length);
  });
});

describe("the generated playbook file", () => {
  const skillRef = (skill: string) =>
    path.join(process.cwd(), ".claude", "skills", skill, "references", "source-standard.md");

  it("is present and current in each of the four research playbooks", () => {
    // Same contract as the bibliographies: generated, never hand-edited, so a
    // stale copy is a bug rather than a local variant.
    for (const skill of ["stock-scanner", "gt-predictor", "institutional-forecast", "new-gen-stock"]) {
      const p = skillRef(skill);
      expect(fs.existsSync(p), `${skill} is missing source-standard.md — run npm run gen:bib`).toBe(true);
      expect(fs.readFileSync(p, "utf8")).toBe(buildSourceStandardDoc());
    }
  });

  it("is deliberately absent from the playbook that computes nothing", () => {
    // insider-turnaround reads back a deterministic report and is told in as
    // many words that it derives no number. A rule for weighing research it
    // never does would only muddy that instruction.
    expect(fs.existsSync(skillRef("insider-turnaround"))).toBe(false);
  });

  it("points each playbook at the file from the step that reads it", () => {
    const root = path.join(process.cwd(), ".claude", "skills");
    const pointers: [string, string][] = [
      ["new-gen-stock", "references/playbook.md"],
      ["gt-predictor", "SKILL.md"],
      ["stock-scanner", "SKILL.md"],
      ["institutional-forecast", "SKILL.md"],
    ];
    for (const [skill, file] of pointers) {
      expect(fs.readFileSync(path.join(root, skill, file), "utf8")).toContain("source-standard.md");
    }
  });
});
