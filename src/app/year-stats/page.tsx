import Link from "next/link";
import { getSeasons, getYearStats, type GameRow } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "fraud", label: "Fraud Watch" },
  { key: "club200", label: "200 Club" },
  { key: "sub100", label: "Sub-100 Club" },
  { key: "mismanage", label: "Mismanagement" },
] as const;

function TeamCell({ team }: { team: { espn_id: number; name: string; owner: string } | null }) {
  if (!team) return <span>—</span>;
  return (
    <Link
      href={`/teams/${team.espn_id}`}
      className="flex items-center gap-2 hover:underline"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: teamColor(team.espn_id) }}
      />
      {team.name.trim()}
    </Link>
  );
}

function GameTable({ rows, year }: { rows: GameRow[]; year: number }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted">Nothing here for {year}.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 text-right font-medium">Score</th>
            <th className="px-4 py-3 text-right font-medium">Week</th>
            <th className="px-4 py-3 font-medium">Opponent</th>
            <th className="px-4 py-3 text-right font-medium">Opp</th>
            <th className="px-4 py-3 text-center font-medium">Result</th>
            <th className="px-4 py-3 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => (
            <tr
              key={`${g.matchupId}-${g.team?.id}`}
              className="border-b border-border/60 last:border-0"
            >
              <td className="px-4 py-3 text-muted tabular-nums">{i + 1}</td>
              <td className="px-4 py-3 font-medium">
                <TeamCell team={g.team} />
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">
                {g.score.toFixed(1)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">
                {g.week}
              </td>
              <td className="px-4 py-3 text-muted">
                <TeamCell team={g.opponent} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">
                {g.opponentScore.toFixed(1)}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={g.won ? "text-accent" : "text-red-400"}>
                  {g.won ? "W" : "L"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/matchups?year=${year}&week=${g.week}&m=${g.matchupId}`}
                  className="text-xs text-muted hover:text-foreground"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function YearStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; tab?: string }>;
}) {
  const seasons = await getSeasons();
  if (seasons.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-muted">
        No seasons found yet.
      </main>
    );
  }

  const sp = await searchParams;
  const years = seasons.map((s) => s.year);
  const year =
    sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : years[0];
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "fraud";

  const stats = await getYearStats(year);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Total Year Stats</h1>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/year-stats?year=${y}&tab=${tab}`}
              className={tabCls(y === year)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/year-stats?year=${year}&tab=${t.key}`}
            className={tabCls(t.key === tab)}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "fraud" && (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Teams ranked by fraud score — a good record built on low points
            scored and an easy schedule (low points against) means a higher
            score. Regular season only.
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 text-right font-medium">Record</th>
                  <th className="px-4 py-3 text-right font-medium">PF</th>
                  <th className="px-4 py-3 text-right font-medium">PA</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Fraud Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.fraud.map((f, i) => (
                  <tr
                    key={f.team.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      <TeamCell team={f.team} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {f.record}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {f.pointsFor.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {f.pointsAgainst.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {f.fraudScore.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "club200" && (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Single-week team scores of 200 or more.
          </p>
          <GameTable rows={stats.club200} year={year} />
        </>
      )}

      {tab === "sub100" && (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Single-week team scores under 100 — the games to forget.
          </p>
          <GameTable rows={stats.subClub} year={year} />
        </>
      )}

      {tab === "mismanage" && (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Teams ranked by percentage of optimal points scored — how well they
            set their lineups. Lower means more points left on the bench. Worst
            first.
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 text-right font-medium">% Optimal</th>
                  <th className="px-4 py-3 text-right font-medium">Max</th>
                  <th className="px-4 py-3 text-right font-medium">Actual</th>
                  <th className="px-4 py-3 text-right font-medium">Left</th>
                  <th className="px-4 py-3 text-right font-medium">Avg/wk</th>
                  <th className="px-4 py-3 text-right font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {stats.mismanage.map((m, i) => (
                  <tr
                    key={m.team.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">
                      <TeamCell team={m.team} />
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {m.pctOptimal.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {m.maxPoints.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.actualPoints.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-400">
                      {m.pointsLeft.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {m.avgPerWeek.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {m.record}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
