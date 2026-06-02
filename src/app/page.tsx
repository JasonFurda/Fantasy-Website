import { supabase } from "@/lib/supabase";

// Always fetch fresh from Supabase on each request for now.
export const dynamic = "force-dynamic";

type Team = { id: number; name: string; owner: string };
type Matchup = {
  year: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
};

type Standing = {
  team: Team;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
};

function buildStandings(teams: Team[], matchups: Matchup[]): Standing[] {
  const byId = new Map<number, Standing>();
  for (const team of teams) {
    byId.set(team.id, { team, wins: 0, losses: 0, ties: 0, pointsFor: 0 });
  }

  for (const m of matchups) {
    const home = byId.get(m.home_team_id);
    const away = byId.get(m.away_team_id);
    if (!home || !away) continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    // Skip unplayed matchups (both scores zero).
    if (hs === 0 && as === 0) continue;
    home.pointsFor += hs;
    away.pointsFor += as;
    if (hs > as) {
      home.wins++;
      away.losses++;
    } else if (as > hs) {
      away.wins++;
      home.losses++;
    } else {
      home.ties++;
      away.ties++;
    }
  }

  return [...byId.values()].sort(
    (a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor,
  );
}

export default async function Home() {
  const [{ data: seasons }, { data: teams }, { data: matchups }] =
    await Promise.all([
      supabase.from("seasons").select("year, current_week").order("year", { ascending: false }),
      supabase.from("teams").select("id, name, owner, year"),
      supabase
        .from("matchups")
        .select("year, home_team_id, away_team_id, home_score, away_score"),
    ]);

  const years = (seasons ?? []).map((s) => s.year as number);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Chamoms Fantasy Football
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Live from Supabase · {seasons?.length ?? 0} seasons ·{" "}
          {teams?.length ?? 0} teams · {matchups?.length ?? 0} matchups
        </p>
      </header>

      {years.map((year) => {
        const yearTeams = (teams ?? []).filter(
          (t) => (t as { year: number }).year === year,
        ) as Team[];
        const yearMatchups = (matchups ?? []).filter(
          (m) => m.year === year,
        ) as Matchup[];
        const standings = buildStandings(yearTeams, yearMatchups);

        return (
          <section key={year} className="mb-12">
            <h2 className="mb-3 text-xl font-semibold">{year} Standings</h2>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">Team</th>
                    <th className="px-4 py-2 font-medium">Owner</th>
                    <th className="px-4 py-2 font-medium text-right">Record</th>
                    <th className="px-4 py-2 font-medium text-right">
                      Points For
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr
                      key={s.team.id}
                      className={
                        i % 2 ? "bg-white dark:bg-black" : "bg-zinc-50 dark:bg-zinc-950"
                      }
                    >
                      <td className="px-4 py-2 font-medium">{s.team.name}</td>
                      <td className="px-4 py-2 text-zinc-500">{s.team.owner}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {s.wins}-{s.losses}
                        {s.ties ? `-${s.ties}` : ""}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {s.pointsFor.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </main>
  );
}
