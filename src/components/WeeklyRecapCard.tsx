import Link from "next/link";
import type { WeeklyRecap, WeeklyRecapAward } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

/** Headline number + a one-line explanation for each award. */
function describe(a: WeeklyRecapAward): { stat: string; tone: "good" | "bad"; detail: string } {
  const e = a.entry;
  const opp = e.opponent?.name.trim() ?? "their opponent";
  const vs = `${e.score.toFixed(1)} – ${e.oppScore.toFixed(1)} vs ${opp}`;
  const left = e.pointsLeft;
  const diff = e.score - e.projected;
  switch (a.key) {
    case "efficient":
      return {
        stat: `${e.pctOptimal.toFixed(1)}%`,
        tone: "good",
        detail:
          left < 0.05
            ? "Perfect lineup — nothing left on the bench"
            : `of optimal · ${left.toFixed(1)} pts left on the bench`,
      };
    case "inefficient":
      return {
        stat: `${e.pctOptimal.toFixed(1)}%`,
        tone: "bad",
        detail: `of optimal · ${left.toFixed(1)} pts left on the bench`,
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

/** "Last week" superlatives for the homepage. Renders nothing without a
 *  finished week to recap. */
export default function WeeklyRecapCard({
  recap,
  highlightEspnId,
}: {
  recap: WeeklyRecap | null;
  highlightEspnId?: number;
}) {
  if (!recap || recap.awards.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Weekly recap · {recap.year} week {recap.week}
          {recap.isPlayoff && " (playoffs)"}
        </h2>
        <Link
          href={`/matchups?year=${recap.year}&week=${recap.week}`}
          prefetch={false}
          className="text-xs text-accent hover:underline"
        >
          All matchups →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {recap.awards.map((a) => {
          const { stat, tone, detail } = describe(a);
          const color = teamColor(a.entry.team.espn_id);
          const mine = highlightEspnId === a.entry.team.espn_id;
          return (
            <Link
              key={a.key}
              href={`/matchups?year=${recap.year}&week=${recap.week}&m=${a.entry.matchupId}`}
              prefetch={false}
              className={`flex flex-col rounded-xl border bg-surface p-4 transition-colors hover:bg-surface-2 ${
                mine ? "border-accent" : "border-border hover:border-accent"
              }`}
              style={{ borderTopColor: color, borderTopWidth: 3 }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {a.label}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate font-semibold">
                  {a.entry.team.name.trim()}
                </span>
                {mine && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-background">
                    You
                  </span>
                )}
              </div>
              <div
                className={`mt-1 text-2xl font-black tabular-nums ${
                  tone === "good" ? "text-accent" : "text-red-400"
                }`}
              >
                {stat}
              </div>
              <div className="mt-auto pt-1 text-xs leading-snug text-muted">
                {detail}
                {a.others > 0 &&
                  ` · tied with ${a.others} other${a.others > 1 ? "s" : ""}`}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
