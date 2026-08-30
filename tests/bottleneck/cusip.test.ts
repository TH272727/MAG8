import { describe, expect, it } from "vitest";
import {
  cusipIdType,
  figiJobs,
  isCins,
  isUsListing,
  matchUniverseName,
  normalizeCusip,
  normalizeIssuerName,
  pickFigiRow,
} from "../../lib/bottleneck/cusip";

/* ============================================================================
 * The pure half of CUSIP resolution. The network half is exercised by the live
 * probe (`npm run bottleneck -- --probe`), which is where a change in
 * OpenFIGI's contract would actually show up.
 * ========================================================================== */

describe("identifier shape decides the lookup type", () => {
  it("treats a leading letter as the international (CINS) form", () => {
    expect(isCins("G11448100")).toBe(true); // Bitdeer, Cayman
    expect(isCins("N97284108")).toBe(true); // Nebius, Netherlands
    expect(isCins("038169207")).toBe(false); // Applied Digital, domestic
  });

  it("submits each identifier under the id type it will actually resolve as", () => {
    // Verified live 2026-08-30: ID_CUSIP on G11448100 returns "No identifier
    // found"; ID_CINS resolves it to BTDR. The reverse is rejected as an
    // invalid idValue format, so this cannot be a blind retry.
    expect(cusipIdType("G11448100")).toBe("ID_CINS");
    expect(cusipIdType("595112103")).toBe("ID_CUSIP");
  });

  it("normalizes whitespace and case before asking", () => {
    expect(normalizeCusip(" 038169207 ")).toBe("038169207");
    expect(normalizeCusip("g11448100")).toBe("G11448100");
  });

  it("builds one job per identifier, carrying the exchange filter when given", () => {
    expect(figiJobs(["038169207", "G11448100"], "US")).toEqual([
      { idType: "ID_CUSIP", idValue: "038169207", exchCode: "US" },
      { idType: "ID_CINS", idValue: "G11448100", exchCode: "US" },
    ]);
    expect(figiJobs(["038169207"])).toEqual([{ idType: "ID_CUSIP", idValue: "038169207" }]);
  });
});

describe("picking a listing out of a multi-venue answer", () => {
  const rows = [
    { ticker: "R1T", exchCode: "TH", securityType: "Common Stock", marketSector: "Equity" },
    { ticker: "BTDREUR", exchCode: "EO", securityType: "Common Stock", marketSector: "Equity" },
    { ticker: "BTDR", exchCode: "US", securityType: "Common Stock", marketSector: "Equity" },
  ];

  it("prefers the US common line over whichever venue came back first", () => {
    // An unrestricted lookup returns a dozen venues; taking rows[0] hands back
    // a Tradegate ticker for a US-listed name.
    expect(pickFigiRow(rows)!.ticker).toBe("BTDR");
  });

  it("falls back to any US line, then to whatever exists", () => {
    expect(pickFigiRow([{ ticker: "X", exchCode: "US", securityType: "ADR" }])!.ticker).toBe("X");
    expect(pickFigiRow([{ ticker: "Y", exchCode: "LN" }])!.ticker).toBe("Y");
    expect(pickFigiRow([])).toBeNull();
  });
});

describe("only a US listing counts as tradeable", () => {
  it("separates a US line from a foreign venue symbol", () => {
    // Real case, 2026-08-30: CUSIP 09173B107 (Bitfarms) has no US line in
    // OpenFIGI and an unrestricted lookup returns six German venues. Reporting
    // "1B2" as the ticker for a Nasdaq-listed company is the bug this prevents.
    expect(isUsListing("openfigi")).toBe(true);
    expect(isUsListing("universe-name")).toBe(true);
    expect(isUsListing("openfigi-foreign")).toBe(false);
    expect(isUsListing("unresolved")).toBe(false);
  });
});

describe("matching an issuer name against the universe snapshot", () => {
  it("ignores legal form, punctuation and share-class noise", () => {
    expect(normalizeIssuerName("SANDISK CORP")).toBe(normalizeIssuerName("SanDisk Corporation"));
    expect(normalizeIssuerName("BABCOCK & WILCOX ENTERPRISES")).toBe(
      normalizeIssuerName("Babcock and Wilcox Enterprises, Inc."),
    );
    expect(normalizeIssuerName("BLOOM ENERGY CORP  CL A")).toBe(normalizeIssuerName("Bloom Energy Corp."));
  });

  it("resolves a name that exactly one listing claims", () => {
    const listings = [
      { t: "SNDK", n: "SanDisk Corporation" },
      { t: "MU", n: "Micron Technology, Inc." },
    ];
    expect(matchUniverseName("SANDISK CORP", listings)).toEqual({ ticker: "SNDK", name: "SanDisk Corporation" });
  });

  it("refuses to guess when two listings normalize the same", () => {
    // A wrong ticker in a proposed order list is worse than an unresolved row.
    const listings = [
      { t: "AAA", n: "Acme Holdings Inc" },
      { t: "BBB", n: "Acme Holdings Corp" },
    ];
    expect(matchUniverseName("ACME HOLDINGS", listings)).toBeNull();
  });

  it("refuses a name that normalizes down to almost nothing", () => {
    expect(matchUniverseName("THE CO", [{ t: "X", n: "The Company" }])).toBeNull();
  });

  it("returns nothing when no listing matches", () => {
    expect(matchUniverseName("NEBIUS GROUP N.V.", [{ t: "MU", n: "Micron Technology" }])).toBeNull();
  });
});
