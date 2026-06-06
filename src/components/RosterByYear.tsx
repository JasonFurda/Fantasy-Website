"use client";

import { useState } from "react";
import type { FranchiseRoster } from "@/lib/queries";

export default function RosterByYear({
  byYear,
  color,
}: {
  byYear: FranchiseRoster["byYear"];
  color: string;
}) {
  const [year, setYear] = useState(byYear[0]?.year ?? 0);

  if (byYear.length === 0) {
    return <p className="text-sm text-muted">No roster data available.</p>;
  }

  const active = byYear.find((y) => y.year === year) ?? byYear[0];
  const ended = active.players.filter((p) => p.endedOnTeam);
  const former = active.players.filter((p) => !p.endedOnTeam);

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
              <td className="px-4 py-3 text-muted">{p.position}</td>
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
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight">Roster</h2>
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
