"use client";

import { useMemo, useRef, useState } from "react";
import type { YearPerformance } from "@/lib/queries";

// SVG user-space dimensions; the <svg> scales to fit its container width.
const VBW = 900;
const VBH = 460;
const PAD = { top: 16, right: 18, bottom: 34, left: 44 };
const PLOT_W = VBW - PAD.left - PAD.right;
const PLOT_H = VBH - PAD.top - PAD.bottom;

function niceBounds(min: number, max: number): [number, number] {
  const lo = Math.floor(min / 10) * 10;
  const hi = Math.ceil(max / 10) * 10;
  return [lo, hi === lo ? lo + 10 : hi];
}

export default function PerformanceChart({ data }: { data: YearPerformance }) {
  const { weeks, playoffStartWeek, series } = data;

  // Which teams are currently shown. null hover = none highlighted.
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [focus, setFocus] = useState<number | null>(null); // espn_id hovered in legend/line
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const minWeek = weeks[0] ?? 1;
  const maxWeek = weeks[weeks.length - 1] ?? 1;
  const hasPlayoffs = maxWeek >= playoffStartWeek;

  const [yMin, yMax] = useMemo(() => {
    const vals: number[] = [];
    for (const s of series)
      if (!hidden.has(s.team.espn_id))
        for (const p of s.points) vals.push(p.score);
    if (vals.length === 0) return [0, 200];
    return niceBounds(Math.min(...vals), Math.max(...vals));
  }, [series, hidden]);

  const x = (week: number) =>
    PAD.left +
    (maxWeek === minWeek
      ? PLOT_W / 2
      : ((week - minWeek) / (maxWeek - minWeek)) * PLOT_W);
  const y = (score: number) =>
    PAD.top + (1 - (score - yMin) / (yMax - yMin)) * PLOT_H;

  // Y gridlines
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = (yMax - yMin) / 5;
    for (let v = yMin; v <= yMax + 0.001; v += step) ticks.push(Math.round(v));
    return ticks;
  }, [yMin, yMax]);

  // Split a team's points into a solid (regular) path and a dashed (playoff)
  // path, connecting the boundary so the line stays continuous.
  const paths = (pts: YearPerformance["series"][number]["points"]) => {
    const reg = pts.filter((p) => !p.isPlayoff);
    const post = pts.filter((p) => p.isPlayoff);
    const toPath = (arr: typeof pts) =>
      arr
        .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.week)} ${y(p.score)}`)
        .join(" ");
    const playoffArr =
      reg.length > 0 && post.length > 0 ? [reg[reg.length - 1], ...post] : post;
    return { regular: toPath(reg), playoff: toPath(playoffArr) };
  };

  const boundaryX = hasPlayoffs
    ? (x(playoffStartWeek - 1) + x(playoffStartWeek)) / 2
    : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ux = ((e.clientX - rect.left) / rect.width) * VBW;
    // nearest played week
    let best = weeks[0];
    let bestD = Infinity;
    for (const w of weeks) {
      const d = Math.abs(x(w) - ux);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    setHoverWeek(best);
  }

  const visible = series.filter((s) => !hidden.has(s.team.espn_id));

  // Tooltip rows for the hovered week
  const tipRows =
    hoverWeek == null
      ? []
      : visible
          .map((s) => {
            const p = s.points.find((pt) => pt.week === hoverWeek);
            return p ? { s, p } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b!.p.score - a!.p.score) as {
          s: (typeof series)[number];
          p: YearPerformance["series"][number]["points"][number];
        }[];

  const toggle = (espnId: number) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(espnId)) next.delete(espnId);
      else next.add(espnId);
      return next;
    });

  return (
    <div>
      {/* Legend */}
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
                style={{ backgroundColor: off ? "var(--muted)" : s.color }}
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
          onPointerLeave={() => setHoverWeek(null)}
        >
          {/* Playoff shading */}
          {boundaryX != null && (
            <>
              <rect
                x={boundaryX}
                y={PAD.top}
                width={PAD.left + PLOT_W - boundaryX}
                height={PLOT_H}
                fill="var(--accent)"
                opacity={0.06}
              />
              <line
                x1={boundaryX}
                y1={PAD.top}
                x2={boundaryX}
                y2={PAD.top + PLOT_H}
                stroke="var(--accent)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.5}
              />
              <text
                x={boundaryX + 6}
                y={PAD.top + 14}
                fill="var(--accent)"
                fontSize={12}
                fontWeight={600}
              >
                Playoffs
              </text>
            </>
          )}

          {/* Y gridlines + labels */}
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

          {/* X labels (week numbers) */}
          {weeks.map((w) => (
            <text
              key={w}
              x={x(w)}
              y={PAD.top + PLOT_H + 20}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={11}
            >
              {w}
            </text>
          ))}
          <text
            x={PAD.left + PLOT_W / 2}
            y={VBH - 2}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize={11}
          >
            Week
          </text>

          {/* Hover guideline */}
          {hoverWeek != null && (
            <line
              x1={x(hoverWeek)}
              y1={PAD.top}
              x2={x(hoverWeek)}
              y2={PAD.top + PLOT_H}
              stroke="var(--foreground)"
              strokeWidth={1}
              opacity={0.25}
            />
          )}

          {/* Lines */}
          {visible.map((s) => {
            const { regular, playoff } = paths(s.points);
            const dim = focus != null && focus !== s.team.espn_id;
            const lit = focus === s.team.espn_id;
            return (
              <g
                key={s.team.espn_id}
                opacity={dim ? 0.18 : 1}
                onMouseEnter={() => setFocus(s.team.espn_id)}
                onMouseLeave={() => setFocus(null)}
                style={{ transition: "opacity 0.15s" }}
              >
                {regular && (
                  <path
                    d={regular}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={lit ? 3.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {playoff && (
                  <path
                    d={playoff}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={lit ? 3.5 : 2}
                    strokeDasharray="6 5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {/* dots */}
                {s.points.map((p) => (
                  <circle
                    key={p.week}
                    cx={x(p.week)}
                    cy={y(p.score)}
                    r={hoverWeek === p.week ? 4 : lit ? 3 : 2}
                    fill={s.color}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoverWeek != null && tipRows.length > 0 && (
          <div
            className="pointer-events-none absolute top-3 z-10 w-52 rounded-lg border border-border bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur"
            style={{
              left: `calc(${(x(hoverWeek) / VBW) * 100}% + ${
                x(hoverWeek) > VBW / 2 ? "-13.5rem" : "0.75rem"
              })`,
            }}
          >
            <div className="mb-1.5 flex items-center justify-between font-semibold">
              <span>Week {hoverWeek}</span>
              {hoverWeek >= playoffStartWeek && (
                <span className="text-accent">Playoffs</span>
              )}
            </div>
            <div className="space-y-1">
              {tipRows.map(({ s, p }) => (
                <div
                  key={s.team.espn_id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate">{s.team.name.trim()}</span>
                  </span>
                  <span className="tabular-nums font-medium">
                    {p.score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Solid = regular season · dashed line over the shaded area = playoffs.
        Click a team to toggle it, hover a name to highlight its line.
      </p>
    </div>
  );
}
