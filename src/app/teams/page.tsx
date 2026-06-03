import { getCurrentFranchises } from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";
import TeamWheel, { type WheelTeam } from "@/components/TeamWheel";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const franchises = await getCurrentFranchises();

  const wheelTeams: WheelTeam[] = franchises.map((t) => ({
    espnId: t.espn_id,
    name: t.name.trim(),
    owner: t.owner,
    color: teamColor(t.espn_id),
    art: teamArt(t.espn_id),
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
        <p className="mt-2 text-sm text-muted">
          {wheelTeams.length} teams · give the wheel a spin
        </p>
      </header>

      <TeamWheel teams={wheelTeams} />
    </main>
  );
}
