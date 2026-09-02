/**
 * Generates the two files each skill folder carries but does not own:
 *   references/bibliography.md    ← lib/citations.ts
 *   references/source-standard.md ← lib/source-standard.ts
 * Both render from the same single sources the /methodology page renders, and
 * the source standard is additionally injected into every research prompt — so
 * the rule the research runs under, the rule the playbook states, and the rule
 * the site publishes cannot drift apart.
 *
 * Deterministic output (no timestamps), so running it twice is a no-op and
 * `git status` stays clean (D4).
 *
 *   npm run gen:bib
 */
import fs from "node:fs";
import path from "node:path";
import { CITATION_GROUPS, type Citation, type CitationGroup } from "../lib/citations";
import { buildSourceStandardDoc } from "../lib/source-standard";

/** Public citation group → skill folder its bibliography lands in. */
const GROUP_TO_SKILL: Partial<Record<CitationGroup["key"], string>> = {
  fundamentals: "stock-scanner",
  macro: "gt-predictor",
  consensus: "institutional-forecast",
  discovery: "new-gen-stock",
  insider: "insider-turnaround",
  // "rubric" renders on /methodology only — the compiler is not a skill.
};

function entryMd(c: Citation): string {
  const title = /[.?!]$/.test(c.title) ? c.title : `${c.title}.`;
  const head = `- **${c.authors} (${c.year}).** ${title} *${c.source}.*${c.url ? ` <${c.url}>` : ""}`;
  return `${head}\n  ${c.finding} ${c.usedFor}`;
}

function bibliographyMd(group: CitationGroup): string {
  return [
    `# Bibliography — the evidence base for this playbook`,
    ``,
    `> Generated from the platform's citation registry (\`lib/citations.ts\`) by \`npm run gen:bib\`.`,
    `> Do not edit by hand — edit the registry and regenerate. Load this file only when the user`,
    `> asks about the evidence or methodology behind the method; it is not needed for a normal run.`,
    ``,
    group.intro ? `${group.intro}\n` : ``,
    ...group.works.map(entryMd),
    ``,
  ]
    .filter((line) => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Playbooks that carry the source standard: the four that do live research.
 * insider-turnaround is deliberately excluded — it reads back a deterministic
 * report and is told in as many words that it computes nothing, so a rule about
 * weighing research it never does would only muddy that.
 */
const SOURCE_STANDARD_SKILLS = ["stock-scanner", "gt-predictor", "institutional-forecast", "new-gen-stock"];

const root = path.resolve(__dirname, "..");
const skillDir = (skill: string) => path.join(root, ".claude", "skills", skill);

function writeIfChanged(skill: string, file: string, next: string, note: string): boolean {
  if (!fs.existsSync(path.join(skillDir(skill), "SKILL.md"))) {
    console.error(`SKIP ${skill} — skill folder missing (run: npm run setup:skills)`);
    return false;
  }
  const dir = path.join(skillDir(skill), "references");
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  const prev = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (prev === next) {
    console.log(`OK    ${skill}/references/${file} unchanged`);
  } else {
    fs.writeFileSync(target, next, "utf8");
    console.log(`WROTE ${skill}/references/${file} (${note})`);
  }
  return true;
}

let bibs = 0;
for (const group of CITATION_GROUPS) {
  const skill = GROUP_TO_SKILL[group.key];
  if (!skill) continue;
  if (writeIfChanged(skill, "bibliography.md", bibliographyMd(group), `${group.works.length} works`)) bibs++;
}

const standard = buildSourceStandardDoc();
let standards = 0;
for (const skill of SOURCE_STANDARD_SKILLS) {
  if (writeIfChanged(skill, "source-standard.md", standard, "shared source standard")) standards++;
}

const EXPECTED_BIBS = Object.keys(GROUP_TO_SKILL).length;
if (bibs !== EXPECTED_BIBS || standards !== SOURCE_STANDARD_SKILLS.length) {
  console.error(
    `Expected ${EXPECTED_BIBS} bibliographies and ${SOURCE_STANDARD_SKILLS.length} source standards; ` +
      `processed ${bibs} and ${standards}`,
  );
  process.exit(1);
}
