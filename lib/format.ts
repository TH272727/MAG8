/** Tiny display formatters shared across pages. */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtMoney(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return "—";
  return `$${usd.toFixed(2)}`;
}

export function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function fmtDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "—";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}
