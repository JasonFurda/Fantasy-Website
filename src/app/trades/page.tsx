import Link from "next/link";
import type { Metadata } from "next";
import {
  getSeasons,
  getTrades,
  type Trade,
  type TradePlayer,
  type TradeScore,
} from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";
import TradesTabs from "@/components/TradesTabs";

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

const REPL_ORDER = ["QB", "RB", "WR", "TE", "K", "D/ST"];

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

/** Hover text: each start and what it was measured against. */
function startsDetail(p: TradePlayer): string | undefined {
  if (p.starts.length === 0) return undefined;
  return p.starts
    .map(
      (s) =>
        `Wk ${s.week}: ${fmt(s.pts)} vs ${s.vsName ?? "waiver level"} ${fmt(s.vsPts)} (${signed(round1(s.pts - s.vsPts))})`,
    )
    .join("\n");
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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
                <li
                  key={p.name}
                  className="flex items-baseline gap-2 text-sm"
                  title={startsDetail(p)}
                >
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
                    {judged && p.vs.length > 0 && (
                      <span className="block text-[11px] text-muted">
                        vs{" "}
                        {p.vs.map((v, i) => (
                          <span key={v.name ?? "waiver"}>
                            {i > 0 && ", "}
                            <span className={v.name ? "text-foreground/80" : ""}>
                              {v.name ?? "waiver level"}
                            </span>
                            {v.weeks > 1 && ` ×${v.weeks}`}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {judged && (
                    <div className="shrink-0 text-right tabular-nums">
                      <span className={`font-semibold ${netCls(p.value)}`}>
                        {signed(p.value)}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {p.weeks === 0
                          ? "not rostered"
                          : `${fmt(p.startedPts)} started${
                              p.totalPts > p.startedPts
                                ? ` · ${fmt(p.totalPts - p.startedPts)} bench`
                                : ""
                            } · ${p.weeks} wk`}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {judged && (
              <div className="mt-auto pt-3 text-xs text-muted">
                Got <span className="tabular-nums text-foreground">{signed(side.gainedPts)}</span>{" "}
                · gave up{" "}
                <span className="tabular-nums text-foreground">{signed(side.gavePts)}</span>{" "}
                · raw net{" "}
                <span className="tabular-nums text-foreground">{signed(side.rawNet)}</span>
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
        Net points over replacement from every trade a team made this season.
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-border/60">
              <th className="py-2 pl-3 pr-2 font-medium sm:px-4">Team</th>
              <th className="px-1 py-2 text-right font-medium sm:px-2">
                <span className="sm:hidden">#</span>
                <span className="hidden sm:inline">Trades</span>
              </th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Got</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Gave</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Raw</th>
              <th className="py-2 pl-2 pr-3 text-right font-medium sm:px-4">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.espnId} className="border-b border-border/40 last:border-0">
                <td className="max-w-0 py-2 pl-3 pr-2 sm:px-4">
                  <Link
                    href={`/teams/${r.team.espnId}`}
                    className="flex items-center gap-1.5 font-medium hover:underline"
                  >
                    <TeamDot espnId={r.team.espnId} />
                    <span className="truncate">{r.team.name}</span>
                  </Link>
                </td>
                <td className="w-8 px-1 py-2 text-right tabular-nums text-muted sm:w-14 sm:px-2">
                  {r.trades}
                </td>
                <td className="hidden w-20 px-2 py-2 text-right tabular-nums sm:table-cell">
                  {signed(r.gainedPts)}
                </td>
                <td className="hidden w-20 px-2 py-2 text-right tabular-nums sm:table-cell">
                  {signed(r.gavePts)}
                </td>
                <td className="hidden w-20 px-2 py-2 text-right tabular-nums text-muted sm:table-cell">
                  {signed(r.rawNet)}
                </td>
                <td
                  className={`w-16 py-2 pl-2 pr-3 text-right font-bold tabular-nums sm:w-20 sm:px-4 ${netCls(r.net)}`}
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
  const { trades, scoreboard, replacement } = await getTrades(year);
  const replRows = REPL_ORDER.filter((pos) => replacement[pos] != null);
  const anyJudged = trades.some((t) => t.weeksSince > 0);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <TradesTabs active="history" />
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
            <div className="mb-4 flex flex-col gap-2 text-sm text-muted">
              <p>
                Scores are <span className="text-foreground">points over
                replacement</span>: for every week a player started for his new
                team since the trade, his points minus what the team would have
                started instead — its best bench player who could fill that
                lineup spot that week (skipping anyone on bye, injured or
                inactive, and anyone who came over in the same trade). If there
                was no such backup, he&apos;s measured against a typical waiver
                pickup at his position. Bench weeks count zero. Only finished
                weeks count, and only while the team rostered him. Hover a
                player for his week-by-week breakdown. A side&apos;s net
                is the value it got minus the value the players it gave up
                produced for their new teams; &ldquo;raw&rdquo; is the same
                net in plain starter points.
              </p>
              {replRows.length > 0 && (
                <p className="text-xs">
                  Waiver level (avg points per game of the top 3 free
                  agents):{" "}
                  {replRows.map((pos, i) => (
                    <span key={pos} className="whitespace-nowrap">
                      {i > 0 && " · "}
                      {pos}{" "}
                      <span className="tabular-nums text-foreground">
                        {fmt(replacement[pos])}
                      </span>
                    </span>
                  ))}
                </p>
              )}
            </div>
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
