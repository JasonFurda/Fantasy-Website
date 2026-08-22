import Link from "next/link";
import { cookies } from "next/headers";
import { homepageConfig } from "@/lib/homepage-config";
import {
  getTeams,
  getMatchups,
  buildStandings,
  getCurrentFranchises,
  getTeamHome,
  getLatestPowerRankings,
  getDivisionStandings,
  type PowerRow,
} from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";
import { MY_TEAM_COOKIE } from "@/lib/my-team";
import ArtSpotlight from "@/components/ArtSpotlight";
import ChampionBanner from "@/components/ChampionBanner";
import PlayoffBracket from "@/components/PlayoffBracket";
import StandingsTable from "@/components/StandingsTable";
import PowerRankingsCard from "@/components/PowerRankingsCard";
import TeamPickerModal from "@/components/TeamPickerModal";
import TeamHomePanel from "@/components/TeamHomePanel";
import ChangeTeamButton from "@/components/ChangeTeamButton";

export const dynamic = "force-dynamic";

type Power = { year: number; rows: PowerRow[]; preseason: boolean };

function RecapHome({ power }: { power: Power }) {
  const { recap } = homepageConfig;
  return (
    <main className="mx-auto max-w-[1800px] px-8 py-12">
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-stretch">
        <ArtSpotlight art={recap.art} rotationMs={recap.artRotationMs} />

        <div className="flex flex-col gap-8">
          <ChampionBanner
            year={recap.seasonYear}
            teamName={recap.champion.teamName}
            owner={recap.champion.owner}
            blurb={recap.champion.blurb}
          />
          <PlayoffBracket
            bracket={recap.bracket}
            champion={recap.champion.teamName}
          />
        </div>
      </div>

      <div className="mt-10">
        <PowerRankingsCard
          year={power.year}
          rows={power.rows}
          preseason={power.preseason}
        />
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Looking for the full table?{" "}
        <Link href="/standings" className="text-accent hover:underline">
          View season standings →
        </Link>
      </p>
    </main>
  );
}

async function DivisionsHome({ power }: { power: Power }) {
  const { divisions } = homepageConfig;
  const [teams, matchups] = await Promise.all([
    getTeams(divisions.seasonYear),
    getMatchups(divisions.seasonYear),
  ]);

  return (
    <main className="mx-auto max-w-[1800px] px-8 py-12">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        {divisions.seasonYear} Standings
      </h1>
      <p className="mb-8 text-sm text-muted">League divisions</p>

      <div className="grid gap-8 lg:grid-cols-2">
        {divisions.divisions.map((div) => {
          const divTeams = teams.filter((t) =>
            div.teamNames.includes(t.name),
          );
          const standings = buildStandings(divTeams, matchups);
          return (
            <section key={div.name}>
              <h2 className="mb-3 text-lg font-semibold">{div.name}</h2>
              {standings.length > 0 ? (
                <StandingsTable standings={standings} />
              ) : (
                <p className="rounded-xl border border-border bg-surface px-4 py-6 text-sm text-muted">
                  No teams assigned to this division yet. Edit{" "}
                  <code className="text-foreground">homepage-config.ts</code>.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-10">
        <PowerRankingsCard
          year={power.year}
          rows={power.rows}
          preseason={power.preseason}
        />
      </div>
    </main>
  );
}

export default async function Home() {
  const store = await cookies();
  const raw = store.get(MY_TEAM_COOKIE)?.value ?? null;

  const franchises = await getCurrentFranchises();
  const pickerTeams = franchises.map((t) => ({
    espnId: t.espn_id,
    name: t.name.trim(),
    color: teamColor(t.espn_id),
  }));

  const chosen =
    raw && raw !== "none" && franchises.some((t) => t.espn_id === Number(raw))
      ? Number(raw)
      : null;

  const power = await getLatestPowerRankings();

  // A team is selected → personalized homepage.
  if (chosen != null) {
    const home = await getTeamHome(chosen);
    if (home) {
      const divisions = await getDivisionStandings(home.year);
      return (
        <TeamHomePanel home={home} power={power} divisions={divisions} />
      );
    }
  }

  const defaultHome =
    homepageConfig.mode === "divisions" ? (
      <DivisionsHome power={power} />
    ) : (
      <RecapHome power={power} />
    );

  // Explicitly browsing without a team → default homepage + a way to pick one.
  if (raw === "none") {
    return (
      <>
        <div className="mx-auto max-w-[1800px] px-8 pt-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
            <span className="text-muted">Browsing without a team.</span>
            <ChangeTeamButton
              label="Pick your team"
              className="rounded-md bg-accent px-3 py-1.5 font-medium text-background transition-opacity hover:opacity-90"
            />
          </div>
        </div>
        {defaultHome}
      </>
    );
  }

  // No choice yet → default homepage with the picker popup on top.
  return (
    <>
      {defaultHome}
      <TeamPickerModal teams={pickerTeams} />
    </>
  );
}
