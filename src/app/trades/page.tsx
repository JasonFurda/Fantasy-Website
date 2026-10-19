import Link from "next/link";
import type { Metadata } from "next";
import { getSeasons, getTrades, type Trade } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trades · Chamoms Fantasy",
  description: "Every trade made in the league this season.",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function TradeCard({ trade, year }: { trade: Trade; year: number }) {
  return (
    <article className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border/60 px-4 py-2 text-xs uppercase tracking-wide text-muted">
        {formatDate(trade.tradedAt)}
        {trade.sides.length > 2 && ` · ${trade.sides.length}-team trade`}
      </div>
      <div
        className={`grid gap-px bg-border/60 ${
          trade.sides.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        {trade.sides.map((side) => (
          <div key={side.team.espnId} className="bg-surface px-4 py-3">
            <Link
              href={`/teams/${side.team.espnId}`}
              className="flex items-center gap-1.5 text-sm font-semibold hover:underline"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: teamColor(side.team.espnId) }}
              />
              <span className="truncate">{side.team.name}</span>
            </Link>
            <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
              receives
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {side.receives.map((p) => (
                <li key={p.name} className="flex items-baseline gap-2 text-sm">
                  <Link
                    href={`/player-comparisons?year=${year}&player=${encodeURIComponent(p.name)}`}
                    prefetch={false}
                    className="font-medium hover:text-accent hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="text-xs text-muted">
                    {[p.position, p.proTeam].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}

export default async function TradesPage({
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
  const year =
    sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : years[0];
  const trades = await getTrades(year);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
          {trades.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              {year} · {trades.length} trade{trades.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/trades?year=${y}`}
              prefetch={false}
              className={tabCls(y === year)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      {trades.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-sm text-muted">
          {year === years[0]
            ? `No trades yet in ${year}.`
            : `No trade history for ${year} — ESPN only shares trades for the current season, and the site started recording them in 2026.`}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {trades.map((t) => (
            <TradeCard key={t.id} trade={t} year={year} />
          ))}
        </div>
      )}
    </main>
  );
}
