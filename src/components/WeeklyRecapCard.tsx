import Link from "next/link";
import type { WeeklyRecap, RecapTeamWeek } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export function recapHref(r: { year: number; week: number }): string {
  return `/recap?year=${r.year}&week=${r.week}`;
}

/** Headline number + a one-line explanation of one team's week, as measured
 *  by the award `key`. */
export function describeAward(
  key: string,
  e: RecapTeamWeek,
): {
  stat: string;
  tone: "good" | "bad";
  detail: string;
} {
  const opp = e.opponent?.name.trim() ?? "their opponent";
  const vs = `${e.score.toFixed(1)} – ${e.oppScore.toFixed(1)} vs ${opp}`;
  const diff = e.score - e.projected;
  switch (key) {
    case "efficient":
      return {
        stat: `${e.pctOptimal.toFixed(1)}%`,
        tone: "good",
        detail:
          e.pointsLeft < 0.05
            ? "Perfect lineup — nothing left on the bench"
            : `of optimal · ${e.pointsLeft.toFixed(1)} pts left on the bench`,
      };
    case "inefficient":
      return {
        stat: `${e.pctOptimal.toFixed(1)}%`,
        tone: "bad",
        detail: `of optimal · ${e.pointsLeft.toFixed(1)} pts left on the bench`,
      };
    case "fraudWin":
      return { stat: e.score.toFixed(1), tone: "bad", detail: `Won ${vs}` };
    case "goodLoss":
      return { stat: e.score.toFixed(1), tone: "good", detail: `Lost ${vs}` };
    default: // over / under
      return {
        stat: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`,
        tone: diff >= 0 ? "good" : "bad",
        detail: `${e.score.toFixed(1)} scored vs ${e.projected.toFixed(1)} projected`,
      };
  }
}

/** Homepage teaser: who won each award last week, clicking through to the
 *  full recap. Renders nothing without a finished week. */
export default function WeeklyRecapCard({
  recap,
  highlightEspnId,
}: {
  recap: WeeklyRecap | null;
  highlightEspnId?: number;
}) {
  if (!recap || recap.awards.length === 0) return null;

  return (
    <Link
      href={recapHref(recap)}
      prefetch={false}
      className="group mt-10 block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent hover:bg-surface-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">
            Weekly recap
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {recap.year} Week {recap.week}
            {recap.isPlayoff && (
              <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wide text-accent">
                playoffs
              </span>
            )}
          </h2>
        </div>
        <span className="text-sm font-semibold text-accent group-hover:underline">
          Read the full recap →
        </span>
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {recap.awards.map((a) => (
          // Phones stack the label over the names; wider screens put them side
          // by side. Names wrap rather than truncate so they're always readable.
          <li
            key={a.key}
            className="flex min-w-0 flex-col gap-0.5 text-sm sm:flex-row sm:items-start sm:gap-2"
          >
            <span className="text-xs uppercase tracking-wide text-muted sm:w-40 sm:shrink-0 sm:pt-0.5">
              {a.label}
              {a.winners.length > 1 && " (tie)"}
            </span>
            <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5">
              {a.winners.map((w) => (
                <span key={w.team.id} className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-[0.4em] h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: teamColor(w.team.espn_id) }}
                  />
                  <span
                    className={`min-w-0 break-words font-medium ${
                      highlightEspnId === w.team.espn_id ? "text-accent" : ""
                    }`}
                  >
                    {w.team.name.trim()}
                  </span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
