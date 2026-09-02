import { afterEach, describe, expect, it, vi } from "vitest";
import { setEdgarCacheAdapter, type EdgarFiling, type EdgarSubmissions } from "../../lib/edgar";
import { classifyForm, filingUrl, readCompanyFilings, selectFilings } from "../../lib/reach/filings";
import { companyEvidence, mergeSnapshot, normalizeTickers, type ReachSnapshot } from "../../lib/reach/snapshot";
import type { CompanyFilings } from "../../lib/reach/filings";

/* ============================================================================
 * Offline. The cache adapter is disabled so nothing here can reach lib/db.ts —
 * importing it would open the real SQLite file and run boot reconciliation.
 *
 * The failures this file exists to prevent are all silent ones: a form counted
 * as capital raising when it is an employee stock plan, an offering count that
 * silently reports the capped list instead of the window, a company that could
 * not be read presented as a company with nothing to report.
 * ========================================================================== */

setEdgarCacheAdapter(null);
afterEach(() => vi.unstubAllGlobals());

const filing = (form: string, filed: string, primary = "doc.htm", period = ""): EdgarFiling => ({
  form,
  filingDate: filed,
  reportDate: period,
  accessionNumber: `0001193125-26-${filed.replace(/-/g, "").slice(2)}`,
  primaryDocument: primary,
});

const subs = (filings: EdgarFiling[]): EdgarSubmissions => ({ cik: 1824920, name: "Test Corp", filings });

const ASOF = new Date("2026-09-02T12:00:00Z");

describe("form classification", () => {
  it("recognises the three kinds through their variants", () => {
    expect(classifyForm("10-K")).toBe("periodic");
    expect(classifyForm("10-Q/A")).toBe("periodic");
    expect(classifyForm("20-F")).toBe("periodic");
    expect(classifyForm("8-K")).toBe("event");
    // A foreign private issuer files 6-K where a domestic filer files 8-K.
    expect(classifyForm("6-K")).toBe("event");
    expect(classifyForm("S-1")).toBe("offering");
    expect(classifyForm("S-3/A")).toBe("offering");
    for (const v of ["424B3", "424B5", "424B7"]) expect(classifyForm(v)).toBe("offering");
  });

  it("does not read an employee stock plan as capital raising", () => {
    // S-8 registers shares for compensation. Counting it would report every
    // company that pays people in equity as diluting — verified against a real
    // case: AST SpaceMobile's ONLY S-form in a 180-day window was an S-8, and
    // counting it would have turned a true zero into a false raise.
    expect(classifyForm("S-8")).toBeNull();
    expect(classifyForm("S-8 POS")).toBeNull();
  });

  it("leaves insider forms to the scanner that owns them", () => {
    for (const f of ["3", "4", "4/A", "5", "144"]) expect(classifyForm(f)).toBeNull();
  });

  it("is not fooled by forms that merely start with the same letter", () => {
    for (const f of ["SC 13G", "SC 13D/A", "SCHEDULE 13D/A", "DEF 14A", "DEFA14A", "425", "ARS", "EFFECT", "CORRESP"]) {
      expect(classifyForm(f), `${f} should not classify`).toBeNull();
    }
  });

  it("ignores case and surrounding space, and refuses an empty form", () => {
    expect(classifyForm(" 8-k ")).toBe("event");
    expect(classifyForm("")).toBeNull();
    expect(classifyForm("   ")).toBeNull();
  });
});

describe("selecting what to list", () => {
  it("windows before it caps, and counts offerings over the whole window", () => {
    // Nine offerings inside the window, a cap of 2. The LIST is capped; the
    // COUNT is not — it is a count of what happened, not of what fitted.
    const many = Array.from({ length: 9 }, (_, i) => filing("424B5", `2026-08-${String(i + 1).padStart(2, "0")}`));
    const { recent, offeringCount } = selectFilings(subs(many), { lookbackDays: 180, max: 2, asOf: ASOF });
    expect(recent).toHaveLength(2);
    expect(offeringCount).toBe(9);
  });

  it("drops anything older than the window", () => {
    const out = selectFilings(
      subs([filing("8-K", "2026-08-30"), filing("8-K", "2026-01-05"), filing("10-K", "2025-02-01")]),
      { lookbackDays: 90, max: 10, asOf: ASOF },
    );
    expect(out.recent.map((f) => f.filed)).toEqual(["2026-08-30"]);
  });

  it("returns newest first even when the envelope is not ordered", () => {
    const out = selectFilings(
      subs([filing("8-K", "2026-06-01"), filing("10-Q", "2026-08-10"), filing("8-K", "2026-07-15")]),
      { lookbackDays: 180, max: 10, asOf: ASOF },
    );
    expect(out.recent.map((f) => f.filed)).toEqual(["2026-08-10", "2026-07-15", "2026-06-01"]);
  });

  it("returns an honest empty when the company filed nothing of interest", () => {
    // 46 insider forms and a proxy is a real pattern, not an error. It must
    // come back empty WITHOUT a reason — the reason field means failure.
    const noise = [...Array.from({ length: 46 }, () => filing("4", "2026-08-20")), filing("DEF 14A", "2026-07-01")];
    const out = selectFilings(subs(noise), { lookbackDays: 180, max: 6, asOf: ASOF });
    expect(out.recent).toEqual([]);
    expect(out.offeringCount).toBe(0);
  });

  it("skips filings with no date rather than treating them as current", () => {
    const out = selectFilings(subs([filing("8-K", ""), filing("8-K", "2026-08-30")]), {
      lookbackDays: 180,
      max: 10,
      asOf: ASOF,
    });
    expect(out.recent.map((f) => f.filed)).toEqual(["2026-08-30"]);
  });
});

describe("the URL of the artifact itself", () => {
  it("points at the document when SEC names one", () => {
    const url = filingUrl(1824920, filing("8-K", "2026-08-28", "ionq-20260824.htm"));
    expect(url).toBe("https://www.sec.gov/Archives/edgar/data/1824920/000119312526260828/ionq-20260824.htm");
  });

  it("falls back to the filing index rather than guessing a filename", () => {
    // Exhibit names vary by filing agent. A guessed URL that 404s is worse
    // than a directory that works, because it reads as verification.
    const url = filingUrl(1824920, filing("8-K", "2026-08-28", ""));
    expect(url).toMatch(/-index\.htm$/);
    expect(url).toContain("/Archives/edgar/data/1824920/");
  });

  it("strips zero padding and accession dashes the way EDGAR archives expect", () => {
    expect(filingUrl("0001824920", filing("8-K", "2026-08-28"))).toContain("/data/1824920/");
    expect(filingUrl(1824920, filing("8-K", "2026-08-28"))).not.toMatch(/\/\d{10}-\d{2}-\d{6}\//);
  });
});

describe("failing open, one company at a time", () => {
  /** Serve one canned body to every request. */
  function stub(body: unknown, status = 200) {
    vi.stubGlobal("fetch", async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      headers: { get: () => "application/json" },
    }) as unknown as Response);
  }

  const CIK_MAP = { fields: ["cik", "name", "ticker", "exchange"], data: [[1824920, "IonQ", "IONQ", "Nasdaq"]] };

  it("states a reason when SEC does not list the ticker", async () => {
    stub(CIK_MAP);
    const out = await readCompanyFilings("NOPE", { lookbackDays: 180, max: 6, asOf: ASOF, cache: false });
    expect(out.recent).toEqual([]);
    expect(out.unavailable).toBe("no SEC filer record for this ticker");
    expect(out.cik).toBeNull();
  });

  it("states a reason rather than throwing when the request dies", async () => {
    // One dead company must not take down a refresh of the other seven.
    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("company_tickers")) {
        return { ok: true, status: 200, text: async () => JSON.stringify(CIK_MAP), headers: { get: () => null } } as unknown as Response;
      }
      throw Object.assign(new Error("fetch failed"), { cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }) });
    });
    const out = await readCompanyFilings("IONQ", { lookbackDays: 180, max: 6, asOf: ASOF, cache: false, timeoutMs: 500 });
    expect(out.recent).toEqual([]);
    expect(out.unavailable).toMatch(/filing history unavailable/);
    // The reason has to name the actual fault, not undici's "fetch failed".
    expect(out.unavailable).toMatch(/ENOTFOUND/);
    expect(out.cik).toBe(1824920);
  });
});

describe("the weekly merge", () => {
  const co = (ticker: string, n = 1, unavailable?: string): CompanyFilings => ({
    ticker,
    cik: 1,
    entityName: `${ticker} Inc`,
    recent: unavailable ? [] : Array.from({ length: n }, () => ({ form: "8-K", filed: "2026-08-30", period: "", kind: "event" as const, url: "https://www.sec.gov/x" })),
    offeringCount: 0,
    ...(unavailable ? { unavailable } : {}),
  });

  const snap = (companies: CompanyFilings[], notes: string[] = []): ReachSnapshot => ({
    weekKey: "2026-W36",
    fetchedAt: "2026-09-02T00:00:00.000Z",
    companies,
    notes,
  });

  const merge = (prior: ReachSnapshot | null, wanted: string[], known: Map<string, CompanyFilings>) =>
    mergeSnapshot({ weekKey: "2026-W36", fetchedAt: "2026-09-02T10:00:00.000Z", prior, wanted, known });

  it("keeps a previous run's companies while adding this run's", () => {
    // The week is a frozen reference for every cell cached inside it: a second
    // run must add its cohort without rewriting what the first run was shown.
    const prior = snap([co("ASTS"), co("RKLB")]);
    const known = new Map([["ASTS", co("ASTS")], ["RKLB", co("RKLB")], ["IONQ", co("IONQ")]]);
    const out = merge(prior, ["IONQ"], known);
    expect(out.companies.map((c) => c.ticker)).toEqual(["IONQ", "ASTS", "RKLB"]);
  });

  it("leads with the requested tickers, in the order asked", () => {
    const known = new Map([["A", co("A")], ["B", co("B")], ["C", co("C")]]);
    expect(merge(null, ["C", "A"], known).companies.map((c) => c.ticker)).toEqual(["C", "A", "B"]);
  });

  it("replaces a note only for a ticker this call re-read", () => {
    // Dropping every old note would erase the record of a company that is
    // still unreadable; keeping them all would report a fixed failure.
    const prior = snap([co("ASTS", 0, "filing history unavailable"), co("RKLB")], [
      "ASTS: filing history unavailable",
      "OKLO: no SEC filer record for this ticker",
    ]);
    const known = new Map([["ASTS", co("ASTS", 3)], ["RKLB", co("RKLB")], ["OKLO", co("OKLO", 0, "still gone")]]);
    const out = merge(prior, ["ASTS"], known);
    expect(out.notes).toEqual(["OKLO: no SEC filer record for this ticker"]);
  });

  it("records a fresh failure as a note", () => {
    const known = new Map([["ZZZ", co("ZZZ", 0, "no SEC filer record for this ticker")]]);
    expect(merge(null, ["ZZZ"], known).notes).toEqual(["ZZZ: no SEC filer record for this ticker"]);
  });
});

describe("lookup helpers", () => {
  it("finds a company case-insensitively and returns null for an absent one", () => {
    const s: ReachSnapshot = {
      weekKey: "2026-W36",
      fetchedAt: "",
      companies: [{ ticker: "IONQ", cik: 1, entityName: "IonQ", recent: [], offeringCount: 0 }],
      notes: [],
    };
    expect(companyEvidence(s, "ionq")?.ticker).toBe("IONQ");
    expect(companyEvidence(s, "RKLB")).toBeNull();
    expect(companyEvidence(null, "IONQ")).toBeNull();
  });

  it("normalizes and de-duplicates a ticker list without reordering it", () => {
    expect(normalizeTickers([" ionq ", "RKLB", "ionq", "", "  "])).toEqual(["IONQ", "RKLB"]);
  });
});
