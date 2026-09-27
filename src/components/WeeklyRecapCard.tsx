import Link from "next/link";
import type { WeeklyRecap, WeeklyRecapAward } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export function recapHref(r: { year: number; week: number }): string {
  return `/recap?year=${r.year}&week=${r.week}`;
}

/** Headline number + a one-line explanation for each award. */
export function describeAward(a: WeeklyRecapAward): {
  stat: string;
  tone: "good" | "bad";
  detail: string;
} {
  const e = a.entry;
  const opp = e.opponent?.name.trim() ?? "their opponent";
  const vs = `${e.score.toFixed(1)} – ${e.oppScore.toFixed(1)} vs ${opp}`;
  const diff = e.score - e.projected;
  switch (a.key) {
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
        {recap.awards.map((a) => {
          const mine = highlightEspnId === a.entry.team.espn_id;
          return (
            <li key={a.key} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted">
                {a.label}
              </span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: teamColor(a.entry.team.espn_id) }}
              />
              <span className={`truncate font-medium ${mine ? "text-accent" : ""}`}>
                {a.entry.team.name.trim()}
              </span>
            </li>
          );
        })}
      </ul>
    </Link>
  );
}
