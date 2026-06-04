import Link from "next/link";
import {
  getSeasons,
  getTeams,
  getMatchups,
  buildStandings,
  getAllTimeStandings,
} from "@/lib/queries";
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
  const isAllTime = yearParam === "all";
  const selectedYear =
    yearParam && years.includes(Number(yearParam))
      ? Number(yearParam)
      : years[0];

  let standings;
  let teamCount: number;
  let subtitle: string;

  if (isAllTime) {
    standings = await getAllTimeStandings();
    teamCount = standings.length;
    subtitle = `All-time · ${seasons.length} seasons · regular-season record`;
  } else {
    const season = seasons.find((s) => s.year === selectedYear)!;
    const [teams, matchups] = await Promise.all([
      getTeams(selectedYear),
      getMatchups(selectedYear),
    ]);
    standings = buildStandings(teams, matchups);
    teamCount = teams.length;
    subtitle = `${selectedYear} season · ${teams.length} teams · through week ${season.current_week}`;
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Standings</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>

        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/standings?year=${y}`}
              className={tabClass(!isAllTime && y === selectedYear)}
            >
              {y}
            </Link>
          ))}
          <Link href="/standings?year=all" className={tabClass(isAllTime)}>
            All-time
          </Link>
        </nav>
      </div>

      <StandingsTable standings={standings} />

      {isAllTime && (
        <p className="mt-3 text-xs text-muted">
          Combined regular-season records across all seasons, by franchise
          (using each team&apos;s most recent name). Excludes playoff games.
        </p>
      )}
    </main>
  );
}
