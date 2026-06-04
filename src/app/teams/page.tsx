import { getFranchiseSummaries } from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";
import TeamWheel, { type WheelTeam } from "@/components/TeamWheel";

export const dynamic = "force-dynamic";

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

  return <TeamWheel teams={wheelTeams} />;
}
