import Link from "next/link";
import { getSeasons, getTeams, getMatchups, buildStandings } from "@/lib/queries";
import StandingsTable from "@/components/StandingsTable";

export const dynamic = "force-dynamic";

export default async function StandingsPage({
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
                href={`/standings?year=${y}`}
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

      <StandingsTable standings={standings} />
    </main>
  );
}
