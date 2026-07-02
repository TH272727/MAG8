import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "mag8_admin";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/**
 * Constant-time token check (sha256 digests equalize lengths).
 * No ADMIN_TOKEN set → open in development, closed in production.
 */
export function tokenMatches(provided: string | null | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

export function isAuthorized(req: NextRequest): boolean {
  return tokenMatches(req.headers.get("x-admin-token") ?? req.cookies.get(ADMIN_COOKIE)?.value ?? null);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN?.trim());
}
