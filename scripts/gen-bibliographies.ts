/**
 * Generates references/bibliography.md inside each skill folder from
 * lib/citations.ts — the same single source the /methodology page renders.
 * Deterministic output (no timestamps), so running it twice is a no-op and
 * `git status` stays clean (D4: citations cannot drift between the page and
 * the playbooks).
 *
 *   npm run gen:bib
 */
import fs from "node:fs";
import path from "node:path";
import { CITATION_GROUPS, type Citation, type CitationGroup } from "../lib/citations";

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

const root = path.resolve(__dirname, "..");
let wrote = 0;
for (const group of CITATION_GROUPS) {
  const skill = GROUP_TO_SKILL[group.key];
  if (!skill) continue;
  const dir = path.join(root, ".claude", "skills", skill, "references");
  if (!fs.existsSync(path.join(root, ".claude", "skills", skill, "SKILL.md"))) {
    console.error(`SKIP ${skill} — skill folder missing (run: npm run setup:skills)`);
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "bibliography.md");
  const next = bibliographyMd(group);
  const prev = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (prev === next) {
    console.log(`OK   ${skill}/references/bibliography.md unchanged`);
  } else {
    fs.writeFileSync(target, next, "utf8");
    console.log(`WROTE ${skill}/references/bibliography.md (${group.works.length} works)`);
  }
  wrote++;
}
const EXPECTED = Object.keys(GROUP_TO_SKILL).length;
if (wrote !== EXPECTED) {
  console.error(`Expected to process ${EXPECTED} playbook bibliographies, processed ${wrote}`);
  process.exit(1);
}
