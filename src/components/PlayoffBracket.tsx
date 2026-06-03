import type { BracketGame } from "@/lib/homepage-config";

function GameCard({ game, champion }: { game: BracketGame; champion: string }) {
  const rows: { name: string; score: number; won: boolean }[] = [
    { name: game.winner, score: game.winnerScore, won: true },
    { name: game.loser, score: game.loserScore, won: false },
  ];
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {game.round}
      </div>
      {rows.map((r) => {
        const isChamp = r.won && r.name === champion;
        return (
          <div
            key={r.name}
            className={`flex items-center justify-between px-3 py-2 text-sm ${
              r.won ? "font-semibold" : "text-muted"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {isChamp && <span aria-hidden>🏆</span>}
              {r.name}
            </span>
            <span className="tabular-nums">{r.score.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PlayoffBracket({
  bracket,
  champion,
}: {
  bracket: BracketGame[];
  champion: string;
}) {
  if (bracket.length === 0) return null;

  // Group games by round, preserving config order.
  const rounds: { round: string; games: BracketGame[] }[] = [];
  for (const game of bracket) {
    const last = rounds[rounds.length - 1];
    if (last && last.round === game.round) last.games.push(game);
    else rounds.push({ round: game.round, games: [game] });
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold tracking-tight">Playoff Bracket</h2>
      <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:items-center">
        {rounds.map((r, i) => (
          <div key={`${r.round}-${i}`} className="flex flex-col gap-4">
            {r.games.map((g, j) => (
              <GameCard key={`${g.winner}-${j}`} game={g} champion={champion} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
