import "server-only";
import { timingSafeEqual } from "node:crypto";

// The private submission interface is gated only by a secret path token
// (RANKINGS_SUBMIT_SECRET). The page and the server action both verify it, so a
// direct POST to the action can't bypass the page's 404. Keep the secret in env
// (the repo is public) — never hard-code it.

// Tolerate common paste artifacts in the env value (trailing newline/space, or
// the whole thing wrapped in quotes) so a stray character in the Vercel UI
// doesn't silently 404 the tool.
function clean(v: string | undefined | null): string {
  let s = (v ?? "").trim();
  if (s.length >= 2 && /^(["']).*\1$/.test(s)) s = s.slice(1, -1).trim();
  return s;
}

export function isValidRankingToken(token: string | undefined | null): boolean {
  const secret = clean(process.env.RANKINGS_SUBMIT_SECRET);
  const given = clean(token);
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
