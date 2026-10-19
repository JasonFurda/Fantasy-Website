import Link from "next/link";
import type { Metadata } from "next";
import { getSeasons, getDefenseStats } from "@/lib/queries";
import DefenseStatsTable from "@/components/DefenseStatsTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Defense Stats · Chamoms Fantasy",
  description:
    "Fantasy points each NFL defense gives up per game to QBs, RBs, WRs, TEs and kickers.",
};

export default async function DefenseStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const seasons = await getSeasons();
  if (seasons.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-muted">
        No seasons found yet.
      </main>
    );
  }

  const sp = await searchParams;
  const years = seasons.map((s) => s.year);
  const defaultYear = seasons.find((s) => s.current_week > 1)?.year ?? years[0];
  const year =
    sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : defaultYear;
  const stats = await getDefenseStats(year);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Defense Stats</h1>
          {stats.weeks > 0 && (
            <p className="mt-1 text-sm text-muted">
              {year} · through {stats.weeks} finished week
              {stats.weeks === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/defense-stats?year=${y}`}
              prefetch={false}
              className={tabCls(y === year)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      {stats.defenses.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-sm text-muted">
          No finished weeks for {year} yet.
        </p>
      ) : (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Fantasy points per game each NFL defense gives up to every player at
            a position combined — rostered and waiver-wire players alike. Red
            gives up the most, green the least. Click a position to sort; hover
            a number for the season total.
          </p>
          <DefenseStatsTable stats={stats} />
        </>
      )}
    </main>
  );
}
