import "server-only";
import { matchesSecret } from "@/lib/secret-link";

// The article submission interface is gated only by a secret path token
// (ARTICLES_SUBMIT_SECRET). Unlike the rankings tool this link is meant to be
// shared with everyone in the league — it's a "anyone with the link can post"
// gate, not a per-person login. See src/lib/secret-link.ts.

export function isValidArticleToken(token: string | undefined | null): boolean {
  return matchesSecret(token, process.env.ARTICLES_SUBMIT_SECRET);
}
