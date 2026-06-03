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

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
        <p className="mt-2 text-sm text-muted">
          {wheelTeams.length} teams · spin the wheel
        </p>
      </div>

      <TeamWheel teams={wheelTeams} />
    </div>
  );
}
