"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerCompRow } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

const n = (v: number, d = 0) => (v || 0).toFixed(d);
const ratio = (a: number, b: number, d = 1) =>
  b ? ((a || 0) / b).toFixed(d) : "—";
const pctRatio = (a: number, b: number) =>
  b ? `${(((a || 0) / b) * 100).toFixed(1)}%` : "—";
const rv = (a: number, b: number) => (b ? (a || 0) / b : 0); // numeric ratio for sorting

// A sortable stat column: `get` renders the cell, `sortVal` gives the number
// to sort by (so "77.7%" / "—" cells still sort correctly).
type Col = {
  label: string;
  get: (r: PlayerCompRow) => string;
  sortVal: (r: PlayerCompRow) => number;
};

const COMMON: Col[] = [
  { label: "G", get: (r) => (r.games ? String(r.games) : "—"), sortVal: (r) => r.games },
  { label: "Total", get: (r) => n(r.totalPts, 1), sortVal: (r) => r.totalPts },
  { label: "Avg", get: (r) => (r.games ? n(r.avgPts, 1) : "—"), sortVal: (r) => r.avgPts },
  {
    label: "Var",
    get: (r) => (r.fantasyTeam ? n(r.variance, 1) : "—"),
    sortVal: (r) => (r.fantasyTeam ? r.variance : -1),
  },
];

const EXTRA: Record<string, Col[]> = {
  WR: [
    { label: "Tgt", get: (r) => n(r.s.receivingTargets), sortVal: (r) => r.s.receivingTargets || 0 },
    { label: "Rec", get: (r) => n(r.s.receivingReceptions), sortVal: (r) => r.s.receivingReceptions || 0 },
    { label: "Catch%", get: (r) => pctRatio(r.s.receivingReceptions, r.s.receivingTargets), sortVal: (r) => rv(r.s.receivingReceptions, r.s.receivingTargets) },
    { label: "Yds", get: (r) => n(r.s.receivingYards), sortVal: (r) => r.s.receivingYards || 0 },
    { label: "YPR", get: (r) => ratio(r.s.receivingYards, r.s.receivingReceptions), sortVal: (r) => rv(r.s.receivingYards, r.s.receivingReceptions) },
    { label: "TD", get: (r) => n(r.s.receivingTouchdowns), sortVal: (r) => r.s.receivingTouchdowns || 0 },
    { label: "Fum", get: (r) => n(r.s.lostFumbles), sortVal: (r) => r.s.lostFumbles || 0 },
  ],
  TE: [
    { label: "Tgt", get: (r) => n(r.s.receivingTargets), sortVal: (r) => r.s.receivingTargets || 0 },
    { label: "Rec", get: (r) => n(r.s.receivingReceptions), sortVal: (r) => r.s.receivingReceptions || 0 },
    { label: "Catch%", get: (r) => pctRatio(r.s.receivingReceptions, r.s.receivingTargets), sortVal: (r) => rv(r.s.receivingReceptions, r.s.receivingTargets) },
    { label: "Yds", get: (r) => n(r.s.receivingYards), sortVal: (r) => r.s.receivingYards || 0 },
    { label: "YPR", get: (r) => ratio(r.s.receivingYards, r.s.receivingReceptions), sortVal: (r) => rv(r.s.receivingYards, r.s.receivingReceptions) },
    { label: "TD", get: (r) => n(r.s.receivingTouchdowns), sortVal: (r) => r.s.receivingTouchdowns || 0 },
  ],
  RB: [
    { label: "Att", get: (r) => n(r.s.rushingAttempts), sortVal: (r) => r.s.rushingAttempts || 0 },
    { label: "RuYds", get: (r) => n(r.s.rushingYards), sortVal: (r) => r.s.rushingYards || 0 },
    { label: "YPC", get: (r) => ratio(r.s.rushingYards, r.s.rushingAttempts), sortVal: (r) => rv(r.s.rushingYards, r.s.rushingAttempts) },
    { label: "RuTD", get: (r) => n(r.s.rushingTouchdowns), sortVal: (r) => r.s.rushingTouchdowns || 0 },
    { label: "Tgt", get: (r) => n(r.s.receivingTargets), sortVal: (r) => r.s.receivingTargets || 0 },
    { label: "Rec", get: (r) => n(r.s.receivingReceptions), sortVal: (r) => r.s.receivingReceptions || 0 },
    { label: "ReYds", get: (r) => n(r.s.receivingYards), sortVal: (r) => r.s.receivingYards || 0 },
    {
      label: "TotTD",
      get: (r) => n((r.s.rushingTouchdowns || 0) + (r.s.receivingTouchdowns || 0)),
      sortVal: (r) => (r.s.rushingTouchdowns || 0) + (r.s.receivingTouchdowns || 0),
    },
  ],
  QB: [
    { label: "PaYds", get: (r) => n(r.s.passingYards), sortVal: (r) => r.s.passingYards || 0 },
    { label: "PaTD", get: (r) => n(r.s.passingTouchdowns), sortVal: (r) => r.s.passingTouchdowns || 0 },
    { label: "INT", get: (r) => n(r.s.passingInterceptions), sortVal: (r) => r.s.passingInterceptions || 0 },
    { label: "Cmp%", get: (r) => pctRatio(r.s.passingCompletions, r.s.passingAttempts), sortVal: (r) => rv(r.s.passingCompletions, r.s.passingAttempts) },
    { label: "RuYds", get: (r) => n(r.s.rushingYards), sortVal: (r) => r.s.rushingYards || 0 },
    { label: "RuTD", get: (r) => n(r.s.rushingTouchdowns), sortVal: (r) => r.s.rushingTouchdowns || 0 },
  ],
  K: [
    { label: "FGM", get: (r) => n(r.s.madeFieldGoals), sortVal: (r) => r.s.madeFieldGoals || 0 },
    { label: "FGA", get: (r) => n(r.s.attemptedFieldGoals), sortVal: (r) => r.s.attemptedFieldGoals || 0 },
    { label: "FG%", get: (r) => pctRatio(r.s.madeFieldGoals, r.s.attemptedFieldGoals), sortVal: (r) => rv(r.s.madeFieldGoals, r.s.attemptedFieldGoals) },
    { label: "XPM", get: (r) => n(r.s.madeExtraPoints), sortVal: (r) => r.s.madeExtraPoints || 0 },
  ],
  "D/ST": [
    { label: "Sacks", get: (r) => n(r.s.defensiveSacks), sortVal: (r) => r.s.defensiveSacks || 0 },
    { label: "INT", get: (r) => n(r.s.defensiveInterceptions), sortVal: (r) => r.s.defensiveInterceptions || 0 },
    { label: "Def TD", get: (r) => n(r.s.defensiveTouchdowns), sortVal: (r) => r.s.defensiveTouchdowns || 0 },
    { label: "PA", get: (r) => n(r.s.defensivePointsAllowed), sortVal: (r) => r.s.defensivePointsAllowed || 0 },
  ],
};

export default function PlayerCompareTable({
  rows,
  pos,
  year,
  posKey,
}: {
  rows: PlayerCompRow[];
  pos: string;
  year: number;
  posKey: string;
}) {
  const cols = [...COMMON, ...(EXTRA[pos] ?? [])];
  const [sortKey, setSortKey] = useState("Total"); // "Player" or a stat label
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sortKey === "Player") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const col = cols.find((c) => c.label === sortKey);
      if (col) arr.sort((a, b) => col.sortVal(a) - col.sortVal(b));
    }
    if (dir === "desc") arr.reverse();
    return arr;
    // cols is derived from `pos`; safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, dir, pos]);

  const onSort = (label: string, numeric: boolean) => {
    if (sortKey === label) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(label);
      setDir(numeric ? "desc" : "asc");
    }
  };

  const arrow = (label: string) =>
    sortKey === label ? (dir === "desc" ? " ▾" : " ▴") : "";

  const sortableHead = (
    label: string,
    numeric: boolean,
    extra = "",
  ) => (
    <th className={`px-3 py-3 font-medium ${extra}`}>
      <button
        type="button"
        onClick={() => onSort(label, numeric)}
        className={`inline-flex items-center gap-0.5 transition-colors hover:text-foreground ${
          sortKey === label ? "text-foreground" : ""
        }`}
      >
        {label}
        <span className="tabular-nums">{arrow(label)}</span>
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-3 font-medium">#</th>
            {sortableHead("Player", false)}
            <th className="px-3 py-3 font-medium">Fantasy</th>
            <th className="px-3 py-3 font-medium">NFL</th>
            {cols.map((c) => sortableHead(c.label, true, "text-right"))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={r.name}
              className="border-b border-border/60 last:border-0 hover:bg-surface-2"
            >
              <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                <Link
                  href={`/player-comparisons?year=${year}&pos=${posKey}&player=${encodeURIComponent(r.name)}`}
                  scroll={false}
                  className="hover:text-accent hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                {r.fantasyTeam ? (
                  <Link
                    href={`/teams/${r.fantasyTeam.espnId}`}
                    className="flex items-center gap-1.5 whitespace-nowrap hover:underline"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: teamColor(r.fantasyTeam.espnId) }}
                    />
                    {r.fantasyTeam.name}
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted">{r.nflTeam}</td>
              {cols.map((c) => (
                <td
                  key={c.label}
                  className="px-3 py-2 text-right tabular-nums"
                >
                  {c.get(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
