import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidRankingToken } from "@/lib/rankings-auth";
import { currentRankingWeek } from "@/lib/ranking-week";
import {
  getActiveRankingSeason,
  getSubmissionForWeek,
  getLatestSubmission,
} from "@/lib/rankings";
import RankingEntryForm from "@/components/RankingEntryForm";

export const dynamic = "force-dynamic";

// Keep the private tool out of search engines even if the URL leaks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Submit Power Rankings",
};

/** Reorder `base` into a valid full permutation of the current team ids:
 *  keep known ids in their given order, drop unknown/dupes, append any missing. */
function normalizeOrder(base: number[], validIds: number[]): number[] {
  const valid = new Set(validIds);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of base) {
    if (valid.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of validIds) if (!seen.has(id)) out.push(id);
  return out;
}

export default async function RankingsEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidRankingToken(token)) notFound();

  const season = await getActiveRankingSeason();
  if (!season) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-muted">
        No active season is set up to rank yet.
      </main>
    );
  }

  const week = currentRankingWeek();
  const [thisWeek, latest] = await Promise.all([
    getSubmissionForWeek(season.year, week.weekStart),
    getLatestSubmission(season.year),
  ]);

  const teams = [...season.teams].sort((a, b) => a.name.localeCompare(b.name));
  const validIds = teams.map((t) => t.espn_id);
  // Default order: this week's saved order, else carry over the most recent
  // week, else alphabetical.
  const base = thisWeek?.rankings ?? latest?.rankings ?? validIds;
  const initialOrder = normalizeOrder(base, validIds);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        {season.year} Power Rankings
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Weekly power rankings entry. Only people with this link can submit.
      </p>

      <RankingEntryForm
        token={token}
        teams={teams.map((t) => ({ espnId: t.espn_id, name: t.name }))}
        initialOrder={initialOrder}
        windowLabel={week.label}
        closesLabel={week.closesLabel}
        alreadySubmitted={thisWeek !== null}
        lastUpdated={thisWeek?.updatedAt ?? null}
      />
    </main>
  );
}
