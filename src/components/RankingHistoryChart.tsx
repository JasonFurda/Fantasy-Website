"use client";

import { useMemo, useRef, useState } from "react";
import type { RankingHistory } from "@/lib/rankings";
import { teamColor } from "@/lib/teams-config";

// SVG user-space dimensions; the <svg> scales to fit its container width.
const VBW = 900;
const VBH = 460;
const PAD = { top: 18, right: 18, bottom: 34, left: 34 };
const PLOT_W = VBW - PAD.left - PAD.right;
const PLOT_H = VBH - PAD.top - PAD.bottom;

export default function RankingHistoryChart({ data }: { data: RankingHistory }) {
  const { weeks, series } = data;
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [focus, setFocus] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const n = series.length; // number of teams (ranks 1..n)
  const w = weeks.length;

  const x = (i: number) =>
    PAD.left + (w <= 1 ? PLOT_W / 2 : (i / (w - 1)) * PLOT_W);
  const y = (rank: number) =>
    PAD.top + (n <= 1 ? PLOT_H / 2 : ((rank - 1) / (n - 1)) * PLOT_H);

  const yTicks = useMemo(
    () => Array.from({ length: n }, (_, i) => i + 1),
    [n],
  );

  const visible = series.filter((s) => !hidden.has(s.team.espn_id));

  const linePath = (ranks: (number | null)[]) => {
    let started = false;
    let d = "";
    ranks.forEach((r, i) => {
      if (r == null) return;
      d += `${started ? "L" : "M"} ${x(i)} ${y(r)} `;
      started = true;
    });
    return d.trim();
  };

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ux = ((e.clientX - rect.left) / rect.width) * VBW;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < w; i++) {
      const d = Math.abs(x(i) - ux);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoverIdx(best);
  }

  const tipRows =
    hoverIdx == null
      ? []
      : visible
          .map((s) => ({ s, rank: s.ranks[hoverIdx] }))
          .filter((r) => r.rank != null)
          .sort((a, b) => (a.rank as number) - (b.rank as number));

  const toggle = (espnId: number) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(espnId)) next.delete(espnId);
      else next.add(espnId);
      return next;
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const off = hidden.has(s.team.espn_id);
          return (
            <button
              key={s.team.espn_id}
              onClick={() => toggle(s.team.espn_id)}
              onMouseEnter={() => setFocus(s.team.espn_id)}
              onMouseLeave={() => setFocus(null)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                off
                  ? "border-border bg-transparent text-muted opacity-50"
                  : "border-border bg-surface-2 text-foreground"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: off
                    ? "var(--muted)"
                    : teamColor(s.team.espn_id),
                }}
              />
              {s.team.name.trim()}
            </button>
          );
        })}
      </div>

      <div className="relative rounded-xl border border-border bg-surface p-2 sm:p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="w-full touch-none"
          style={{ height: "auto" }}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {/* Y gridlines + rank labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={PAD.left + PLOT_W}
                y2={y(t)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                fill="var(--muted)"
                fontSize={11}
              >
                {t}
              </text>
            </g>
          ))}

          {/* X labels (week dates) */}
          {weeks.map((wk, i) => (
            <text
              key={wk.weekStart}
              x={x(i)}
              y={PAD.top + PLOT_H + 20}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={11}
            >
              {wk.label}
            </text>
          ))}

          {/* Hover guideline */}
          {hoverIdx != null && (
            <line
              x1={x(hoverIdx)}
              y1={PAD.top}
              x2={x(hoverIdx)}
              y2={PAD.top + PLOT_H}
              stroke="var(--foreground)"
              strokeWidth={1}
              opacity={0.25}
            />
          )}

          {/* Lines + dots */}
          {visible.map((s) => {
            const color = teamColor(s.team.espn_id);
            const dim = focus != null && focus !== s.team.espn_id;
            const lit = focus === s.team.espn_id;
            const d = linePath(s.ranks);
            return (
              <g
                key={s.team.espn_id}
                opacity={dim ? 0.15 : 1}
                onMouseEnter={() => setFocus(s.team.espn_id)}
                onMouseLeave={() => setFocus(null)}
                style={{ transition: "opacity 0.15s" }}
              >
                {d && (
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={lit ? 3.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {s.ranks.map((r, i) =>
                  r == null ? null : (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(r)}
                      r={hoverIdx === i ? 4 : lit ? 3 : 2.5}
                      fill={color}
                    />
                  ),
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoverIdx != null && tipRows.length > 0 && (
          <div
            className="pointer-events-none absolute top-3 z-10 w-52 rounded-lg border border-border bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur"
            style={{
              left: `calc(${(x(hoverIdx) / VBW) * 100}% + ${
                x(hoverIdx) > VBW / 2 ? "-13.5rem" : "0.75rem"
              })`,
            }}
          >
            <div className="mb-1.5 font-semibold">
              Week of {weeks[hoverIdx]?.label}
            </div>
            <div className="space-y-1">
              {tipRows.map(({ s, rank }) => (
                <div
                  key={s.team.espn_id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="w-4 shrink-0 text-right tabular-nums text-muted">
                      {rank}
                    </span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: teamColor(s.team.espn_id) }}
                    />
                    <span className="truncate">{s.team.name.trim()}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Lower is better — rank 1 sits at the top. Click a team to toggle it,
        hover a name to highlight its line.
      </p>
    </div>
  );
}
