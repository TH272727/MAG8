import { findCitation, type Citation } from "./citations";

/* ============================================================================
 * The source standard — what counts as evidence, and what is only a lead.
 *
 * Single source of truth (the buildRubricText pattern): the stage prompts, the
 * /methodology page, and each playbook's references/source-standard.md all
 * render from the constants below, so the rule the research actually runs under
 * and the rule the site publishes cannot drift apart.
 *
 * This does not tell a lens WHERE to look. It tells every lens how to decide
 * whether what it found is allowed to move a number. Three of the four
 * playbooks already carry a version of this judgment in their own words —
 * "prefer primary sources over aggregators and forums", "omit beats improvise",
 * "leads to verify, never gospel". Naming it once means it is applied the same
 * way in all of them instead of being re-derived, differently, each run.
 *
 * WHITE-LABEL: this text reaches published write-ups by way of the prompt, so
 * it uses "playbook" throughout and never the internal vocabulary that
 * lib/public-view.ts exists to scrub.
 * ========================================================================== */

export interface SourceTier {
  key: "A" | "B";
  label: string;
  /** What this tier is permitted to do. */
  verdict: string;
  clauses: string[];
}

export const SOURCE_TIERS: readonly SourceTier[] = [
  {
    key: "A",
    label: "Primary-source and practitioner material",
    verdict: "usable as evidence",
    clauses: [
      "A primary-source statement — the entity's own dated words: a filing, transcript, official release, or direct quote. The artifact itself, not a summary of it and not a reaction to it.",
      "Practitioner material citing specifics a casual observer could not produce — part numbers, benchmarks, capacity figures, firsthand operational detail. Judge by what the item contains, never by which platform carried it or what its author claims to be.",
    ],
  },
  {
    key: "B",
    label: "Sentiment and commentary",
    verdict: "a lead, never evidence",
    clauses: [
      "Generic sentiment, hype, reaction threads, engagement-driven commentary, unsourced aggregator summaries.",
      "It tells you what to verify; it never stands in for the verification, and alone it moves no verdict, score, probability, or target.",
    ],
  },
] as const;

export const SOURCE_RULES: readonly string[] = [
  "Prefer the artifact over a description of it: where the filing, transcript, or release is reachable, cite that rather than a post about it.",
  "Classify before you use it, and say so in one line when the call is close.",
  "Where a claim rests on Tier B alone, keep it and label it — an acknowledged thin spot beats a confident one, and beats a silent deletion.",
  "A reliable channel does not make an item on it reliable; the tier is decided per item.",
] as const;

/** Works already in the citation registry that this standard rests on. */
export const SOURCE_STANDARD_CITES: readonly string[] = [
  "Barber & Odean 2008",
  "Cohen, Malloy & Pomorski 2012",
  "Green 2005",
] as const;

export function sourceStandardCitations(): Citation[] {
  return SOURCE_STANDARD_CITES.map(findCitation).filter((c): c is Citation => c !== undefined);
}

/**
 * Compact form, injected into every research-stage prompt. This is what
 * actually binds: a playbook file can go unread, a prompt cannot. Kept short on
 * purpose — a lens cell runs against a hard per-call budget, so every token
 * here is one the analysis does not get.
 */
export function buildSourceStandardText(): string {
  const tier = (t: SourceTier) => `- TIER ${t.key} — ${t.verdict}. ${t.clauses.join(" ")}`;
  return `Source discipline (governs every claim in this analysis):
${SOURCE_TIERS.map(tier).join("\n")}
${SOURCE_RULES.map((r) => `- ${r}`).join("\n")}`;
}

/**
 * Full form: the playbook reference file and the /methodology section. Free to
 * be longer than the prompt form, and carries the evidence base — including
 * Green 2005, which is the inconvenient one: expertise alone did not predict
 * well, which is exactly why Tier A is decided on content and not on credential.
 */
export function buildSourceStandardDoc(): string {
  const lines: string[] = [
    "# The source standard — what counts as evidence here",
    "",
    "> Generated from the platform's source standard (`lib/source-standard.ts`) by `npm run gen:bib`.",
    "> Do not edit by hand — edit the module and regenerate. The same text is injected into every",
    "> research prompt and published on the methodology page, so all three cannot drift apart.",
    "",
    "This does not tell you where to look. It tells you whether what you found is allowed to move a",
    "number. Apply it to anything that is somebody's opinion, claim, or narrative. Structured data —",
    "a quoted price, a filed figure, a share count — is not covered by it and does not need it.",
    "",
    "## The two tiers",
    "",
  ];
  for (const t of SOURCE_TIERS) {
    lines.push(`### Tier ${t.key} — ${t.label} (${t.verdict})`, "");
    for (const c of t.clauses) lines.push(`- ${c}`);
    lines.push("");
  }
  lines.push("## Applying it", "");
  for (const r of SOURCE_RULES) lines.push(`- ${r}`);
  lines.push(
    "",
    "## Why this is a name for something already here, not a new rule",
    "",
    "- The fundamentals playbook already says to prefer primary sources over aggregators and forums.",
    "- The street-consensus playbook already refuses to reconstruct a number it cannot fetch and date.",
    "- The discovery playbook already treats \"next Nvidia\" chatter as a lead to verify, never as gospel.",
    "",
    "What changes is that all of them now decide it the same way.",
    "",
    "## Evidence base",
    "",
  );
  for (const c of sourceStandardCitations()) {
    const title = /[.?!]$/.test(c.title) ? c.title : `${c.title}.`;
    lines.push(`- **${c.authors} (${c.year}).** ${title} *${c.source}.*${c.url ? ` <${c.url}>` : ""}`);
    lines.push(`  ${c.finding}`);
  }
  lines.push("");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
