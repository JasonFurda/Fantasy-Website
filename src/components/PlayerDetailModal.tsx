import Link from "next/link";
import type { PlayerDetail, PlayerSeasonLine } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

const nf = (v: number, d = 0) => (v || 0).toFixed(d);
const ratio = (a: number, b: number, d = 1) => (b ? (a / b).toFixed(d) : "—");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "—");

type StatCol = { label: string; get: (s: PlayerSeasonLine) => string };

const STAT_COLS: Record<string, StatCol[]> = {
  QB: [
    { label: "Pa Yds", get: (r) => nf(r.s.passingYards) },
    { label: "Pa TD", get: (r) => nf(r.s.passingTouchdowns) },
    { label: "INT", get: (r) => nf(r.s.passingInterceptions) },
    { label: "Cmp%", get: (r) => pct(r.s.passingCompletions, r.s.passingAttempts) },
    { label: "Ru Yds", get: (r) => nf(r.s.rushingYards) },
    { label: "Ru TD", get: (r) => nf(r.s.rushingTouchdowns) },
  ],
  RB: [
    { label: "Att", get: (r) => nf(r.s.rushingAttempts) },
    { label: "Ru Yds", get: (r) => nf(r.s.rushingYards) },
    { label: "YPC", get: (r) => ratio(r.s.rushingYards, r.s.rushingAttempts) },
    { label: "Ru TD", get: (r) => nf(r.s.rushingTouchdowns) },
    { label: "Rec", get: (r) => nf(r.s.receivingReceptions) },
    { label: "Re Yds", get: (r) => nf(r.s.receivingYards) },
    {
      label: "Tot TD",
      get: (r) => nf((r.s.rushingTouchdowns || 0) + (r.s.receivingTouchdowns || 0)),
    },
  ],
  WR: [
    { label: "Tgt", get: (r) => nf(r.s.receivingTargets) },
    { label: "Rec", get: (r) => nf(r.s.receivingReceptions) },
    { label: "Catch%", get: (r) => pct(r.s.receivingReceptions, r.s.receivingTargets) },
    { label: "Yds", get: (r) => nf(r.s.receivingYards) },
    { label: "YPR", get: (r) => ratio(r.s.receivingYards, r.s.receivingReceptions) },
    { label: "TD", get: (r) => nf(r.s.receivingTouchdowns) },
  ],
  TE: [
    { label: "Tgt", get: (r) => nf(r.s.receivingTargets) },
    { label: "Rec", get: (r) => nf(r.s.receivingReceptions) },
    { label: "Catch%", get: (r) => pct(r.s.receivingReceptions, r.s.receivingTargets) },
    { label: "Yds", get: (r) => nf(r.s.receivingYards) },
    { label: "TD", get: (r) => nf(r.s.receivingTouchdowns) },
  ],
  K: [
    { label: "FGM", get: (r) => nf(r.s.madeFieldGoals) },
    { label: "FGA", get: (r) => nf(r.s.attemptedFieldGoals) },
    { label: "FG%", get: (r) => pct(r.s.madeFieldGoals, r.s.attemptedFieldGoals) },
    { label: "XPM", get: (r) => nf(r.s.madeExtraPoints) },
  ],
  "D/ST": [
    { label: "Sack", get: (r) => nf(r.s.defensiveSacks) },
    { label: "INT", get: (r) => nf(r.s.defensiveInterceptions) },
    { label: "Def TD", get: (r) => nf(r.s.defensiveTouchdowns) },
    { label: "Pts Ag", get: (r) => nf(r.s.defensivePointsAllowed) },
  ],
};

// SVG bar chart of weekly fantasy points, colored against the league-wide
// average for the player's position (a universal baseline), with 40+ point
// weeks flagged blue.
function WeeklyBars({
  weekly,
  posAvg,
  position,
}: {
  weekly: PlayerDetail["weekly"];
  posAvg: number;
  position: string;
}) {
  const N = Math.max(weekly.length, 1);
  const SLOT = 44;
  const BARW = 26;
  const TOP = 22;
  const PLOT = 150;
  const BOTTOM = 22;
  const W = N * SLOT;
  const H = TOP + PLOT + BOTTOM;
  const maxVal = Math.max(1, ...weekly.map((w) => w.points));

  // Fall back to the player's own average only if we have no position baseline.
  const played = weekly.filter((w) => !w.dnp);
  const base =
    posAvg > 0
      ? posAvg
      : played.length
        ? played.reduce((a, w) => a + w.points, 0) / played.length
        : 0;

  const color = (points: number, dnp: boolean) => {
    if (dnp) return "var(--muted)";
    if (points >= 40) return "hsl(200 85% 55%)"; // elite → blue
    if (points <= 0) return "hsl(0 72% 55%)";
    if (base <= 0) return "var(--accent)";
    if (points >= base * 1.25) return "var(--accent)"; // boom (green)
    if (points <= base * 0.75) return "hsl(0 72% 55%)"; // down (red)
    return "hsl(38 92% 55%)"; // steady (amber)
  };

  const avgY = base > 0 ? TOP + (1 - base / maxVal) * PLOT : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: "auto" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {avgY != null && (
        <>
          <line
            x1={0}
            y1={avgY}
            x2={W}
            y2={avgY}
            stroke="var(--foreground)"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.3}
          />
          <text x={2} y={avgY - 3} fill="var(--muted)" fontSize={9}>
            {position ? `${position} avg` : "avg"} {base.toFixed(1)}
          </text>
        </>
      )}
      {weekly.map((w, i) => {
        const cx = i * SLOT + SLOT / 2;
        const h = w.dnp ? 3 : Math.max(2, (Math.max(w.points, 0) / maxVal) * PLOT);
        const yTop = TOP + PLOT - h;
        return (
          <g key={w.week}>
            <rect
              x={cx - BARW / 2}
              y={yTop}
              width={BARW}
              height={h}
              rx={3}
              fill={color(w.points, w.dnp)}
              opacity={w.dnp ? 0.35 : 1}
            >
              <title>
                {w.dnp
                  ? `Week ${w.week}: did not play`
                  : `Week ${w.week}: ${w.points.toFixed(1)} pts${w.freeAgent ? " (free agent)" : ""}`}
              </title>
            </rect>
            <text
              x={cx}
              y={yTop - 4}
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize={9.5}
              opacity={w.dnp ? 0.4 : 0.85}
            >
              {w.dnp ? "—" : w.points.toFixed(0)}
            </text>
            <text
              x={cx}
              y={H - 7}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={10}
            >
              {w.week}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

export default function PlayerDetailModal({
  data,
  closeHref,
  yearHref,
}: {
  data: PlayerDetail;
  closeHref: string;
  yearHref?: (year: number) => string;
}) {
  const cols = STAT_COLS[data.position] ?? [];
  const cur = data.seasons.find((s) => s.year === data.year) ?? null;
  const totTgt = data.nflShare
    ? data.nflShare.mates.reduce((a, m) => a + m.targets, 0)
    : 0;
  const totPts = data.nflShare
    ? data.nflShare.mates.reduce((a, m) => a + m.points, 0)
    : 0;
  const showTgt = ["WR", "RB", "TE"].includes(data.position) && totTgt > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6">
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative z-10 mt-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface/95 p-4 backdrop-blur sm:p-5">
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight">{data.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {data.position && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-foreground">
                  {data.position}
                </span>
              )}
              {data.nflTeam && <span>{data.nflTeam}</span>}
              {data.fantasyTeam && (
                <Link
                  href={`/teams/${data.fantasyTeam.espnId}`}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: teamColor(data.fantasyTeam.espnId) }}
                  />
                  {data.fantasyTeam.name}
                </Link>
              )}
            </div>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Close"
            className="shrink-0 rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            ✕
          </Link>
        </div>

        <div className="space-y-6 p-4 sm:p-5">
          {/* Season summary chips */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <Chip label="Total" value={nf(cur?.totalPts ?? 0, 1)} />
            <Chip
              label="Avg/Wk"
              value={data.avg ? data.avg.toFixed(1) : "—"}
            />
            <Chip
              label="Best Wk"
              value={data.bestWeek ? data.bestWeek.points.toFixed(1) : "—"}
            />
            <Chip label="Games" value={cur?.games ? String(cur.games) : "—"} />
          </div>

          {/* Weekly performance */}
          <section>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Weekly Performance
              </h3>
              <span className="text-[11px] text-muted">fantasy points</span>
            </div>
            {yearHref && data.seasons.length > 0 && (
              <div className="mb-3 inline-flex gap-1 rounded-lg border border-border bg-surface p-1">
                {data.seasons.map((s) => (
                  <Link
                    key={s.year}
                    href={yearHref(s.year)}
                    scroll={false}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      s.year === data.year
                        ? "bg-accent text-background"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {s.year}
                  </Link>
                ))}
              </div>
            )}
            {data.weekly.length > 0 ? (
              <div className="rounded-xl border border-border bg-surface-2/40 p-2 sm:p-3">
                <WeeklyBars
                  weekly={data.weekly}
                  posAvg={data.positionAvg}
                  position={data.position}
                />
              </div>
            ) : (
              <p className="text-sm text-muted">No games this season.</p>
            )}
          </section>

          {/* Season-by-season stats */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Season Stats
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Year</th>
                    <th className="px-3 py-2 font-medium">Tm</th>
                    <th className="px-3 py-2 text-right font-medium">G</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Avg</th>
                    {cols.map((c) => (
                      <th key={c.label} className="px-3 py-2 text-right font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.seasons.map((s) => (
                    <tr
                      key={s.year}
                      className={`border-b border-border/50 last:border-0 ${
                        s.year === data.year ? "bg-surface-2/60" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-medium tabular-nums">{s.year}</td>
                      <td className="px-3 py-2 text-muted">{s.nflTeam || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.games || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {nf(s.totalPts, 1)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.games ? nf(s.avgPts, 1) : "—"}
                      </td>
                      {cols.map((c) => (
                        <td key={c.label} className="px-3 py-2 text-right tabular-nums">
                          {c.get(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.seasons.length === 0 && (
                    <tr>
                      <td
                        colSpan={5 + cols.length}
                        className="px-3 py-3 text-center text-muted"
                      >
                        No season totals on record.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* NFL team share */}
          {data.nflShare && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                {data.nflShare.nflTeam} target &amp; points share · {data.year}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">Player</th>
                      {showTgt && (
                        <th className="px-3 py-2 text-right font-medium">Tgt%</th>
                      )}
                      <th className="px-3 py-2 text-right font-medium">Pts</th>
                      <th className="px-3 py-2 text-right font-medium">Pts%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.nflShare.mates.map((m) => (
                      <tr
                        key={m.name}
                        className={`border-b border-border/50 last:border-0 ${
                          m.isSelf ? "bg-accent/10 font-semibold" : ""
                        }`}
                      >
                        <td className="px-3 py-2">{m.name}</td>
                        {showTgt && (
                          <td className="px-3 py-2 text-right tabular-nums text-muted">
                            {totTgt ? `${((m.targets / totTgt) * 100).toFixed(0)}%` : "—"}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right tabular-nums">
                          {m.points.toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">
                          {totPts ? `${((m.points / totPts) * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
