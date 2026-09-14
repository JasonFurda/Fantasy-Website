import { revalidateTag } from "next/cache";
import { secretMatches } from "@/lib/secret-auth";

/**
 * Cache-bust hook, called by the GitHub Actions sync once it has finished
 * writing the new ESPN data to Supabase.
 *
 * Every read in queries.ts is cached for an hour, but each query keeps its OWN
 * entry with its own expiry clock. After a sync those clocks are staggered, so
 * one component could render fresh scores (its entry had just expired) next to
 * another still serving a snapshot taken before the sync — e.g. the matchup
 * picker showing a live score the box score below it didn't have yet.
 * Dropping the whole "db" tag at the end of the sync puts every read back on
 * the same snapshot.
 *
 * Auth: `Authorization: Bearer $REVALIDATE_SECRET`. Fails closed when the env
 * var is missing, so a misconfigured deploy can't be flushed by anyone.
 */
export async function POST(request: Request) {
  const given = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!secretMatches(given, process.env.REVALIDATE_SECRET)) {
    return Response.json({ revalidated: false }, { status: 401 });
  }
  // expire: 0 — the data is already stale the moment the sync commits, and the
  // caller is an external system, so don't serve the old snapshot any longer.
  revalidateTag("db", { expire: 0 });
  return Response.json({ revalidated: true, now: Date.now() });
}
