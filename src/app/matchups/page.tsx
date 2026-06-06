import Link from "next/link";
import {
  getSeasons,
  getTeams,
  getMatchups,
  getMatchupDetail,
  type Team,
} from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";
import MatchupBoxScore from "@/components/MatchupBoxScore";
import MatchupClash from "@/components/MatchupClash";

export const dynamic = "force-dynamic";

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string; m?: string }>;
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

  const [matchups, teams] = await Promise.all([
    getMatchups(year),
    getTeams(year),
  ]);
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));

  const weeks = [...new Set(matchups.map((m) => m.week))].sort((a, b) => a - b);
  const week =
    sp.week && weeks.includes(Number(sp.week))
      ? Number(sp.week)
      : (weeks[weeks.length - 1] ?? 1); // default to the latest week

  const weekMatchups = matchups
    .filter((m) => m.week === week)
    .sort((a, b) => a.id - b.id);

  const selectedId =
    sp.m && weekMatchups.some((m) => m.id === Number(sp.m))
      ? Number(sp.m)
      : (weekMatchups[0]?.id ?? null);

  const detail = selectedId ? await getMatchupDetail(selectedId) : null;

  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Matchups</h1>

      {/* Year */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="w-14 text-xs uppercase tracking-wide text-muted">
          Season
        </span>
        <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link key={y} href={`/matchups?year=${y}`} className={tab(y === year)}>
              {y}
            </Link>
          ))}
        </nav>
      </div>

      {/* Week */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="w-14 text-xs uppercase tracking-wide text-muted">
          Week
        </span>
        <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {weeks.map((w) => (
            <Link
              key={w}
              href={`/matchups?year=${year}&week=${w}`}
              className={tab(w === week)}
            >
              {w}
            </Link>
          ))}
        </nav>
      </div>

      {/* Matchup picker */}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {weekMatchups.map((m) => {
          const away = teamById.get(m.away_team_id);
          const home = teamById.get(m.home_team_id);
          const active = m.id === selectedId;
          const aWin = (m.away_score ?? 0) > (m.home_score ?? 0);
          return (
            <Link
              key={m.id}
              href={`/matchups?year=${year}&week=${week}&m=${m.id}`}
              className={`rounded-xl border p-3 transition-colors ${
                active
                  ? "border-accent bg-surface-2"
                  : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: teamColor(away?.espn_id ?? 0) }}
                  />
                  <span className={aWin ? "font-semibold" : ""}>
                    {away?.name.trim() ?? "—"}
                  </span>
                </span>
                <span className="tabular-nums text-muted">
                  {(m.away_score ?? 0).toFixed(1)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: teamColor(home?.espn_id ?? 0) }}
                  />
                  <span className={!aWin ? "font-semibold" : ""}>
                    {home?.name.trim() ?? "—"}
                  </span>
                </span>
                <span className="tabular-nums text-muted">
                  {(m.home_score ?? 0).toFixed(1)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Box score */}
      <div className="relative mt-8">
        {detail ? (
          <>
            <MatchupBoxScore
              detail={detail}
              awayColor={teamColor(detail.awayTeam?.espn_id ?? 0)}
              homeColor={teamColor(detail.homeTeam?.espn_id ?? 0)}
            />
            <MatchupClash
              key={detail.id}
              awayArt={teamArt(detail.awayTeam?.espn_id ?? 0)}
              homeArt={teamArt(detail.homeTeam?.espn_id ?? 0)}
              awayColor={teamColor(detail.awayTeam?.espn_id ?? 0)}
              homeColor={teamColor(detail.homeTeam?.espn_id ?? 0)}
            />
          </>
        ) : (
          <p className="text-sm text-muted">No matchup selected.</p>
        )}
      </div>
    </main>
  );
}
