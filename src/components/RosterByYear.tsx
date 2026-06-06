"use client";

import { useState } from "react";
import type { FranchiseRoster } from "@/lib/queries";

const POS_ORDER: Record<string, number> = {
  QB: 0,
  RB: 1,
  WR: 2,
  TE: 3,
  K: 4,
  "D/ST": 5,
};

const POS_COLORS: Record<string, string> = {
  QB: "#f2576e", // red/pink
  RB: "#27c08a", // green
  WR: "#58a7ff", // blue
  TE: "#ffae58", // orange
  K: "#c067ff", // purple
  "D/ST": "#b9844f", // brown
};

type SortMode = "points" | "position";

export default function RosterByYear({
  byYear,
  color,
}: {
  byYear: FranchiseRoster["byYear"];
  color: string;
}) {
  const [year, setYear] = useState(byYear[0]?.year ?? 0);
  const [sort, setSort] = useState<SortMode>("points");

  if (byYear.length === 0) {
    return <p className="text-sm text-muted">No roster data available.</p>;
  }

  const active = byYear.find((y) => y.year === year) ?? byYear[0];

  const sortPlayers = (players: FranchiseRoster["byYear"][number]["players"]) =>
    [...players].sort((a, b) => {
      if (sort === "position") {
        const pa = POS_ORDER[a.position] ?? 99;
        const pb = POS_ORDER[b.position] ?? 99;
        if (pa !== pb) return pa - pb;
      }
      return b.points - a.points;
    });

  const ended = sortPlayers(active.players.filter((p) => p.endedOnTeam));
  const former = sortPlayers(active.players.filter((p) => !p.endedOnTeam));

  const table = (players: typeof active.players) => (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 font-medium">Pos</th>
            <th className="px-4 py-3 text-right font-medium">Weeks</th>
            <th className="px-4 py-3 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.name} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3">
                {p.position ? (
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `${POS_COLORS[p.position] ?? "#6b7280"}26`,
                      color: POS_COLORS[p.position] ?? "#9ca3af",
                    }}
                  >
                    {p.position}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">
                {p.weeks}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {p.points.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Roster</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {(["points", "position"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSort(m)}
                className="rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors"
                style={
                  sort === m
                    ? { backgroundColor: color, color: "#0b0f14" }
                    : undefined
                }
              >
                <span className={sort === m ? "" : "text-muted"}>{m}</span>
              </button>
            ))}
          </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {byYear.map((y) => {
            const isActive = y.year === active.year;
            return (
              <button
                key={y.year}
                onClick={() => setYear(y.year)}
                className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                style={
                  isActive
                    ? { backgroundColor: color, color: "#0b0f14" }
                    : undefined
                }
              >
                <span className={isActive ? "" : "text-muted"}>{y.year}</span>
              </button>
            );
          })}
        </nav>
        </div>
      </div>

      {table(ended)}

      {former.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Left during the season
          </h3>
          {table(former)}
        </div>
      )}
    </div>
  );
}
