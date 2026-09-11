import { getFranchiseSummaries } from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";
import TeamWheel, { type WheelTeam } from "@/components/TeamWheel";
import TeamList from "@/components/TeamList";

// Static + ISR: franchise data only changes when the daily ESPN sync runs, so
// Vercel's CDN serves this page without invoking a function at all. That's only
// possible because the "your team" highlight is read from the cookie in the
// browser (see useMyTeamEspnId) rather than with cookies() on the server.
export const revalidate = 3600;

export default async function TeamsPage() {
  const summaries = await getFranchiseSummaries();

  const wheelTeams: WheelTeam[] = summaries.map((f) => ({
    espnId: f.espnId,
    name: f.latestName.trim(),
    owner: f.owner,
    color: teamColor(f.espnId),
    art: teamArt(f.espnId),
    record: f.latest?.record ?? null,
    rank: f.latest?.rank ?? null,
    teamCount: f.latest?.teamCount ?? null,
    titles: f.titles,
    seasons: f.seasonsPlayed,
  }));

  return (
    <>
      {/* Desktop: the spinning wheel */}
      <div className="hidden md:block">
        <TeamWheel teams={wheelTeams} />
      </div>

      {/* Mobile: lightweight tappable list */}
      <TeamList teams={wheelTeams} />
    </>
  );
}
