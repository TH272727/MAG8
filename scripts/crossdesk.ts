/**
 * The Cross-Desk Ledger — headless operator CLI.
 *
 *   npm run crossdesk -- --board [--risk PROFILE]   where the desks name the same company
 *   npm run crossdesk -- --ticker SYMBOL            everything every desk says about one name
 *
 * Reads only. It fetches nothing, writes nothing, stores nothing, and costs
 * nothing — every row is derived on the spot from what four desks already hold.
 */
import path from "node:path";

// tsx does not auto-load env files the way Next does.
for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    /* file absent — fine */
  }
}

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const argValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  const v = i >= 0 ? args[i + 1] : undefined;
  // A flag immediately followed by another flag has no value — the CLI bug
  // this repo has already met once, where "--force" was read as a ticker.
  return v && !v.startsWith("--") ? v : undefined;
};

function banner(text: string) {
  console.log(`\n${"=".repeat(72)}\n${text}\n${"=".repeat(72)}`);
}

const DESK_LABEL: Record<string, string> = {
  pipeline: "weekly board",
  insider: "insider scanner",
  bottleneck: "bottleneck desk",
  rotation: "rotation board",
};

const cap = (n: number | null) =>
  n === null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.round(n / 1e6)}M`;

async function board(): Promise<number> {
  const { readLedger } = await import("../lib/crossdesk");

  const t0 = Date.now();
  const ledger = readLedger({ profile: argValue("--risk") ?? null });
  const ms = Date.now() - t0;

  banner(
    `CROSS-DESK LEDGER — ${ledger.settings.minDesks}+ desks · ` +
      `insider tolerance "${ledger.profileKey}"` +
      (ledger.universeWeek ? ` · screen ${ledger.universeWeek}` : ""),
  );

  if (ledger.disabled) {
    console.log(" the ledger is switched off (MAG8_CROSSDESK=0)");
    return 0;
  }

  console.log("\n what each desk has on file\n");
  for (const a of ledger.availability) {
    console.log(
      ` ${(DESK_LABEL[a.desk] ?? a.desk).padEnd(18)}${a.ok ? `${a.named} companies named` : "nothing on file"}`,
    );
    if (!a.ok && a.reason) console.log(`   ${a.reason}`);
  }

  console.log("\n how often each pair names the same company\n");
  for (const p of ledger.pairs) {
    console.log(
      ` ${(DESK_LABEL[p.a] ?? p.a).padEnd(18)}${(DESK_LABEL[p.b] ?? p.b).padEnd(18)}${String(p.shared).padStart(5)}`,
    );
  }

  console.log(
    `\n ${ledger.multiTheme} company(ies) named by more than one bottleneck industry` +
      (ledger.sharedConstraint > 0
        ? ` (${ledger.sharedConstraint} of them over the SAME constrained input — one constraint in two industries, not two)`
        : ""),
  );

  console.log(
    `\n ${ledger.crossed.length} crossing(s) of ${ledger.totalNamed} companies named in total\n`,
  );

  if (ledger.crossed.length === 0) {
    console.log(" No company is named by more than one desk right now.");
    console.log(" That is a statement about the overlap between these desks, not about the companies.");
  } else {
    console.log(
      ` ${"ticker".padEnd(8)}${"desks".padStart(6)}${"measured".padStart(10)}${"themes".padStart(8)}  ` +
        `${"crossed by".padEnd(16)}${"sector".padEnd(24)}${"cap".padStart(9)}  company`,
    );
    for (const r of ledger.shown) {
      console.log(
        ` ${r.ticker.padEnd(8)}${String(r.desks).padStart(6)}${String(r.measuredDesks).padStart(10)}` +
          `${String(r.groups.length).padStart(8)}  ${r.crossedBy.join("+").padEnd(16)}` +
          `${(r.sector ?? "—").padEnd(24)}${cap(r.marketCapUsd).padStart(9)}  ${r.companyName ?? ""}`,
      );
      if (r.crossedBy.includes("themes") && r.constraints.length < r.groups.length) {
        console.log(
          `   ${"".padEnd(18)}[note] its industries lean on the SAME input — one constraint in two, not two`,
        );
      }
      for (const c of r.claims) {
        console.log(
          `   ${(DESK_LABEL[c.desk] ?? c.desk).padEnd(18)}[${c.kind}] ${c.headline}${c.detail ? ` — ${c.detail}` : ""}`,
        );
      }
      if (r.context?.etf) {
        console.log(
          `   ${"neighbourhood".padEnd(18)}[context] ${r.context.sector} tracks ${r.context.etf}` +
            (r.context.score === null ? " — not scored" : ` — reads ${r.context.score.toFixed(1)}`) +
            (r.context.approximate ? " (approximate mapping)" : ""),
        );
      }
      for (const f of r.flags) console.log(`   ${"weekly screen".padEnd(18)}[caution] ${f}`);
    }
    if (ledger.truncated) {
      console.log(`\n showing ${ledger.shown.length} of ${ledger.crossed.length}`);
    }
  }

  if (ledger.flags.length > 0) {
    console.log("\n disclosures\n");
    for (const f of ledger.flags) console.log(` · ${f}`);
  }

  console.log(
    `\n computed from stored data in ${ms}ms · nothing fetched, nothing stored\n` +
      " These desks are not fully independent: two of them draw their candidates from the same weekly\n" +
      " screen, so agreement between them is partly shared plumbing rather than four separate opinions.\n" +
      " Not financial advice.",
  );
  return 0;
}

async function ticker(symbol: string): Promise<number> {
  const { readLedger } = await import("../lib/crossdesk");
  const wanted = symbol.trim().toUpperCase();
  const ledger = readLedger({ profile: argValue("--risk") ?? null });
  const row =
    ledger.crossed.find((r) => r.ticker === wanted) ?? ledger.single.find((r) => r.ticker === wanted);

  banner(`CROSS-DESK — ${wanted}`);
  if (!row) {
    console.log(` No desk names ${wanted} right now.`);
    console.log(" That is not a verdict on the company — it is the four desks having looked elsewhere.");
    return 0;
  }

  console.log(` ${row.companyName ?? wanted}${row.sector ? ` · ${row.sector}` : ""} · ${cap(row.marketCapUsd)}`);
  console.log(
    ` named by ${row.desks} desk(s), ${row.measuredDesks} of which measured it` +
      `${row.eligible ? "" : " · outside the weekly screen"}\n`,
  );
  for (const c of row.claims) {
    console.log(` ${(DESK_LABEL[c.desk] ?? c.desk).padEnd(18)}[${c.kind}]${c.chip ? ` ${c.chip}` : ""}`);
    console.log(`   ${c.headline}`);
    if (c.detail) console.log(`   ${c.detail}`);
  }
  if (row.context?.etf) {
    console.log(
      `\n neighbourhood      ${row.context.sector} tracks ${row.context.etf}` +
        (row.context.score === null ? " — not scored" : ` — reads ${row.context.score.toFixed(1)}`),
    );
    console.log("   A fund is the neighbourhood, never the company.");
  }
  if (row.flags.length > 0) {
    console.log("\n cautions from the weekly screen\n");
    for (const f of row.flags) console.log(` · ${f}`);
  }
  return 0;
}

async function main() {
  const t = argValue("--ticker");
  if (t) {
    process.exitCode = await ticker(t);
    return;
  }
  if (has("--board")) {
    process.exitCode = await board();
    return;
  }
  console.log(
    "Usage: npm run crossdesk -- --board [--risk conservative|balanced|aggressive]\n" +
      "                         | --ticker SYMBOL [--risk PROFILE]",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
