import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getSeasons,
  getPlayerComparison,
  getPlayerDetail,
  getAllPlayerNames,
} from "@/lib/queries";
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
  // Draft Value moved to the Draft Recap page — keep old links working.
  if (sp.pos === "draft") {
    const q = new URLSearchParams({ year: String(year), view: "value" });
    if (sp.player) q.set("player", sp.player);
    redirect(`/draft-recap?${q}`);
  }
  const posDef = POSITIONS.find((p) => p.key === sp.pos) ?? POSITIONS[0];
  const player = sp.player ?? null;

  const rows = await getPlayerComparison(year, posDef.pos);

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

  const base = `/player-comparisons?year=${year}&pos=${posDef.key}`;
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
    <main className="mx-auto max-w-[1800px] px-5 py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Player Comparisons</h1>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/player-comparisons?year=${y}&pos=${posDef.key}`}
              prefetch={false}
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
            prefetch={false}
            className={tabCls(p.key === posDef.key)}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <PlayerCompareTable
        rows={rows}
        pos={posDef.pos}
        year={year}
        posKey={posDef.key}
      />
      {rows.length === 0 && (
        <p className="mt-4 text-sm text-muted">No players found.</p>
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
