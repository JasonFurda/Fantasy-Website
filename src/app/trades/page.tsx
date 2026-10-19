import Link from "next/link";
import type { Metadata } from "next";
import {
  getSeasons,
  getTrades,
  type Trade,
  type TradeScore,
} from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trades · Chamoms Fantasy",
  description:
    "Every trade made in the league this season, and how much each one has helped or hurt the teams involved.",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const fmt = (n: number) => n.toFixed(1);
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
const netCls = (n: number) =>
  n > 0 ? "text-accent" : n < 0 ? "text-red-400" : "text-muted";

function TeamDot({ espnId }: { espnId: number }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: teamColor(espnId) }}
    />
  );
}

function weekSpan(t: Trade) {
  const last = t.firstWeek + t.weeksSince - 1;
  return t.weeksSince === 1 ? `Week ${t.firstWeek}` : `Weeks ${t.firstWeek}–${last}`;
}

function Verdict({ trade }: { trade: Trade }) {
  if (trade.weeksSince === 0)
    return <span className="text-muted">Too early to tell</span>;
  const best = [...trade.sides].sort((a, b) => b.net - a.net)[0];
  if (!best || best.net === 0) return <span className="text-muted">Even so far</span>;
  return (
    <span className="min-w-0 truncate normal-case">
      <span className="font-semibold text-foreground">{best.team.name}</span>{" "}
      <span className="text-accent">{signed(best.net)}</span>
    </span>
  );
}

function TradeCard({ trade, year }: { trade: Trade; year: number }) {
  const judged = trade.weeksSince > 0;
  return (
    <article className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2 text-xs uppercase tracking-wide text-muted">
        <span className="shrink-0">
          {formatDate(trade.tradedAt)}
          {trade.sides.length > 2 && ` · ${trade.sides.length}-team`}
          {judged && <span className="hidden sm:inline"> · {weekSpan(trade)}</span>}
        </span>
        <Verdict trade={trade} />
      </div>
      <div
        className={`grid gap-px bg-border/60 ${
          trade.sides.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        {trade.sides.map((side) => (
          <div key={side.team.espnId} className="flex flex-col bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/teams/${side.team.espnId}`}
                className="flex min-w-0 items-center gap-1.5 text-sm font-semibold hover:underline"
              >
                <TeamDot espnId={side.team.espnId} />
                <span className="truncate">{side.team.name}</span>
              </Link>
              {judged && (
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${netCls(side.net)}`}
                >
                  {signed(side.net)}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
              receives
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {side.receives.length === 0 && (
                <li className="text-sm text-muted">Nothing</li>
              )}
              {side.receives.map((p) => (
                <li key={p.name} className="flex items-baseline gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/player-comparisons?year=${year}&player=${encodeURIComponent(p.name)}`}
                      prefetch={false}
                      className="font-medium hover:text-accent hover:underline"
                    >
                      {p.name}
                    </Link>{" "}
                    <span className="whitespace-nowrap text-xs text-muted">
                      {[p.position, p.proTeam].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {judged && (
                    <div className="shrink-0 text-right tabular-nums">
                      <span className="font-semibold">{fmt(p.startedPts)}</span>
                      <span className="block text-[11px] text-muted">
                        {p.weeks === 0
                          ? "not rostered"
                          : `${fmt(p.totalPts)} total · ${p.weeks} wk`}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {judged && (
              <div className="mt-auto pt-3 text-xs text-muted">
                Got <span className="tabular-nums text-foreground">{fmt(side.gainedPts)}</span>{" "}
                started pts · gave up{" "}
                <span className="tabular-nums text-foreground">{fmt(side.gavePts)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

function Scoreboard({ rows }: { rows: TradeScore[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-semibold">Who&apos;s winning their trades</h2>
      <p className="mb-3 text-sm text-muted">
        Net starter points from every trade a team made this season.
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-border/60">
              <th className="px-4 py-2 font-medium">Team</th>
              <th className="px-2 py-2 text-right font-medium">Trades</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Got</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Gave</th>
              <th className="px-4 py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.espnId} className="border-b border-border/40 last:border-0">
                <td className="max-w-0 px-4 py-2">
                  <Link
                    href={`/teams/${r.team.espnId}`}
                    className="flex items-center gap-1.5 font-medium hover:underline"
                  >
                    <TeamDot espnId={r.team.espnId} />
                    <span className="truncate">{r.team.name}</span>
                  </Link>
                </td>
                <td className="w-14 px-2 py-2 text-right tabular-nums text-muted">
                  {r.trades}
                </td>
                <td className="hidden w-20 px-2 py-2 text-right tabular-nums sm:table-cell">
                  {fmt(r.gainedPts)}
                </td>
                <td className="hidden w-20 px-2 py-2 text-right tabular-nums sm:table-cell">
                  {fmt(r.gavePts)}
                </td>
                <td
                  className={`w-20 px-4 py-2 text-right font-bold tabular-nums ${netCls(r.net)}`}
                >
                  {signed(r.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
  const { trades, scoreboard } = await getTrades(year);
  const anyJudged = trades.some((t) => t.weeksSince > 0);

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
        <>
          {anyJudged && <Scoreboard rows={scoreboard} />}
          {anyJudged && (
            <p className="mb-4 text-sm text-muted">
              Each player shows the points he scored in his new team&apos;s
              starting lineup since the trade (finished weeks only, and only
              while that team rostered him), with his bench-included total
              underneath. A side&apos;s net is the starter points it got minus
              the starter points the players it gave up scored for their new
              teams.
            </p>
          )}
          <div className="flex flex-col gap-4">
            {trades.map((t) => (
              <TradeCard key={t.id} trade={t} year={year} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
