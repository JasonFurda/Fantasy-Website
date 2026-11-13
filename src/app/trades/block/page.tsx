import Link from "next/link";
import type { Metadata } from "next";
import { getTradeBlock, type BlockPlayer, type BlockTeam } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";
import TradesTabs from "@/components/TradesTabs";

// Static and refreshed hourly; the daily sync also flushes it.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Trading Block · Chamoms Fantasy",
  description:
    "The players each team has put on the trading block on ESPN, and the ones they've marked untouchable.",
};

function TeamDot({ espnId }: { espnId: number }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: teamColor(espnId) }}
    />
  );
}

function PlayerRow({ p, year }: { p: BlockPlayer; year: number }) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
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
      <div className="shrink-0 text-right tabular-nums">
        <span className="font-semibold">{p.points.toFixed(1)}</span>
        <span className="text-xs text-muted"> pts</span>
        <span className="block text-[11px] text-muted">
          {p.games > 0 ? `${(p.points / p.games).toFixed(1)} per game` : "no games yet"}
        </span>
      </div>
    </li>
  );
}

function TeamCard({ team, year }: { team: BlockTeam; year: number }) {
  return (
    <article className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <Link
          href={`/teams/${team.espnId}`}
          className="flex min-w-0 items-center gap-1.5 text-sm font-semibold hover:underline"
        >
          <TeamDot espnId={team.espnId} />
          <span className="min-w-0 break-words">{team.name}</span>
        </Link>
        {team.onBlock.length > 0 && (
          <span className="shrink-0 text-xs text-muted">
            {team.onBlock.length} available
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4 py-3">
        {team.onBlock.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-accent">
              On the block
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {team.onBlock.map((p) => (
                <PlayerRow key={p.name} p={p} year={year} />
              ))}
            </ul>
          </div>
        )}
        {team.untouchable.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-red-400">
              Untouchable
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {team.untouchable.map((p) => (
                <PlayerRow key={p.name} p={p} year={year} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

export default async function TradeBlockPage() {
  const block = await getTradeBlock();
  const listed = (block?.teams ?? []).filter(
    (t) => t.onBlock.length + t.untouchable.length > 0,
  );
  const quiet = (block?.teams ?? []).filter(
    (t) => t.onBlock.length + t.untouchable.length === 0,
  );
  const available = listed.reduce((n, t) => n + t.onBlock.length, 0);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <TradesTabs active="block" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Trading Block</h1>
        <p className="mt-1 text-sm text-muted">
          Players each owner has marked on ESPN as available for trade, or as
          untouchable. Updated once a day.
        </p>
      </div>

      {!block || listed.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-sm text-muted">
          Nobody has put a player on the trading block yet.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {block.year} ·{" "}
            <span className="text-foreground">
              {available} player{available === 1 ? "" : "s"}
            </span>{" "}
            on the block across {listed.length} team{listed.length === 1 ? "" : "s"}
          </p>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            {listed.map((t) => (
              <TeamCard key={t.espnId} team={t} year={block.year} />
            ))}
          </div>
          {quiet.length > 0 && (
            <p className="mt-6 text-sm text-muted">
              Nothing listed:{" "}
              {quiet.map((t, i) => (
                <span key={t.espnId}>
                  {i > 0 && " · "}
                  <Link
                    href={`/teams/${t.espnId}`}
                    className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
                  >
                    <TeamDot espnId={t.espnId} />
                    {t.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </main>
  );
}
