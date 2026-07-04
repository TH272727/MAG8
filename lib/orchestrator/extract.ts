/* ============================================================================
 * Tolerant JSON handoff extraction — the PRIMARY parser, not a dormant fallback.
 *
 * Reality check (verified against CLI 2.1.198 session transcripts, 2026-07-03
 * real runs): the SDK's `outputFormat: json_schema` option is advisory — the
 * CLI nudges the model and parses its final message, but does NOT constrain
 * sampling, and it fails open (result subtype "success" with no
 * structured_output). So the trailing ```json fence in the final message is
 * the load-bearing handoff. Models under long research sessions produce it
 * imperfectly: unlabeled fences, pseudo-YAML, // comments on figures,
 * trailing commas. This module salvages every recoverable shape:
 *
 *   1. last ```json-labeled fence      (the contract the wrapper prompts pin)
 *   2. last unlabeled fence that looks like JSON
 *   3. whole-message bare JSON
 *   4. largest {...} slice of the message
 *
 * Each candidate is tried strict-first, then after a string-aware repair pass
 * (strip // and slash-star comments, drop trailing commas).
 * ========================================================================== */

const JSON_FENCE = /```json[^\S\r\n]*\r?\n([\s\S]*?)```/gi;
const ANY_FENCE = /```[a-zA-Z]*[^\S\r\n]*\r?\n([\s\S]*?)```/g;

/** Parse the best JSON candidate out of an agent's final message. */
export function extractJsonLoose(text: string): unknown {
  for (const candidate of jsonCandidates(text)) {
    const parsed = parseMaybeRepair(candidate);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function* jsonCandidates(text: string): Generator<string> {
  const labeled = [...text.matchAll(JSON_FENCE)].map((m) => m[1]);
  for (let i = labeled.length - 1; i >= 0; i--) yield labeled[i];

  const bare = [...text.matchAll(ANY_FENCE)]
    .map((m) => m[1].trim())
    .filter((b) => b.startsWith("{") || b.startsWith("["));
  for (let i = bare.length - 1; i >= 0; i--) yield bare[i];

  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) yield trimmed;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) yield text.slice(first, last + 1);
}

function parseMaybeRepair(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    /* fall through to repair */
  }
  try {
    return JSON.parse(repairJson(s));
  } catch {
    return undefined;
  }
}

/** String-aware repair: strip // and slash-star comments, then trailing commas. */
export function repairJson(s: string): string {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (c === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length - 1 && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += c;
  }

  let out2 = "";
  inStr = false;
  esc = false;
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (inStr) {
      out2 += c;
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out2 += c;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === "}" || out[j] === "]") continue; // trailing comma — drop it
    }
    out2 += c;
  }
  return out2;
}

/**
 * The narrative half of the handoff: the final message minus its trailing
 * JSON wire fence (and a dangling "Structured fields"-style heading above it).
 * This is what becomes fullAnalysisMarkdown.
 */
export function stripTrailingJsonFence(text: string): string {
  const fences = [...text.matchAll(ANY_FENCE)];
  for (let i = fences.length - 1; i >= 0; i--) {
    const m = fences[i];
    const body = m[1].trim();
    const labeledJson = /^```json/i.test(m[0]);
    if (!labeledJson && !body.startsWith("{") && !body.startsWith("[")) continue;
    const before = text
      .slice(0, m.index)
      .replace(/(^|\n)#{0,6}\s*(structured (fields|output)|wire payload)[^\n]*\s*$/i, "\n");
    const after = text.slice(m.index + m[0].length);
    return `${before}\n${after}`.trim();
  }
  return text.trim();
}
