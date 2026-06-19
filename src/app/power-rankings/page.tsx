import Link from "next/link";
import { getSeasons, getPowerRankings } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export const dynamic = "force-dynamic";

const MEDALS: Record<number, string> = {
  1: "#f5c518", // gold
  2: "#c4ccd4", // silver
  3: "#cd7f32", // bronze
};

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
  const defaultYear = seasons.find((s) => s.current_week > 0)?.year ?? years[0];
  const year =
    yearParam && years.includes(Number(yearParam))
      ? Number(yearParam)
      : defaultYear;

  const rows = await getPowerRankings(year);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Power Rankings</h1>
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
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 text-right font-medium">Last week</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.team.id}
                className="border-b border-border/60 last:border-0 hover:bg-surface-2"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums ${
                      MEDALS[r.rank]
                        ? "font-bold text-[#0b0f14] shadow"
                        : "text-muted"
                    }`}
                    style={
                      MEDALS[r.rank]
                        ? { backgroundColor: MEDALS[r.rank] }
                        : undefined
                    }
                  >
                    {r.rank}
                  </span>
                </td>
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
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.change == null ? (
                    <span className="text-muted">—</span>
                  ) : r.change > 0 ? (
                    <span className="text-accent">▲ {r.change}</span>
                  ) : r.change < 0 ? (
                    <span className="text-red-400">▼ {Math.abs(r.change)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
