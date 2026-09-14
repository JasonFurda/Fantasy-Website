import "server-only";
import { timingSafeEqual } from "node:crypto";

// Shared constant-time comparison for the handful of env-var secrets that gate
// private endpoints (the rankings tool, the sync's cache-revalidate hook). The
// repo is public, so every secret lives in env — never hard-coded.

// Tolerate common paste artifacts in the env value (trailing newline/space, or
// the whole thing wrapped in quotes) so a stray character in the Vercel UI
// doesn't silently break the endpoint.
export function cleanSecret(v: string | undefined | null): string {
  let s = (v ?? "").trim();
  if (s.length >= 2 && /^(["']).*\1$/.test(s)) s = s.slice(1, -1).trim();
  return s;
}

export function secretMatches(
  given: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  const a = Buffer.from(cleanSecret(given));
  const b = Buffer.from(cleanSecret(expected));
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
