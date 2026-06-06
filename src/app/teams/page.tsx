import Link from "next/link";
import { getFranchiseSummaries } from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";
import TeamWheel, { type WheelTeam } from "@/components/TeamWheel";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const summaries = await getFranchiseSummaries();

  const wheelTeams: WheelTeam[] = summaries.map((f) => ({
    espnId: f.espnId,
    name: f.latestName.trim(),
    owner: f.owner,
    color: teamColor(f.espnId),
    art: teamArt(f.espnId),
    record: f.latest?.record ?? null,
    rank: f.latest?.rank ?? null,
    teamCount: f.latest?.teamCount ?? null,
    titles: f.titles,
    seasons: f.seasonsPlayed,
  }));

  return (
    <>
      {/* Desktop: the spinning wheel */}
      <div className="hidden md:block">
        <TeamWheel teams={wheelTeams} />
      </div>

      {/* Mobile: lightweight tappable list */}
      <div className="mx-auto max-w-2xl px-5 py-8 md:hidden">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Teams</h1>
        <p className="mb-5 text-sm text-muted">{wheelTeams.length} teams</p>
        <div className="grid gap-3">
          {wheelTeams.map((t) => (
            <Link
              key={t.espnId}
              href={`/teams/${t.espnId}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-surface p-4"
              style={{ borderColor: `${t.color}66` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-9 w-9 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.name}</div>
                  <div className="truncate text-xs text-muted">{t.owner}</div>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted">
                {t.titles > 0 && <div>🏆 {t.titles}</div>}
                {t.record && <div className="tabular-nums">{t.record}</div>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
