import Link from "next/link";
import type { TeamHome, UpcomingMatch } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";
import ChangeTeamButton from "@/components/ChangeTeamButton";

const posKey = (p: string) => (p === "D/ST" ? "DST" : p);

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
        ) : m.teamProjected != null ? (
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

export default function TeamHomePanel({ home }: { home: TeamHome }) {
  const color = teamColor(home.team.espn_id);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
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

      <div className="mt-8 grid gap-6 md:grid-cols-2">
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

        {/* Best players */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Best players
            </h2>
            <span className="text-[11px] text-muted">
              {home.usesProjected ? "projected" : "points"}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {home.bestPlayers.length > 0 ? (
              home.bestPlayers.map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-0"
                >
                  <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/player-comparisons?year=${home.year}&pos=${posKey(
                        p.position,
                      )}&player=${encodeURIComponent(p.name)}`}
                      className="truncate text-sm font-medium hover:text-accent hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {p.position}
                      {p.proTeam ? ` · ${p.proTeam}` : ""}
                      {p.isBench ? " · bench" : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {home.usesProjected
                      ? (p.projected ?? 0).toFixed(1)
                      : p.points.toFixed(1)}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-muted">No roster data yet.</p>
            )}
          </div>
          <Link
            href={`/teams/${home.team.espn_id}`}
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            Full team page →
          </Link>
        </section>
      </div>

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap gap-2 text-sm">
        {[
          { href: "/standings", label: "Standings" },
          { href: `/matchups?year=${home.year}`, label: "Matchups" },
          { href: "/power-rankings", label: "Power Rankings" },
          { href: "/player-comparisons", label: "Players" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-md border border-border px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
