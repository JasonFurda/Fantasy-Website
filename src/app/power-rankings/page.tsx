import Link from "next/link";
import {
  getSeasons,
  getPowerRankings,
  getPreseasonPowerRankings,
  getPositionStrength,
  POSITION_STRENGTH_DEFS,
} from "@/lib/queries";
import { getManualPowerRankings, getManualRankingHistory } from "@/lib/rankings";
import { teamColor } from "@/lib/teams-config";
import { getMyTeamEspnId } from "@/lib/my-team-server";
import RankingHistoryChart from "@/components/RankingHistoryChart";

export const dynamic = "force-dynamic";

const MEDALS: Record<number, string> = {
  1: "#f5c518", // gold
  2: "#c4ccd4", // silver
  3: "#cd7f32", // bronze
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums ${
        MEDALS[rank] ? "font-bold text-[#0b0f14] shadow" : "text-muted"
      }`}
      style={MEDALS[rank] ? { backgroundColor: MEDALS[rank] } : undefined}
    >
      {rank}
    </span>
  );
}

function TeamCell({ espnId, name }: { espnId: number; name: string }) {
  return (
    <Link
      href={`/teams/${espnId}`}
      className="flex items-center gap-2 font-medium hover:underline"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: teamColor(espnId) }}
      />
      {name}
    </Link>
  );
}

export default async function PowerRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; view?: string; pos?: string }>;
}) {
  const [seasons, myEspnId] = await Promise.all([
    getSeasons(),
    getMyTeamEspnId(),
  ]);
  if (seasons.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-muted">
        No seasons found yet.
      </main>
    );
  }

  const sp = await searchParams;
  const years = seasons.map((s) => s.year);
  const defaultYear = seasons.find((s) => s.current_week > 0)?.year ?? years[0];
  const year =
    sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : defaultYear;
  const view = sp.view === "positions" ? "positions" : "power";
  const posDef =
    POSITION_STRENGTH_DEFS.find((p) => p.key === sp.pos) ??
    POSITION_STRENGTH_DEFS[0];

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  // Keep the current view/position when switching seasons.
  const yearQ = (y: number) =>
    view === "positions"
      ? `/power-rankings?year=${y}&view=positions&pos=${posDef.key}`
      : `/power-rankings?year=${y}`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Power Rankings</h1>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link key={y} href={yearQ(y)} className={tabCls(y === year)}>
              {y}
            </Link>
          ))}
        </nav>
      </div>

      {/* View toggle */}
      <div className="mb-6 inline-flex gap-1 rounded-lg border border-border bg-surface p-1">
        <Link
          href={`/power-rankings?year=${year}`}
          className={tabCls(view === "power")}
        >
          Overall
        </Link>
        <Link
          href={`/power-rankings?year=${year}&view=positions&pos=${posDef.key}`}
          className={tabCls(view === "positions")}
        >
          Positional Strength
        </Link>
      </div>

      {view === "power" ? (
        <OverallRankings year={year} highlightEspnId={myEspnId} />
      ) : (
        <PositionRankings
          year={year}
          posKey={posDef.key}
          highlightEspnId={myEspnId}
        />
      )}
    </main>
  );
}

function RankingsTable({
  rows,
  highlightEspnId,
}: {
  rows: { rank: number; team: { id: number; espn_id: number; name: string }; change: number | null }[];
  highlightEspnId?: number | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 text-right font-medium">Last week</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.team.id}
              className={`border-b border-border/60 last:border-0 hover:bg-surface-2 ${
                highlightEspnId === r.team.espn_id ? "bg-accent/10" : ""
              }`}
            >
              <td className="px-4 py-3">
                <RankBadge rank={r.rank} />
              </td>
              <td className="px-4 py-3">
                <TeamCell espnId={r.team.espn_id} name={r.team.name.trim()} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.change == null || r.change === 0 ? (
                  <span className="text-muted">—</span>
                ) : r.change > 0 ? (
                  <span className="text-accent">▲ {r.change}</span>
                ) : (
                  <span className="text-red-400">▼ {Math.abs(r.change)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function OverallRankings({
  year,
  highlightEspnId,
}: {
  year: number;
  highlightEspnId?: number | null;
}) {
  // Manual weekly rankings take over once the season has any submissions.
  const manual = await getManualPowerRankings(year);
  if (manual) {
    const history = await getManualRankingHistory(year);
    return (
      <>
        <p className="mb-4 text-sm text-muted">
          Weekly power rankings — week of{" "}
          <span className="text-foreground">{manual.label}</span>.{" "}
          <span className="text-muted">
            “Last week” shows movement since the previous week.
          </span>
        </p>

        <RankingsTable rows={manual.rows} highlightEspnId={highlightEspnId} />

        {history.weeks.length >= 2 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Rank by week
            </h2>
            <RankingHistoryChart data={history} />
          </div>
        )}
      </>
    );
  }

  // Fallback until a ranking is submitted (and for past seasons): the computed
  // rankings, else the hand-entered preseason order.
  let rows = await getPowerRankings(year);
  let preseason = false;
  if (rows.length === 0) {
    const pre = await getPreseasonPowerRankings(year);
    if (pre.length > 0) {
      rows = pre;
      preseason = true;
    }
  }

  return (
    <>
      {preseason && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <span className="font-semibold text-accent">Preseason rankings.</span>{" "}
          <span className="text-muted">
            No games have been played yet — these are Jason&apos;s subjective
            opinion, not the algorithm. They&apos;ll switch to computed rankings
            once the season starts.
          </span>
        </div>
      )}

      <RankingsTable rows={rows} highlightEspnId={highlightEspnId} />
    </>
  );
}

async function PositionRankings({
  year,
  posKey,
  highlightEspnId,
}: {
  year: number;
  posKey: string;
  highlightEspnId?: number | null;
}) {
  const data = await getPositionStrength(year);
  const group =
    data.groups.find((g) => g.key === posKey) ?? data.groups[0] ?? null;

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <>
      {/* Position sub-tabs */}
      <nav className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {data.groups.map((g) => (
          <Link
            key={g.key}
            href={`/power-rankings?year=${year}&view=positions&pos=${g.key}`}
            className={tabCls(g.key === (group?.key ?? posKey))}
          >
            {g.label}
          </Link>
        ))}
      </nav>

      {group && (
        <>
          <p className="mb-4 text-sm text-muted">
            Teams ranked by their best {group.count} {group.label}
            {group.count > 1 ? "s" : ""} —{" "}
            {data.preseason ? "by projected points" : "by total points scored"}.
          </p>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {group.label} pts
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Top {group.label}
                    {group.count > 1 ? "s" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr
                    key={r.team.id}
                    className={`border-b border-border/60 last:border-0 hover:bg-surface-2 ${
                      highlightEspnId === r.team.espn_id ? "bg-accent/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <RankBadge rank={r.rank} />
                    </td>
                    <td className="px-4 py-3">
                      <TeamCell
                        espnId={r.team.espn_id}
                        name={r.team.name.trim()}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {r.score.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {r.players.length === 0 ? (
                          <span>—</span>
                        ) : (
                          r.players.map((p, i) => (
                            <span key={p.name}>
                              {p.name}{" "}
                              <span className="tabular-nums text-foreground/70">
                                {p.value.toFixed(1)}
                              </span>
                              {i < r.players.length - 1 && (
                                <span className="text-border"> ·</span>
                              )}
                            </span>
                          ))
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
