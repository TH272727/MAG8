/**
 * The voice gate — AI writing tells in HAND-WRITTEN public copy.
 *
 *   npm run check:voice            report every hit
 *   npm run check:voice -- --strict   exit 1 on any hit (for a pre-publish gate)
 *   npm run check:voice -- --house    also apply the house-voice patterns
 *
 * Same shape as marketing/video/scripts/check-leak.ts, and for the same reason:
 * this project's method is to turn a judgement into a repeatable check. The
 * patterns come from the `humanizer` skill in .claude/skills, which draws them
 * from Wikipedia's "Signs of AI writing" — the difference is that a skill is
 * advice a reader may or may not take, and this is arithmetic that runs.
 *
 * WHAT IT READS, and what it deliberately does not.
 *
 * It reads hand-written strings: page and component copy, the author-written
 * labels and blurbs in lib/, and the film copy under marketing/video/src. Those
 * are prose a person wrote and can freely rewrite.
 *
 * It does NOT rewrite anything, and nothing about it is wired into a build. Two
 * classes of text are especially not its business:
 *
 *   - The deterministic writers. lib/rotation/brief.ts, lib/insider/report.ts,
 *     lib/tide/report.ts and lib/risk/report.ts assemble sentences from figures
 *     and then verify that every numeral traces back to an input. Flagging a
 *     template there is safe and useful; EDITING one means re-running that
 *     desk's number verifier, and a rewrite that changes what a sentence claims
 *     while keeping its digits would pass the verifier and still be false.
 *   - Anything a model produced at run time. Lens write-ups go through
 *     sanitizeMarkdown and the public-view boundary, and a second rewriting
 *     pass over analysis prose is how a real source link becomes a broken one.
 *
 * THE HOUSE-VOICE EXCEPTION. Two of the strongest patterns in the source —
 * em-dash-as-connector and the one-line closer — are this project's deliberate
 * voice. CLAUDE.md is written that way; so is every desk page. A linter that
 * flags the house voice on every run gets ignored, and an ignored gate is worse
 * than no gate. They live behind --house so they can be looked at on purpose.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const withHouse = args.includes("--house");

/* ----------------------------------------------------------------------------
 * What counts as hand-written copy
 * -------------------------------------------------------------------------- */

const ROOTS = ["app", "components", "lib", "marketing/video/src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".md"]);

const SKIP_DIRS = new Set(["node_modules", ".next", "out", "public", "fonts", "data"]);

/**
 * Files whose text is assembled from figures rather than written.
 *
 * Still scanned — a template can carry a tell like anything else — but reported
 * under a heading that says editing one has a gate attached.
 */
const GENERATED_WRITERS = [
  "lib/rotation/brief.ts",
  "lib/insider/report.ts",
  "lib/tide/report.ts",
  "lib/risk/report.ts",
];

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(p, out);
    else if (EXTENSIONS.has(extname(name))) out.push(p);
  }
}

/* ----------------------------------------------------------------------------
 * The patterns
 * -------------------------------------------------------------------------- */

interface Pattern {
  id: string;
  section: string;
  why: string;
  re: RegExp;
  /** House voice: off unless --house. */
  house?: boolean;
}

const words = (list: string[]) => new RegExp(`\\b(${list.join("|")})\\b`, "gi");
const phrases = (list: string[]) =>
  new RegExp(`(${list.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");

/**
 * Deliberately ABSENT: the source's curly-quotation-mark pattern (§21).
 *
 * It is a real tell in plain prose, where a straight quote was meant. In a
 * TypeScript codebase it is not: curly quotes inside JSX copy are correct
 * typography, and a curly quote that has genuinely leaked into code is a syntax
 * error that tsc catches before this ever runs. Every hit it produced here was
 * a film caption quoting someone correctly. A rule that only cries wolf is
 * worse than no rule, which is the same reasoning that puts the house-voice
 * patterns behind a flag.
 */
const PATTERNS: Pattern[] = [
  {
    id: "chatbot-residue",
    section: "§22",
    why: "A chatbot's greeting, praise, offer or closing left in text that should stand on its own.",
    re: phrases([
      "I hope this helps",
      "Of course!",
      "Certainly!",
      "Great question",
      "You're absolutely right",
      "Would you like me to",
      "Want me to",
      "Should I continue",
      "let me know if",
      "Here's a breakdown",
    ]),
  },
  {
    id: "knowledge-limit",
    section: "§23",
    why: "A disclaimer about where knowledge ends, or a guess presented as a finding.",
    re: phrases([
      "as of my last",
      "up to my last training",
      "while specific details are limited",
      "based on available information",
      "not widely documented",
      "in the provided sources",
      "it is believed that",
      "appears to have been established",
    ]),
  },
  {
    id: "overused-words",
    section: "§12",
    why: "Words models reach for far more often than people do, and the tell is the cluster, not the word.",
    re: words([
      "delve",
      "delves",
      "delving",
      "tapestry",
      "testament",
      "meticulous",
      "meticulously",
      "pivotal",
      "underscore",
      "underscores",
      "underscoring",
      "showcase",
      "showcases",
      "showcasing",
      "intricate",
      "intricacies",
      "interplay",
      "garner",
      "garnered",
      "bolstered",
      "vibrant",
      "fostering",
      "emphasizing",
      "enduring",
    ]),
  },
  {
    id: "inflated-significance",
    section: "§13",
    why: "An ordinary detail dressed as a turning point, a legacy, or a promise about the future.",
    re: phrases([
      "stands as a testament",
      "a pivotal moment",
      "a crucial moment",
      "plays a key role",
      "underscores its importance",
      "reflects a broader",
      "lasting legacy",
      "enduring legacy",
      "setting the stage for",
      "evolving landscape",
      "indelible mark",
      "the future looks bright",
      "exciting times ahead",
      "a step in the right direction",
      "continues to thrive",
    ]),
  },
  {
    id: "sales-language",
    section: "§16",
    why: "Promotional register in text that is supposed to report a measurement.",
    re: phrases([
      "game-changer",
      "game changing",
      "revolutionize",
      "revolutionizing",
      "cutting-edge",
      "state-of-the-art",
      "seamlessly",
      "unlock the power",
      "take it to the next level",
      "best-in-class",
      "world-class",
    ]),
  },
  {
    id: "vague-association",
    section: "§14",
    why: "A connection asserted without a mechanism — the sentence sounds like a claim and makes none.",
    re: phrases([
      "is closely tied to",
      "is deeply connected to",
      "has been associated with",
      "is often linked to",
      "reflects the growing",
    ]),
  },
  {
    id: "em-dash-connector",
    section: "§8",
    why: "The em dash used as the universal connector. HOUSE VOICE — this project uses it deliberately.",
    re: /—/g,
    house: true,
  },
  {
    id: "not-x-but-y",
    section: "§1",
    why: "The not-X-but-Y contrast, which adds weight rather than a fact. HOUSE VOICE — used deliberately here.",
    re: /\b(is|was|are|were|it's|its) not (?:just |merely |simply |only )?[a-z][a-z ]{2,30}, (?:but|it's|it is) /gi,
    house: true,
  },
];

/* ----------------------------------------------------------------------------
 * Run
 * -------------------------------------------------------------------------- */

const files: string[] = [];
for (const r of ROOTS) walk(join(ROOT, r), files);

interface Hit {
  file: string;
  line: number;
  pattern: Pattern;
  match: string;
  text: string;
}

const active = PATTERNS.filter((p) => withHouse || !p.house);
const hits: Hit[] = [];

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  let content: string;
  try {
    content = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Comments are notes to whoever maintains this, not copy anybody reads.
    const trimmed = line.trim();
    if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    for (const p of active) {
      p.re.lastIndex = 0;
      const found = line.match(p.re);
      if (!found) continue;
      for (const m of new Set(found)) {
        hits.push({ file: rel, line: i + 1, pattern: p, match: m, text: trimmed.slice(0, 120) });
      }
    }
  }
}

const isGenerated = (f: string) => GENERATED_WRITERS.some((g) => f === g);
const authored = hits.filter((h) => !isGenerated(h.file));
const generated = hits.filter((h) => isGenerated(h.file));

function report(title: string, list: Hit[], note?: string) {
  if (list.length === 0) return;
  console.log(`\n${title}`);
  if (note) console.log(`  ${note}`);
  const byPattern = new Map<string, Hit[]>();
  for (const h of list) {
    const k = `${h.pattern.section} ${h.pattern.id}`;
    byPattern.set(k, [...(byPattern.get(k) ?? []), h]);
  }
  for (const [k, group] of [...byPattern].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${k} — ${group.length} hit${group.length === 1 ? "" : "s"}`);
    console.log(`    ${group[0].pattern.why}`);
    for (const h of group.slice(0, 8)) {
      console.log(`    ${h.file}:${h.line}  "${h.match}"`);
      console.log(`      ${h.text}`);
    }
    if (group.length > 8) console.log(`    ... ${group.length - 8} more`);
  }
}

console.log(
  `voice gate — ${files.length} files scanned across ${ROOTS.join(", ")}` +
    (withHouse ? " (house-voice patterns INCLUDED)" : " (house-voice patterns off; pass --house for them)"),
);

report("AUTHORED COPY", authored);
report(
  "DETERMINISTIC WRITERS",
  generated,
  "Flagging is safe; editing one of these means re-running `npm run test` and that desk's number verifier.",
);

console.log(
  `\n${authored.length} hit${authored.length === 1 ? "" : "s"} in authored copy · ` +
    `${generated.length} in deterministic writers · ${active.length} patterns active`,
);

if (strict && authored.length > 0) {
  console.error("\nVOICE: authored copy carries AI writing tells (--strict).");
  process.exit(1);
}
