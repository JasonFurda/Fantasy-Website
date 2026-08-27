import "server-only";
import { timingSafeEqual } from "node:crypto";

// The private submission interface is gated only by a secret path token
// (RANKINGS_SUBMIT_SECRET). The page and the server action both verify it, so a
// direct POST to the action can't bypass the page's 404. Keep the secret in env
// (the repo is public) — never hard-code it.

export function isValidRankingToken(token: string | undefined | null): boolean {
  const secret = process.env.RANKINGS_SUBMIT_SECRET;
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
