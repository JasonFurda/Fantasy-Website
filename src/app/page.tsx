import Link from "next/link";
import {
  getSeasons,
  getTeams,
  getMatchups,
  buildStandings,
  winPct,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const seasons = await getSeasons();
  if (seasons.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-muted">
        No seasons found yet.
      </main>
    );
  }

  const { year: yearParam } = await searchParams;
  const years = seasons.map((s) => s.year);
  const selectedYear =
    yearParam && years.includes(Number(yearParam))
      ? Number(yearParam)
      : years[0];
  const season = seasons.find((s) => s.year === selectedYear)!;

  const [teams, matchups] = await Promise.all([
    getTeams(selectedYear),
    getMatchups(selectedYear),
  ]);
  const standings = buildStandings(teams, matchups);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Standings</h1>
          <p className="mt-1 text-sm text-muted">
            {selectedYear} season · {teams.length} teams · through week{" "}
            {season.current_week}
            {season.is_active && (
              <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                Active
              </span>
            )}
          </p>
        </div>

        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => {
            const active = y === selectedYear;
            return (
              <Link
                key={y}
                href={`/?year=${y}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent text-background"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {y}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 text-right font-medium">W-L</th>
              <th className="px-4 py-3 text-right font-medium">Win %</th>
              <th className="px-4 py-3 text-right font-medium">PF</th>
              <th className="px-4 py-3 text-right font-medium">PA</th>
              <th className="px-4 py-3 text-right font-medium">Diff</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const diff = s.pointsFor - s.pointsAgainst;
              return (
                <tr
                  key={s.team.id}
                  className="border-b border-border/60 last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-3 text-muted tabular-nums">
                    {s.rank}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.team.name}</div>
                    <div className="text-xs text-muted">{s.team.owner}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.wins}-{s.losses}
                    {s.ties ? `-${s.ties}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {winPct(s).toFixed(3).replace(/^0/, "")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.pointsFor.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {s.pointsAgainst.toFixed(1)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      diff > 0
                        ? "text-accent"
                        : diff < 0
                          ? "text-red-400"
                          : "text-muted"
                    }`}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
