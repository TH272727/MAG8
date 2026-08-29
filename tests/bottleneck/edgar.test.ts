import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bareAccession,
  bareCik,
  EdgarError,
  edgarFetch,
  getCompanyConcept,
  getFilingIndex,
  getSubmissions,
  padCik,
  setEdgarCacheAdapter,
  type EdgarCacheAdapter,
} from "../../lib/edgar";

/* ============================================================================
 * Offline: every response below is a frozen real SEC payload (tests/fixtures).
 * The cache adapter is disabled so no test can reach lib/db.ts — importing it
 * would open the real SQLite file and run boot reconciliation.
 * ========================================================================== */

const FIXTURES = path.join(__dirname, "..", "fixtures");
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

/** Serve fixtures by URL substring; anything unmapped is a hard 404. */
function stubFetch(routes: Record<string, { body: string; status?: number }>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string | URL) => {
    const u = String(url);
    calls.push(u);
    for (const [needle, res] of Object.entries(routes)) {
      if (u.includes(needle)) {
        return new Response(res.body, {
          status: res.status ?? 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response("not found", { status: 404 });
  });
  return calls;
}

beforeEach(() => {
  setEdgarCacheAdapter(null); // never touch SQLite from a test
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("identifier formatting", () => {
  it("zero-pads CIKs to 10 digits for data.sec.gov", () => {
    expect(padCik(320193)).toBe("0000320193");
    expect(padCik("2045724")).toBe("0002045724");
    expect(padCik("CIK0000320193")).toBe("0000320193");
  });

  it("strips leading zeros for Archives paths", () => {
    expect(bareCik("0000320193")).toBe("320193");
    expect(bareCik(2045724)).toBe("2045724");
  });

  it("strips dashes from accession numbers", () => {
    expect(bareAccession("0000935836-26-000418")).toBe("000093583626000418");
  });
});

describe("getSubmissions", () => {
  it("reads the columnar envelope and exposes reportDate", async () => {
    // Regression guard: the source implementation prompt called this field
    // `periodOfReport`, which does not exist in the submissions payload.
    stubFetch({ "/submissions/CIK0002045724.json": { body: fixture("submissions-2045724.json") } });

    const subs = await getSubmissions(2045724);
    expect(subs.name).toBe("Situational Awareness LP");
    expect(subs.cik).toBe(2045724);

    const thirteenF = subs.filings.filter((f) => f.form === "13F-HR");
    expect(thirteenF.length).toBeGreaterThanOrEqual(7);

    const latest = thirteenF[0];
    expect(latest.accessionNumber).toBe("0000935836-26-000418");
    expect(latest.filingDate).toBe("2026-08-14");
    expect(latest.reportDate).toBe("2026-06-30"); // the period, not the filing date
  });

  it("sorts filings newest-first", async () => {
    stubFetch({ "/submissions/": { body: fixture("submissions-2045724.json") } });
    const { filings } = await getSubmissions(2045724);
    const dates = filings.map((f) => f.filingDate);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("reports the 45-day lag as a real gap between period end and filing", async () => {
    stubFetch({ "/submissions/": { body: fixture("submissions-2045724.json") } });
    const { filings } = await getSubmissions(2045724);
    const f = filings.find((x) => x.form === "13F-HR")!;
    const lagDays = (Date.parse(f.filingDate) - Date.parse(f.reportDate)) / 86_400_000;
    expect(lagDays).toBeGreaterThan(30);
    expect(lagDays).toBeLessThanOrEqual(46);
  });
});

describe("getFilingIndex", () => {
  it("lists the real filenames inside a 13F filing", async () => {
    stubFetch({ "/index.json": { body: fixture("13f-filing-index.json") } });
    const files = await getFilingIndex(2045724, "0000935836-26-000418");
    const names = files.map((f) => f.name);

    // Load-bearing: the info table is NOT named `information_table.xml` or
    // `infotable.xml`, and primary_doc.xml is the cover page, not the holdings.
    expect(names).toContain("form13fInfoTable.xml");
    expect(names).toContain("primary_doc.xml");
    expect(files.find((f) => f.name === "form13fInfoTable.xml")!.size).toBeGreaterThan(1000);
  });

  it("builds the Archives URL with a bare CIK and dashless accession", async () => {
    const calls = stubFetch({ "/index.json": { body: fixture("13f-filing-index.json") } });
    await getFilingIndex("0002045724", "0000935836-26-000418");
    expect(calls[0]).toContain("/edgar/data/2045724/000093583626000418/index.json");
  });
});

describe("getCompanyConcept", () => {
  it("returns the USD fact series for a tagged concept", async () => {
    stubFetch({ "/companyconcept/": { body: fixture("companyconcept-aapl-capex.json") } });
    const facts = await getCompanyConcept(320193, "PaymentsToAcquirePropertyPlantAndEquipment");
    expect(facts).not.toBeNull();
    expect(facts!.length).toBe(105);
    expect(facts![0]).toHaveProperty("val");
    expect(facts![0]).toHaveProperty("end");
  });

  it("treats a never-tagged concept as data (null), not an error", async () => {
    // A filer that never used the tag 404s — that is an answer, not a failure.
    stubFetch({});
    await expect(getCompanyConcept(320193, "MadeUpTagThatNoFilerUses")).resolves.toBeNull();
  });
});

describe("13F information-table variance (fixtures for the Phase 5 parser)", () => {
  // The SAME filer ships both shapes depending on the filing agent. A parser
  // that matches only `<infoTable>` returns zero holdings on half of them —
  // silently, with no error. Discovered by the live probe, 2026-08-29.
  const plain = fixture("13f-situational-awareness-2026Q2.xml");
  const namespaced = fixture("13f-namespaced-2025Q3.xml");
  const ROW = /<(?:\w+:)?infoTable[\s>]/g;

  it("the unprefixed variant carries 26 rows", () => {
    expect((plain.match(ROW) ?? []).length).toBe(26);
    expect(plain).toContain("<nameOfIssuer>");
  });

  it("the ns1-prefixed variant carries 28 rows and needs the same matcher", () => {
    expect((namespaced.match(ROW) ?? []).length).toBe(28);
    expect(namespaced).toContain("<ns1:nameOfIssuer>");
    // Proof of the trap: a prefix-blind matcher finds nothing here.
    expect((namespaced.match(/<infoTable>/g) ?? []).length).toBe(0);
  });

  it("declares the same schema namespace in both shapes", () => {
    const ns = "http://www.sec.gov/edgar/document/thirteenf/informationtable";
    expect(plain).toContain(ns);
    expect(namespaced).toContain(ns);
  });

  it("putCall is title case, absent on plain stock, in both shapes", () => {
    const pc = (xml: string) =>
      [...xml.matchAll(/<(?:\w+:)?putCall>([^<]*)<\/(?:\w+:)?putCall>/g)].map((m) => m[1].trim());
    expect(pc(plain)).toEqual(["Call", "Put", "Call"]);
    expect(pc(namespaced).length).toBe(9);
    for (const v of [...pc(plain), ...pc(namespaced)]) expect(["Put", "Call"]).toContain(v);
    // Absent, not blank: far fewer putCall elements than holdings rows.
    expect(pc(plain).length).toBeLessThan((plain.match(ROW) ?? []).length);
  });

  it("titleOfClass carries trailing whitespace that must be trimmed", () => {
    expect(namespaced).toContain("<ns1:titleOfClass>COM NEW </ns1:titleOfClass>");
  });
});

describe("error mapping", () => {
  it("explains a 403 as the User-Agent problem it always is", async () => {
    stubFetch({ "data.sec.gov": { body: "forbidden", status: 403 } });
    await expect(edgarFetch("https://data.sec.gov/whatever.json")).rejects.toThrow(/403[\s\S]*User-Agent/);
  });

  it("does not retry a definitive 404", async () => {
    const calls = stubFetch({});
    await expect(edgarFetch("https://data.sec.gov/missing.json")).rejects.toMatchObject({ status: 404 });
    expect(calls.length).toBe(1);
  });

  it("marks a 404 as notFound", async () => {
    stubFetch({});
    const err = await edgarFetch("https://data.sec.gov/missing.json").catch((e) => e);
    expect(err).toBeInstanceOf(EdgarError);
    expect((err as EdgarError).notFound).toBe(true);
  });

  it("retries a transient 503 and then gives up", async () => {
    const calls = stubFetch({ "data.sec.gov": { body: "busy", status: 503 } });
    await expect(edgarFetch("https://data.sec.gov/x.json", { retries: 1 })).rejects.toThrow(/503/);
    expect(calls.length).toBe(2); // initial attempt + one retry
  });
});

describe("caching", () => {
  it("serves a fresh hit without refetching, and stores on a miss", async () => {
    const store = new Map<string, { body: string; contentType: string | null; fetchedAt: string }>();
    const adapter: EdgarCacheAdapter = {
      get: (url) => store.get(url) ?? null,
      set: (url, body, contentType) =>
        void store.set(url, { body, contentType, fetchedAt: new Date().toISOString() }),
    };
    setEdgarCacheAdapter(adapter);

    const calls = stubFetch({ "/index.json": { body: fixture("13f-filing-index.json") } });
    const url = "https://www.sec.gov/Archives/edgar/data/2045724/000093583626000418/index.json";

    await edgarFetch(url, { cache: "forever" });
    expect(calls.length).toBe(1);
    expect(store.size).toBe(1);

    await edgarFetch(url, { cache: "forever" });
    expect(calls.length).toBe(1); // second call served from cache
  });

  it("refetches once a TTL has expired", async () => {
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const adapter: EdgarCacheAdapter = {
      get: () => ({ body: "{}", contentType: null, fetchedAt: stale }),
      set: () => undefined,
    };
    setEdgarCacheAdapter(adapter);

    const calls = stubFetch({ "/index.json": { body: fixture("13f-filing-index.json") } });
    await edgarFetch("https://www.sec.gov/Archives/edgar/data/1/2/index.json", {
      cache: 24 * 60 * 60 * 1000,
    });
    expect(calls.length).toBe(1); // 48h-old entry is past a 24h TTL
  });

  it("never touches storage when caching is off", async () => {
    let touched = false;
    setEdgarCacheAdapter({
      get: () => {
        touched = true;
        return null;
      },
      set: () => {
        touched = true;
      },
    });
    stubFetch({ "/index.json": { body: fixture("13f-filing-index.json") } });
    await edgarFetch("https://www.sec.gov/Archives/edgar/data/1/2/index.json", { cache: false });
    expect(touched).toBe(false);
  });
});
