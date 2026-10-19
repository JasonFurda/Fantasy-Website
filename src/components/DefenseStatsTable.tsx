"use client";

import { useMemo, useState } from "react";
import type { DefenseStats } from "@/lib/queries";

/** Rank 1 gives up the most, which is bad for the defense: red at the generous
 *  end, green at the stingy end. */
function rankClass(rank: number, total: number): string {
  const pct = total > 1 ? (rank - 1) / (total - 1) : 0.5;
  if (pct <= 0.2) return "text-red-400 font-semibold";
  if (pct <= 0.4) return "text-orange-400";
  if (pct <= 0.6) return "text-foreground";
  if (pct <= 0.8) return "text-green-400/80";
  return "text-green-400 font-semibold";
}

export default function DefenseStatsTable({ stats }: { stats: DefenseStats }) {
  const { positions, defenses, leagueAvg } = stats;
  const [sortPos, setSortPos] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = [...defenses];
    if (sortPos)
      list.sort((a, b) => b.cells[sortPos].perGame - a.cells[sortPos].perGame);
    return list;
  }, [defenses, sortPos]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-2 sm:px-3 py-3 font-medium">
              <button
                type="button"
                onClick={() => setSortPos(null)}
                className={`transition-colors hover:text-foreground ${
                  sortPos === null ? "text-foreground" : ""
                }`}
              >
                Defense
              </button>
            </th>
            <th className="px-2 sm:px-3 py-3 text-right font-medium">G</th>
            {positions.map((pos) => (
              <th key={pos} className="px-2 sm:px-3 py-3 text-right font-medium">
                <button
                  type="button"
                  onClick={() => setSortPos(pos)}
                  className={`transition-colors hover:text-foreground ${
                    sortPos === pos ? "text-foreground" : ""
                  }`}
                  title={`Sort by points allowed to ${pos}`}
                >
                  {pos}
                  {sortPos === pos && <span className="ml-0.5">▾</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr
              key={d.defense}
              className="border-b border-border/60 last:border-0 hover:bg-surface-2"
            >
              <td className="px-2 sm:px-3 py-2 font-medium">{d.defense}</td>
              <td className="px-2 sm:px-3 py-2 text-right tabular-nums text-muted">
                {d.games}
              </td>
              {positions.map((pos) => {
                const c = d.cells[pos];
                return (
                  <td
                    key={pos}
                    className="px-2 sm:px-3 py-2 text-right tabular-nums"
                    title={`${c.total.toFixed(1)} total · rank ${c.rank} of ${defenses.length}`}
                  >
                    <span className={rankClass(c.rank, defenses.length)}>
                      {c.perGame.toFixed(1)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-border text-xs text-muted">
            <td className="px-2 sm:px-3 py-2 font-medium uppercase tracking-wide">
              League avg
            </td>
            <td />
            {positions.map((pos) => (
              <td key={pos} className="px-2 sm:px-3 py-2 text-right tabular-nums">
                {leagueAvg[pos] == null ? "—" : leagueAvg[pos].toFixed(1)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
