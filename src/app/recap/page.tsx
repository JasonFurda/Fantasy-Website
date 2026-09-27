import Link from "next/link";
import {
  getSeasons,
  getWeeklyRecap,
  getWeeklyRecapFor,
  type RecapTeamWeek,
  type WeeklyRecapAward,
} from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";
import { getMyTeamEspnId } from "@/lib/my-team-server";
import { describeAward, recapHref } from "@/components/WeeklyRecapCard";

export const dynamic = "force-dynamic";

/** What each award measures, shown under its title. */
const BLURBS: Record<string, string> = {
  efficient: "Closest to their best possible lineup.",
  inefficient: "Most points left sitting on the bench, by share of their best lineup.",
  fraudWin: "Lowest score that still won.",
  goodLoss: "Highest score that still lost.",
  over: "Beat their pre-game projection by the most.",
  under: "Fell furthest short of their pre-game projection.",
};

function TeamName({
  team,
  mine,
  className = "",
}: {
  team: RecapTeamWeek["team"];
  mine: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/teams/${team.espn_id}`}
      prefetch={false}
      className={`flex min-w-0 items-start gap-2 hover:underline ${className}`}
    >
      <span
        className="mt-[0.4em] h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: teamColor(team.espn_id) }}
      />
      {/* Wrap long names instead of truncating — they're the point of the page. */}
      <span className={`min-w-0 break-words ${mine ? "text-accent" : ""}`}>
        {team.name.trim()}
      </span>
    </Link>
  );
}

function AwardCard({
  award,
  year,
  week,
  myEspnId,
}: {
  award: WeeklyRecapAward;
  year: number;
  week: number;
  myEspnId: number | null;
}) {
  const { winners } = award;
  const tie = winners.length > 1;
  // Winners share the same value (to the 0.1 shown), so one headline number.
  const { stat, tone } = describeAward(award.key, winners[0]);
  const colors = winners.map((w) => teamColor(w.team.espn_id));
  const strip =
    colors.length === 1 ? colors[0] : `linear-gradient(to right, ${colors.join(", ")})`;
  return (
    <section
      className="relative flex flex-col overflow-hidden rounded-2xl border border-border p-6"
      style={{
        background: `radial-gradient(circle at 100% 0%, ${colors[0]}1f, transparent 55%), var(--surface)`,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: strip }} />
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {award.label}
        {tie && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-foreground">
            {winners.length}-way tie
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted">{BLURBS[award.key]}</p>

      <div
        className={`mt-4 text-4xl font-black tabular-nums ${
          tone === "good" ? "text-accent" : "text-red-400"
        }`}
      >
        {stat}
      </div>

      <ul className={`mt-2 ${tie ? "space-y-3" : ""}`}>
        {winners.map((w) => (
          <li key={w.team.id}>
            <div className="flex items-start justify-between gap-3">
              <TeamName
                team={w.team}
                mine={myEspnId === w.team.espn_id}
                className={`font-black tracking-tight ${tie ? "text-xl" : "text-2xl"}`}
              />
              <Link
                href={`/matchups?year=${year}&week=${week}&m=${w.matchupId}`}
                prefetch={false}
                className="shrink-0 pt-1.5 text-xs font-medium text-accent hover:underline"
              >
                Matchup →
              </Link>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {describeAward(award.key, w).detail}
            </p>
          </li>
        ))}
      </ul>

      {award.runnersUp.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Next closest
          </div>
          <ol className="space-y-1">
            {award.runnersUp.map((r) => (
              <li key={r.team.id} className="flex items-start justify-between gap-3 text-sm">
                <TeamName team={r.team} mine={myEspnId === r.team.espn_id} />
                <span className="shrink-0 tabular-nums text-muted">
                  {describeAward(award.key, r).stat}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const [sp, seasons, myEspnId] = await Promise.all([
    searchParams,
    getSeasons(),
    getMyTeamEspnId(),
  ]);
  const year = Number(sp.year);
  const week = Number(sp.week);
  const recap =
    Number.isInteger(year) && Number.isInteger(week)
      ?((await getWeeklyRecapFor(year, week)) ?? (await getWeeklyRecap()))
      : await getWeeklyRecap();

  if (!recap) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-muted">
        No finished weeks to recap yet.
      </main>
    );
  }

  const idx = recap.finishedWeeks.indexOf(recap.week);
  const prev = idx > 0 ? recap.finishedWeeks[idx - 1] : null;
  const next = idx < recap.finishedWeeks.length - 1 ? recap.finishedWeeks[idx + 1] : null;
  // Seasons with at least one finished week (a season's live week never counts).
  const years = seasons
    .filter((s) => !s.is_active || s.current_week > 1)
    .map((s) => s.year);

  const pill = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-sm font-medium tabular-nums transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;
  const navBtn =
    "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">
            Weekly recap
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            {recap.year} Week {recap.week}
            {recap.isPlayoff && (
              <span className="ml-3 align-middle text-sm font-semibold uppercase tracking-wide text-accent">
                playoffs
              </span>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          {prev != null ? (
            <Link href={recapHref({ year: recap.year, week: prev })} prefetch={false} className={navBtn}>
              ← Week {prev}
            </Link>
          ) : null}
          {next != null ? (
            <Link href={recapHref({ year: recap.year, week: next })} prefetch={false} className={navBtn}>
              Week {next} →
            </Link>
          ) : null}
        </div>
      </div>

      <nav className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={y === recap.year ? recapHref(recap) : `/recap?year=${y}&week=1`}
              prefetch={false}
              className={pill(y === recap.year)}
            >
              {y}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {recap.finishedWeeks.map((w) => (
            <Link
              key={w}
              href={recapHref({ year: recap.year, week: w })}
              prefetch={false}
              className={pill(w === recap.week)}
            >
              {w}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {recap.awards.map((a) => (
          <AwardCard
            key={a.key}
            award={a}
            year={recap.year}
            week={recap.week}
            myEspnId={myEspnId}
          />
        ))}
      </div>

      <h2 className="mb-3 mt-12 text-sm font-semibold uppercase tracking-wide text-muted">
        Every team this week
      </h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 text-right font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 text-right font-medium">Projected</th>
              <th className="px-4 py-3 text-right font-medium">+/−</th>
              <th className="px-4 py-3 text-right font-medium">% Optimal</th>
              <th className="px-4 py-3 text-right font-medium">Bench pts left</th>
            </tr>
          </thead>
          <tbody>
            {recap.entries.map((e) => {
              const diff = e.score - e.projected;
              const mine = myEspnId === e.team.espn_id;
              return (
                <tr
                  key={e.team.id}
                  className={`border-b border-border/60 last:border-0 ${mine ? "bg-accent/10" : ""}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    <TeamName team={e.team} mine={mine} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {e.score.toFixed(1)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/matchups?year=${recap.year}&week=${recap.week}&m=${e.matchupId}`}
                      prefetch={false}
                      className="hover:underline"
                    >
                      <span
                        className={`font-semibold ${
                          e.won ? "text-accent" : e.tied ? "text-muted" : "text-red-400"
                        }`}
                      >
                        {e.won ? "W" : e.tied ? "T" : "L"}
                      </span>{" "}
                      <span className="text-muted">
                        vs {e.opponent?.name.trim() ?? "—"} ({e.oppScore.toFixed(1)})
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {e.projected > 0 ? e.projected.toFixed(1) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      e.projected <= 0 ? "text-muted" : diff >= 0 ? "text-accent" : "text-red-400"
                    }`}
                  >
                    {e.projected > 0 ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.pctOptimal.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {e.pointsLeft.toFixed(1)}
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
