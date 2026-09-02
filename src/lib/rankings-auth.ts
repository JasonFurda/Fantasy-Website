import "server-only";
import { matchesSecret } from "@/lib/secret-link";

// The private submission interface is gated only by a secret path token
// (RANKINGS_SUBMIT_SECRET). See src/lib/secret-link.ts for the comparison.

export function isValidRankingToken(token: string | undefined | null): boolean {
  return matchesSecret(token, process.env.RANKINGS_SUBMIT_SECRET);
}
