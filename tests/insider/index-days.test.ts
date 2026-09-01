import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
 * How an absent day is told apart from a refused client.
 *
 * SEC answers a daily-index file that does not exist with 403, not 404 —
 * verified live 2026-08-31 against a Saturday, a Sunday, the current day before
 * publication, and a fabricated date, all of which returned 403 with a
 * 230-byte body while the previous trading day returned 200 and 1.4 MB.
 *
 * That collides with the shared client's rule that 403 means the User-Agent is
 * wrong, which is correct everywhere else on SEC. These tests pin both halves
 * of the resolution: one day at a time a refusal is an absence, and in
 * aggregate a window of nothing but refusals is a fault, never a market with no
 * filings in it.
 * ========================================================================== */

const { edgarFetch } = vi.hoisted(() => ({ edgarFetch: vi.fn() }));

vi.mock("../../lib/edgar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/edgar")>();
  return { ...actual, edgarFetch };
});

const { EdgarError } = await import("../../lib/edgar");
const { fetchIndexDay } = await import("../../lib/insider/form4");

const INDEX_BODY = [
  "Form Type   Company Name                       CIK         Date Filed  File Name",
  "4                Example Corp                       1234567     20260828    edgar/data/1234567/0001111111-26-000001.txt",
].join("\n");

beforeEach(() => {
  edgarFetch.mockReset();
});

describe("fetchIndexDay", () => {
  it("reads a trading day's filings", async () => {
    edgarFetch.mockResolvedValueOnce(INDEX_BODY);
    const res = await fetchIndexDay("2026-08-28");
    expect(res.ok).toBe(true);
    expect(res.noSession).toBe(false);
    expect(res.refused).toBe(false);
    expect(res.filings).toHaveLength(1);
  });

  it("treats a 403 as an absent day, not as a rejected client", async () => {
    edgarFetch.mockRejectedValueOnce(new EdgarError("SEC rejected the request with 403.", "u", 403));
    const res = await fetchIndexDay("2026-08-30");
    expect(res.ok).toBe(true);
    expect(res.noSession).toBe(true);
    // Recorded, so the aggregate check can still tell a weekend from a fault.
    expect(res.refused).toBe(true);
    expect(res.note).toMatch(/no index published/);
  });

  it("treats a 404 the same way", async () => {
    edgarFetch.mockRejectedValueOnce(new EdgarError("SEC returned 404.", "u", 404));
    const res = await fetchIndexDay("2026-08-30");
    expect(res.ok).toBe(true);
    expect(res.noSession).toBe(true);
    expect(res.refused).toBe(false);
  });

  it("reports a genuine transport failure as a failure", async () => {
    edgarFetch.mockRejectedValueOnce(new Error("fetch failed (ECONNREFUSED)"));
    const res = await fetchIndexDay("2026-08-28");
    expect(res.ok).toBe(false);
    expect(res.noSession).toBe(false);
    expect(res.note).toMatch(/ECONNREFUSED/);
  });

  it("does not mistake a 500 for an absent day", async () => {
    edgarFetch.mockRejectedValueOnce(new EdgarError("SEC returned HTTP 500.", "u", 500));
    const res = await fetchIndexDay("2026-08-28");
    expect(res.ok).toBe(false);
    expect(res.noSession).toBe(false);
  });
});
