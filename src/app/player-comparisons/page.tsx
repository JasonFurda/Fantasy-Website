import Link from "next/link";
import {
  getSeasons,
  getPlayerComparison,
  getDraftValue,
  getPlayerDetail,
  getAllPlayerNames,
} from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";
import PlayerDetailModal from "@/components/PlayerDetailModal";
import PlayerCompareModal from "@/components/PlayerCompareModal";
import PlayerCompareTable from "@/components/PlayerCompareTable";

export const dynamic = "force-dynamic";

const POSITIONS = [
  { key: "WR", pos: "WR", label: "WR" },
  { key: "RB", pos: "RB", label: "RB" },
  { key: "QB", pos: "QB", label: "QB" },
  { key: "TE", pos: "TE", label: "TE" },
  { key: "K", pos: "K", label: "K" },
  { key: "DST", pos: "D/ST", label: "D/ST" },
] as const;

export default async function PlayerComparisonsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    pos?: string;
    player?: string;
    pyear?: string;
    compare?: string;
    cyear?: string;
  }>;
}) {
  const seasons = await getSeasons();
  if (seasons.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16 text-muted">
        No seasons found yet.
      </main>
    );
  }

  const sp = await searchParams;
  const years = seasons.map((s) => s.year);
  const defaultYear = seasons.find((s) => s.current_week > 0)?.year ?? years[0];
  const year =
    sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : defaultYear;
  const isDraft = sp.pos === "draft";
  const posDef = POSITIONS.find((p) => p.key === sp.pos) ?? POSITIONS[0];
  const player = sp.player ?? null;

  const rows = isDraft ? [] : await getPlayerComparison(year, posDef.pos);
  const draftRows = isDraft ? await getDraftValue(year) : [];

  const detailYear =
    player && sp.pyear && years.includes(Number(sp.pyear))
      ? Number(sp.pyear)
      : year;
  const compareName = sp.compare ?? null;
  const cyear =
    compareName && sp.cyear && years.includes(Number(sp.cyear))
      ? Number(sp.cyear)
      : detailYear;

  const [detail, detailB, allPlayers] = await Promise.all([
    player ? getPlayerDetail(player, detailYear) : null,
    compareName ? getPlayerDetail(compareName, cyear) : null,
    player ? getAllPlayerNames() : Promise.resolve([]),
  ]);

  const posQ = isDraft ? "draft" : posDef.key;
  const base = `/player-comparisons?year=${year}&pos=${posQ}`;
  const closeHref = base;
  const encP = encodeURIComponent(player ?? "");
  const encC = encodeURIComponent(compareName ?? "");
  const playerYearHref = (y: number) => `${base}&player=${encP}&pyear=${y}`;
  // Single-card "Compare" picker → open the compare view with this player.
  const compareTemplate = `${base}&player=${encP}&pyear=${detailYear}&compare=__NAME__&cyear=${detailYear}`;
  // Season switchers inside the compare view keep the other side fixed.
  const aYearHref = (y: number) =>
    `${base}&player=${encP}&pyear=${y}&compare=${encC}&cyear=${cyear}`;
  const bYearHref = (y: number) =>
    `${base}&player=${encP}&pyear=${detailYear}&compare=${encC}&cyear=${y}`;

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Player Comparisons</h1>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/player-comparisons?year=${y}&pos=${posDef.key}`}
              className={tabCls(y === year)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {POSITIONS.map((p) => (
          <Link
            key={p.key}
            href={`/player-comparisons?year=${year}&pos=${p.key}`}
            className={tabCls(!isDraft && p.key === posDef.key)}
          >
            {p.label}
          </Link>
        ))}
        <Link
          href={`/player-comparisons?year=${year}&pos=draft`}
          className={tabCls(isDraft)}
        >
          Draft Value
        </Link>
      </nav>

      {!isDraft && (
        <>
          <PlayerCompareTable
            rows={rows}
            pos={posDef.pos}
            year={year}
            posKey={posDef.key}
          />
          {rows.length === 0 && (
            <p className="mt-4 text-sm text-muted">No players found.</p>
          )}
        </>
      )}

      {isDraft && (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            TE/RB/WR ranked by draft value = (total points)² × √(draft
            position). Higher means more production relative to how late they
            were drafted.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Player</th>
                  <th className="px-3 py-3 font-medium">Pos</th>
                  <th className="px-3 py-3 font-medium">Fantasy</th>
                  <th className="px-3 py-3 font-medium">Original Drafter</th>
                  <th className="px-3 py-3 text-right font-medium">Draft</th>
                  <th className="px-3 py-3 text-right font-medium">Round</th>
                  <th className="px-3 py-3 text-right font-medium">Pts</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((r, i) => (
                  <tr
                    key={r.name}
                    className="border-b border-border/60 last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      <Link
                        href={`/player-comparisons?year=${year}&pos=draft&player=${encodeURIComponent(r.name)}`}
                        scroll={false}
                        className="hover:text-accent hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted">{r.position}</td>
                    <td className="px-3 py-2">
                      {r.fantasyTeam ? (
                        <Link
                          href={`/teams/${r.fantasyTeam.espnId}`}
                          className="flex items-center gap-1.5 whitespace-nowrap hover:underline"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: teamColor(r.fantasyTeam.espnId),
                            }}
                          />
                          {r.fantasyTeam.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.originalDrafter ? (
                        <Link
                          href={`/teams/${r.originalDrafter.espnId}`}
                          className="flex items-center gap-1.5 whitespace-nowrap hover:underline"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: teamColor(
                                r.originalDrafter.espnId,
                              ),
                            }}
                          />
                          {r.originalDrafter.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.overall}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {r.round}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.totalPts.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {r.value.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {draftRows.length === 0 && (
            <p className="mt-4 text-sm text-muted">No draft data.</p>
          )}
        </>
      )}

      {detail && compareName && detailB ? (
        <PlayerCompareModal
          a={detail}
          b={detailB}
          closeHref={closeHref}
          aYearHref={aYearHref}
          bYearHref={bYearHref}
        />
      ) : detail ? (
        <PlayerDetailModal
          data={detail}
          closeHref={closeHref}
          yearHref={playerYearHref}
          compare={{ players: allPlayers, hrefTemplate: compareTemplate }}
        />
      ) : null}
    </main>
  );
}
