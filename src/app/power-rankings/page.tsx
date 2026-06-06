import Link from "next/link";
import { getSeasons, getPowerRankings } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export const dynamic = "force-dynamic";

export default async function PowerRankingsPage({
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
  const year =
    yearParam && years.includes(Number(yearParam)) ? Number(yearParam) : years[0];

  const rows = await getPowerRankings(year);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Power Rankings</h1>
          <p className="mt-1 text-sm text-muted">
            Last 3 games scored in full, plus ½ of the 4th &amp; 5th most recent.
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/power-rankings?year=${y}`}
              className={tabCls(y === year)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 text-right font-medium">Power</th>
              <th className="px-4 py-3 font-medium">Recent games (newest →)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.team.id}
                className="border-b border-border/60 last:border-0 hover:bg-surface-2"
              >
                <td className="px-4 py-3 text-muted tabular-nums">{r.rank}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/teams/${r.team.espn_id}`}
                    className="flex items-center gap-2 font-medium hover:underline"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: teamColor(r.team.espn_id) }}
                    />
                    {r.team.name.trim()}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-lg font-bold tabular-nums">
                  {r.power.toFixed(1)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {r.games.map((g) => (
                      <span
                        key={g.week}
                        title={`Week ${g.week}${g.weight < 1 ? " (½ weight)" : ""}`}
                        className={`rounded-md px-2 py-0.5 text-xs tabular-nums ${
                          g.weight < 1
                            ? "bg-surface-2 text-muted"
                            : "bg-surface-2 text-foreground"
                        }`}
                      >
                        {g.weight < 1 ? "½×" : ""}
                        {g.score.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
