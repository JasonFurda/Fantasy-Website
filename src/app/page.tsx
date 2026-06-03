import Link from "next/link";
import { homepageConfig } from "@/lib/homepage-config";
import { getTeams, getMatchups, buildStandings } from "@/lib/queries";
import ArtSpotlight from "@/components/ArtSpotlight";
import ChampionBanner from "@/components/ChampionBanner";
import PlayoffBracket from "@/components/PlayoffBracket";
import StandingsTable from "@/components/StandingsTable";

export const dynamic = "force-dynamic";

async function RecapHome() {
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

      <p className="mt-10 text-center text-sm text-muted">
        Looking for the full table?{" "}
        <Link href="/standings" className="text-accent hover:underline">
          View season standings →
        </Link>
      </p>
    </main>
  );
}

async function DivisionsHome() {
  const { divisions } = homepageConfig;
  const [teams, matchups] = await Promise.all([
    getTeams(divisions.seasonYear),
    getMatchups(divisions.seasonYear),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
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
    </main>
  );
}

export default async function Home() {
  return homepageConfig.mode === "divisions" ? (
    <DivisionsHome />
  ) : (
    <RecapHome />
  );
}
