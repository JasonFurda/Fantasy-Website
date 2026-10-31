import Link from "next/link";
import type {
  TeamHome,
  UpcomingMatch,
  DivisionStandings,
  WeeklyRecap,
  TeamOutlook,
} from "@/lib/queries";
import { verdict, ordinal } from "@/lib/matchup-grade";
import type { Article } from "@/lib/articles";
import { teamColor } from "@/lib/teams-config";
import { homepageConfig } from "@/lib/homepage-config";
import ChangeTeamButton from "@/components/ChangeTeamButton";
import ArtSpotlight from "@/components/ArtSpotlight";
import DivisionStandingsPanel from "@/components/DivisionStandingsPanel";
import ArticlesCard from "@/components/ArticlesCard";
import WeeklyRecapCard from "@/components/WeeklyRecapCard";
import StatsChat from "@/components/StatsChat";

function MatchRow({ m, year }: { m: UpcomingMatch; year: number }) {
  const oppEspn = m.opponent?.espn_id ?? 0;
  return (
    <Link
      href={`/matchups?year=${year}&week=${m.week}&m=${m.matchupId}`}
      prefetch={false}
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
        {m.played || m.live ? (
          <div className="tabular-nums text-sm font-semibold">
            {m.teamScore.toFixed(1)}
            <span className="text-muted"> – {m.oppScore.toFixed(1)}</span>
            {/* Still scoring, so it's shown but doesn't count in the record. */}
            {m.live && (
              <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-accent">
                live
              </span>
            )}
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

function OutlookList({ outlook }: { outlook: TeamOutlook }) {
  const total = outlook.ratings?.defenses.length ?? 0;
  const stale =
    outlook.ratings != null && outlook.ratings.year !== outlook.year;
  return (
    <div className="rounded-lg border border-border bg-surface">
      <ul className="divide-y divide-border/60">
        {outlook.starters.map((p) => {
          const v = p.rating ? verdict(p.rating, total) : null;
          return (
            <li
              key={`${p.slot}-${p.playerName}`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm sm:gap-3"
            >
              <span className="w-9 shrink-0 text-[10px] uppercase tracking-wide text-muted">
                {p.slot === "RB/WR/TE" ? "Flex" : p.slot}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {p.playerName}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {p.opponent === "BYE"
                  ? "Bye"
                  : p.opponent
                    ? `vs ${p.opponent}`
                    : "—"}
              </span>
              <span className="w-14 shrink-0 text-right text-xs sm:w-20">
                {p.rating && v ? (
                  <span
                    className={`font-semibold ${p.rating.thin ? "text-muted" : v.cls}`}
                    title={`${p.rating.defense} allows the ${ordinal(p.rating.rank)}-most fantasy points to ${p.rating.position}`}
                  >
                    {v.label}
                    <span className="ml-1 hidden font-normal text-muted sm:inline">
                      #{p.rating.rank}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {stale && (
        <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted">
          Grades use {outlook.ratings!.year} defenses until {outlook.year} has
          more weeks in.
        </p>
      )}
    </div>
  );
}

export default function TeamHomePanel({
  home,
  outlook,
  divisions,
  articles,
  weekly,
}: {
  home: TeamHome;
  outlook: TeamOutlook | null;
  divisions: DivisionStandings[];
  articles: Article[];
  weekly: WeeklyRecap | null;
}) {
  const color = teamColor(home.team.espn_id);
  const { recap } = homepageConfig;
  // Same week the outlook grades: the next unplayed one, else the last result.
  const match = home.upcoming[0] ?? home.lastResult;

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
          {/* This week's outlook: the matchup, then each starter's NFL
              matchup graded against how that defense treats the position. */}
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Outlook
              </h2>
              {outlook && (
                <Link
                  href="/outlook"
                  prefetch={false}
                  className="text-xs text-accent hover:underline"
                >
                  Full outlook →
                </Link>
              )}
            </div>
            {match ? (
              <div className="flex flex-col gap-2">
                <MatchRow m={match} year={home.year} />
                {outlook && outlook.starters.length > 0 && (
                  <OutlookList outlook={outlook} />
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-surface px-3 py-4 text-sm text-muted">
                Schedule isn&apos;t out yet.
              </p>
            )}
          </section>

          {/* Articles */}
          <ArticlesCard
            articles={articles}
            variant="list"
            className="flex-1"
          />
        </div>
      </div>

      <div className="mt-10">
        <StatsChat />
      </div>

      <WeeklyRecapCard recap={weekly} highlightEspnId={home.team.espn_id} />

      {/* Standings by division */}
      <DivisionStandingsPanel
        divisions={divisions}
        highlightEspnId={home.team.espn_id}
      />
    </main>
  );
}
