import Link from "next/link";
import type { PlayerDetail, PlayerSeasonLine } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";
import { playoffStartWeek } from "@/lib/league-config";
import { WeeklyBars, Chip } from "@/components/PlayerDetailModal";

const nf = (v: number, d = 0) => (v || 0).toFixed(d);

type Metric = {
  label: string;
  a: number | null;
  b: number | null;
  higherBetter: boolean;
  fmt: (v: number) => string;
};

// Position-specific numeric stats, pulled from a season line's raw `s` map.
// null when the denominator is zero (ratios) so we don't show a fake leader.
type NumStat = {
  label: string;
  get: (s: Record<string, number>) => number | null;
  higherBetter?: boolean;
  fmt?: (v: number) => string;
};

const r1 = (v: number) => v.toFixed(1);
const pct = (v: number) => `${v.toFixed(0)}%`;
const ratioOf = (a: number, b: number) => (b ? a / b : null);

const POS_STATS: Record<string, NumStat[]> = {
  QB: [
    { label: "Pa Yds", get: (s) => s.passingYards ?? 0 },
    { label: "Pa TD", get: (s) => s.passingTouchdowns ?? 0 },
    { label: "INT", get: (s) => s.passingInterceptions ?? 0, higherBetter: false },
    { label: "Cmp%", get: (s) => ratioOf(s.passingCompletions ?? 0, s.passingAttempts ?? 0), fmt: (v) => pct(v * 100) },
    { label: "Ru Yds", get: (s) => s.rushingYards ?? 0 },
    { label: "Ru TD", get: (s) => s.rushingTouchdowns ?? 0 },
  ],
  RB: [
    { label: "Att", get: (s) => s.rushingAttempts ?? 0 },
    { label: "Ru Yds", get: (s) => s.rushingYards ?? 0 },
    { label: "YPC", get: (s) => ratioOf(s.rushingYards ?? 0, s.rushingAttempts ?? 0), fmt: r1 },
    { label: "Ru TD", get: (s) => s.rushingTouchdowns ?? 0 },
    { label: "Rec", get: (s) => s.receivingReceptions ?? 0 },
    { label: "Re Yds", get: (s) => s.receivingYards ?? 0 },
    { label: "Tot TD", get: (s) => (s.rushingTouchdowns ?? 0) + (s.receivingTouchdowns ?? 0) },
  ],
  WR: [
    { label: "Tgt", get: (s) => s.receivingTargets ?? 0 },
    { label: "Rec", get: (s) => s.receivingReceptions ?? 0 },
    { label: "Catch%", get: (s) => ratioOf(s.receivingReceptions ?? 0, s.receivingTargets ?? 0), fmt: (v) => pct(v * 100) },
    { label: "Yds", get: (s) => s.receivingYards ?? 0 },
    { label: "YPR", get: (s) => ratioOf(s.receivingYards ?? 0, s.receivingReceptions ?? 0), fmt: r1 },
    { label: "TD", get: (s) => s.receivingTouchdowns ?? 0 },
  ],
  TE: [
    { label: "Tgt", get: (s) => s.receivingTargets ?? 0 },
    { label: "Rec", get: (s) => s.receivingReceptions ?? 0 },
    { label: "Catch%", get: (s) => ratioOf(s.receivingReceptions ?? 0, s.receivingTargets ?? 0), fmt: (v) => pct(v * 100) },
    { label: "Yds", get: (s) => s.receivingYards ?? 0 },
    { label: "TD", get: (s) => s.receivingTouchdowns ?? 0 },
  ],
  K: [
    { label: "FGM", get: (s) => s.madeFieldGoals ?? 0 },
    { label: "FGA", get: (s) => s.attemptedFieldGoals ?? 0 },
    { label: "FG%", get: (s) => ratioOf(s.madeFieldGoals ?? 0, s.attemptedFieldGoals ?? 0), fmt: (v) => pct(v * 100) },
    { label: "XPM", get: (s) => s.madeExtraPoints ?? 0 },
  ],
  "D/ST": [
    { label: "Sack", get: (s) => s.defensiveSacks ?? 0 },
    { label: "INT", get: (s) => s.defensiveInterceptions ?? 0 },
    { label: "Def TD", get: (s) => s.defensiveTouchdowns ?? 0 },
    { label: "Pts Ag", get: (s) => s.defensivePointsAllowed ?? 0, higherBetter: false },
  ],
};

function curOf(d: PlayerDetail): PlayerSeasonLine | null {
  return d.seasons.find((s) => s.year === d.year) ?? null;
}

function buildMetrics(a: PlayerDetail, b: PlayerDetail): Metric[] {
  const ca = curOf(a);
  const cb = curOf(b);
  const metrics: Metric[] = [
    { label: "Total", a: ca?.totalPts ?? null, b: cb?.totalPts ?? null, higherBetter: true, fmt: r1 },
    { label: "Avg / wk", a: a.avg || null, b: b.avg || null, higherBetter: true, fmt: r1 },
    {
      label: "Best wk",
      a: a.bestWeek?.points ?? null,
      b: b.bestWeek?.points ?? null,
      higherBetter: true,
      fmt: r1,
    },
    { label: "Games", a: ca?.games ?? null, b: cb?.games ?? null, higherBetter: true, fmt: (v) => nf(v) },
  ];

  // Position-specific stats only when both players share a position.
  if (a.position && a.position === b.position && POS_STATS[a.position]) {
    for (const st of POS_STATS[a.position]) {
      const fmt = st.fmt ?? ((v: number) => nf(v));
      metrics.push({
        label: st.label,
        a: ca ? st.get(ca.s) : null,
        b: cb ? st.get(cb.s) : null,
        higherBetter: st.higherBetter ?? true,
        fmt,
      });
    }
  }
  return metrics;
}

function leader(m: Metric): "a" | "b" | null {
  if (m.a == null || m.b == null || m.a === m.b) return null;
  const aWins = m.higherBetter ? m.a > m.b : m.a < m.b;
  return aWins ? "a" : "b";
}

function PlayerPanel({
  d,
  yearHref,
}: {
  d: PlayerDetail;
  yearHref: (year: number) => string;
}) {
  const cur = curOf(d);
  return (
    <div className="min-w-0">
      <div className="mb-2">
        <h3 className="truncate text-xl font-black tracking-tight">{d.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {d.position && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-semibold text-foreground">
              {d.position}
            </span>
          )}
          {d.nflTeam && <span>{d.nflTeam}</span>}
          {d.fantasyTeam && (
            <Link
              href={`/teams/${d.fantasyTeam.espnId}`}
              className="flex items-center gap-1 hover:underline"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: teamColor(d.fantasyTeam.espnId) }}
              />
              {d.fantasyTeam.name}
            </Link>
          )}
        </div>
      </div>

      {d.seasons.length > 0 && (
        <div className="mb-3 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {d.seasons.map((s) => (
            <Link
              key={s.year}
              href={yearHref(s.year)}
              scroll={false}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                s.year === d.year
                  ? "bg-accent text-background"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {s.year}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Chip label="Total" value={nf(cur?.totalPts ?? 0, 1)} />
        <Chip label="Avg/Wk" value={d.avg ? d.avg.toFixed(1) : "—"} />
        <Chip label="Best Wk" value={d.bestWeek ? d.bestWeek.points.toFixed(1) : "—"} />
        <Chip label="Games" value={cur?.games ? String(cur.games) : "—"} />
      </div>

      {d.weekly.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface-2/40 p-2">
          <WeeklyBars
            weekly={d.weekly}
            position={d.position}
            playoffStart={playoffStartWeek(d.year)}
          />
        </div>
      ) : (
        <p className="text-sm text-muted">No games in {d.year}.</p>
      )}
    </div>
  );
}

export default function PlayerCompareModal({
  a,
  b,
  closeHref,
  aYearHref,
  bYearHref,
}: {
  a: PlayerDetail;
  b: PlayerDetail;
  closeHref: string;
  aYearHref: (year: number) => string;
  bYearHref: (year: number) => string;
}) {
  const metrics = buildMetrics(a, b);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6">
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative z-10 mt-4 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-surface/95 p-4 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Head-to-head
          </h2>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            ✕
          </Link>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_11rem_1fr]">
          <PlayerPanel d={a} yearHref={aYearHref} />

          {/* Middle comparison */}
          <div className="order-last md:order-none">
            <div className="rounded-xl border border-border bg-surface-2/40 p-2">
              <div className="mb-1 flex items-center justify-between px-1 text-[10px] uppercase tracking-wide text-muted">
                <span className="truncate">{a.name.split(" ").slice(-1)}</span>
                <span className="truncate">{b.name.split(" ").slice(-1)}</span>
              </div>
              <ul className="space-y-1">
                {metrics.map((m) => {
                  const win = leader(m);
                  const cell = (side: "a" | "b", v: number | null) =>
                    v == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span
                        className={
                          win === side
                            ? "font-bold text-accent"
                            : win == null
                              ? ""
                              : "text-muted"
                        }
                      >
                        {m.fmt(v)}
                      </span>
                    );
                  return (
                    <li
                      key={m.label}
                      className="flex items-center justify-between gap-1 rounded-md px-1.5 py-1 text-sm tabular-nums odd:bg-surface/60"
                    >
                      <span className="w-12 text-left">{cell("a", m.a)}</span>
                      <span className="flex-1 text-center text-[10px] uppercase tracking-wide text-muted">
                        {m.label}
                      </span>
                      <span className="w-12 text-right">{cell("b", m.b)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {a.position !== b.position && (
              <p className="mt-2 px-1 text-[11px] text-muted">
                Different positions — only scoring totals are compared.
              </p>
            )}
          </div>

          <PlayerPanel d={b} yearHref={bYearHref} />
        </div>
      </div>
    </div>
  );
}
