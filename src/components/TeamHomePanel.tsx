import Link from "next/link";
import type {
  TeamHome,
  UpcomingMatch,
  DivisionStandings,
} from "@/lib/queries";
import type { Article } from "@/lib/articles";
import { teamColor } from "@/lib/teams-config";
import { homepageConfig } from "@/lib/homepage-config";
import ChangeTeamButton from "@/components/ChangeTeamButton";
import ArtSpotlight from "@/components/ArtSpotlight";
import StandingsTable from "@/components/StandingsTable";
import ArticlesCard from "@/components/ArticlesCard";

function MatchRow({ m, year }: { m: UpcomingMatch; year: number }) {
  const oppEspn = m.opponent?.espn_id ?? 0;
  return (
    <Link
      href={`/matchups?year=${year}&week=${m.week}&m=${m.matchupId}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent hover:bg-surface-2"
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Week {m.week}
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted">{m.isHome ? "vs" : "@"}</span>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: teamColor(oppEspn) }}
          />
          <span className="truncate">{m.opponent?.name.trim() ?? "—"}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {m.played ? (
          <div className="tabular-nums text-sm font-semibold">
            {m.teamScore.toFixed(1)}
            <span className="text-muted"> – {m.oppScore.toFixed(1)}</span>
          </div>
        ) : m.teamProjected != null && m.teamProjected > 0 ? (
          <div className="text-xs tabular-nums text-muted">
            proj {m.teamProjected.toFixed(1)} – {(m.oppProjected ?? 0).toFixed(1)}
          </div>
        ) : (
          <div className="text-xs text-muted">upcoming</div>
        )}
      </div>
    </Link>
  );
}

export default function TeamHomePanel({
  home,
  divisions,
  articles,
}: {
  home: TeamHome;
  divisions: DivisionStandings[];
  articles: Article[];
}) {
  const color = teamColor(home.team.espn_id);
  const { recap } = homepageConfig;

  return (
    <main className="mx-auto max-w-[1800px] px-8 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">
              Your team · {home.year}
            </div>
            <h1
              className="text-2xl font-black tracking-tight"
              style={{ color }}
            >
              {home.team.name.trim()}
            </h1>
            <div className="text-sm text-muted">
              {home.team.owner}
              {" · "}
              {home.record}
              {home.rank != null && ` · #${home.rank} of ${home.teamCount}`}
            </div>
          </div>
        </div>
        <ChangeTeamButton
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-stretch">
        {/* League art */}
        <ArtSpotlight art={recap.art} rotationMs={recap.artRotationMs} />

        <div className="flex flex-col gap-6">
          {/* Upcoming */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Upcoming
            </h2>
            <div className="flex flex-col gap-2">
              {home.upcoming.length > 0 ? (
                home.upcoming.map((m) => (
                  <MatchRow key={m.matchupId} m={m} year={home.year} />
                ))
              ) : home.lastResult ? (
                <>
                  <p className="text-sm text-muted">
                    No upcoming games — here&apos;s the latest result:
                  </p>
                  <MatchRow m={home.lastResult} year={home.year} />
                </>
              ) : (
                <p className="rounded-lg border border-border bg-surface px-3 py-4 text-sm text-muted">
                  Schedule isn&apos;t out yet.
                </p>
              )}
            </div>
          </section>

          {/* Articles */}
          <ArticlesCard
            articles={articles}
            variant="list"
            className="flex-1"
          />
        </div>
      </div>

      {/* Standings by division */}
      {divisions.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Standings
            </h2>
            <Link
              href="/standings"
              className="text-xs text-accent hover:underline"
            >
              Full standings →
            </Link>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            {divisions.map((d) => (
              <section key={d.name}>
                <h3 className="mb-2 text-base font-semibold">{d.name}</h3>
                <StandingsTable
                  standings={d.standings}
                  highlightEspnId={home.team.espn_id}
                />
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
