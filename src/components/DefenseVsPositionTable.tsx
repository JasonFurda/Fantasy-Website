"use client";

import { useMemo, useState } from "react";
import type { DefenseRatings } from "@/lib/queries";

/** Same scale as the Outlook grades: rank 1 allows the most, so low rank is a
 *  soft matchup for the offense and gets the warm colour. */
function rankClass(rank: number, total: number): string {
  const pct = total > 1 ? (rank - 1) / (total - 1) : 0.5;
  if (pct <= 0.25) return "text-accent font-semibold";
  if (pct <= 0.45) return "text-accent/80";
  if (pct <= 0.65) return "text-foreground";
  if (pct <= 0.85) return "text-orange-400";
  return "text-red-400";
}

export default function DefenseVsPositionTable({
  ratings,
}: {
  ratings: DefenseRatings;
}) {
  const { positions, defenses, table, leagueAvg } = ratings;
  const [sortPos, setSortPos] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = [...defenses];
    if (sortPos) {
      list.sort((a, b) => {
        const av = table[a]?.[sortPos]?.avgAllowed ?? -1;
        const bv = table[b]?.[sortPos]?.avgAllowed ?? -1;
        return bv - av;
      });
    } else {
      list.sort((a, b) => a.localeCompare(b));
    }
    return list;
  }, [defenses, table, sortPos]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-3 font-medium">
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
            {positions.map((pos) => (
              <th key={pos} className="px-3 py-3 text-right font-medium">
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
          {rows.map((def) => (
            <tr
              key={def}
              className="border-b border-border/60 last:border-0 hover:bg-surface-2"
            >
              <td className="px-3 py-2 font-medium">{def}</td>
              {positions.map((pos) => {
                const cell = table[def]?.[pos];
                return (
                  <td
                    key={pos}
                    className="px-3 py-2 text-right tabular-nums"
                    title={
                      cell
                        ? `${cell.avgAllowed.toFixed(1)} allowed per game · rank ${cell.rank} of ${defenses.length} · ${cell.samples} player-games`
                        : "no games recorded"
                    }
                  >
                    {cell ? (
                      <span
                        className={
                          cell.thin
                            ? "text-muted"
                            : rankClass(cell.rank, defenses.length)
                        }
                      >
                        {cell.avgAllowed.toFixed(1)}
                        {cell.thin && "*"}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-border text-xs text-muted">
            <td className="px-3 py-2 font-medium uppercase tracking-wide">
              League avg
            </td>
            {positions.map((pos) => (
              <td key={pos} className="px-3 py-2 text-right tabular-nums">
                {leagueAvg[pos] == null ? "—" : leagueAvg[pos].toFixed(1)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
