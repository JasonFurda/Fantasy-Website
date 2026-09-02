import "server-only";
import { timingSafeEqual } from "node:crypto";

// Shared plumbing for the site's "secret URL" tools (power-rankings entry,
// article submission). Each is gated only by a secret path token kept in env —
// the repo is public, so never hard-code one. Both the page and the server
// action verify it, so a direct POST to an action can't bypass the page's 404.

// Tolerate common paste artifacts in the env value (trailing newline/space, or
// the whole thing wrapped in quotes) so a stray character in the Vercel UI
// doesn't silently 404 the tool.
function clean(v: string | undefined | null): string {
  let s = (v ?? "").trim();
  if (s.length >= 2 && /^(["']).*\1$/.test(s)) s = s.slice(1, -1).trim();
  return s;
}

/** Constant-time compare of a URL token against a secret from env. */
export function matchesSecret(
  token: string | undefined | null,
  secret: string | undefined | null,
): boolean {
  const want = clean(secret);
  const given = clean(token);
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
