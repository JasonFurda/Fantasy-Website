import Link from "next/link";
import {
  getSeasons,
  getPlayerComparison,
  getDraftValue,
  type PlayerCompRow,
} from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export const dynamic = "force-dynamic";

const POSITIONS = [
  { key: "WR", pos: "WR", label: "WR" },
  { key: "RB", pos: "RB", label: "RB" },
  { key: "QB", pos: "QB", label: "QB" },
  { key: "TE", pos: "TE", label: "TE" },
  { key: "K", pos: "K", label: "K" },
  { key: "DST", pos: "D/ST", label: "D/ST" },
] as const;

type Col = { label: string; get: (r: PlayerCompRow) => string; right?: boolean };

const n = (v: number, d = 0) => (v || 0).toFixed(d);
const ratio = (a: number, b: number, d = 1) => (b ? (a / b).toFixed(d) : "—");
const pctRatio = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

const COMMON: Col[] = [
  { label: "G", get: (r) => (r.games ? String(r.games) : "—"), right: true },
  { label: "Total", get: (r) => n(r.totalPts, 1), right: true },
  { label: "Avg", get: (r) => (r.games ? n(r.avgPts, 1) : "—"), right: true },
  {
    label: "Var",
    get: (r) => (r.fantasyTeam ? n(r.variance, 1) : "—"),
    right: true,
  },
];

const EXTRA: Record<string, Col[]> = {
  WR: [
    { label: "Tgt", get: (r) => n(r.s.receivingTargets), right: true },
    { label: "Rec", get: (r) => n(r.s.receivingReceptions), right: true },
    { label: "Catch%", get: (r) => pctRatio(r.s.receivingReceptions, r.s.receivingTargets), right: true },
    { label: "Yds", get: (r) => n(r.s.receivingYards), right: true },
    { label: "YPR", get: (r) => ratio(r.s.receivingYards, r.s.receivingReceptions), right: true },
    { label: "TD", get: (r) => n(r.s.receivingTouchdowns), right: true },
    { label: "Fum", get: (r) => n(r.s.lostFumbles), right: true },
  ],
  TE: [
    { label: "Tgt", get: (r) => n(r.s.receivingTargets), right: true },
    { label: "Rec", get: (r) => n(r.s.receivingReceptions), right: true },
    { label: "Catch%", get: (r) => pctRatio(r.s.receivingReceptions, r.s.receivingTargets), right: true },
    { label: "Yds", get: (r) => n(r.s.receivingYards), right: true },
    { label: "YPR", get: (r) => ratio(r.s.receivingYards, r.s.receivingReceptions), right: true },
    { label: "TD", get: (r) => n(r.s.receivingTouchdowns), right: true },
  ],
  RB: [
    { label: "Att", get: (r) => n(r.s.rushingAttempts), right: true },
    { label: "RuYds", get: (r) => n(r.s.rushingYards), right: true },
    { label: "YPC", get: (r) => ratio(r.s.rushingYards, r.s.rushingAttempts), right: true },
    { label: "RuTD", get: (r) => n(r.s.rushingTouchdowns), right: true },
    { label: "Tgt", get: (r) => n(r.s.receivingTargets), right: true },
    { label: "Rec", get: (r) => n(r.s.receivingReceptions), right: true },
    { label: "ReYds", get: (r) => n(r.s.receivingYards), right: true },
    {
      label: "TotTD",
      get: (r) => n((r.s.rushingTouchdowns || 0) + (r.s.receivingTouchdowns || 0)),
      right: true,
    },
  ],
  QB: [
    { label: "PaYds", get: (r) => n(r.s.passingYards), right: true },
    { label: "PaTD", get: (r) => n(r.s.passingTouchdowns), right: true },
    { label: "INT", get: (r) => n(r.s.passingInterceptions), right: true },
    { label: "Cmp%", get: (r) => pctRatio(r.s.passingCompletions, r.s.passingAttempts), right: true },
    { label: "RuYds", get: (r) => n(r.s.rushingYards), right: true },
    { label: "RuTD", get: (r) => n(r.s.rushingTouchdowns), right: true },
  ],
  K: [
    { label: "FGM", get: (r) => n(r.s.madeFieldGoals), right: true },
    { label: "FGA", get: (r) => n(r.s.attemptedFieldGoals), right: true },
    { label: "FG%", get: (r) => pctRatio(r.s.madeFieldGoals, r.s.attemptedFieldGoals), right: true },
    { label: "XPM", get: (r) => n(r.s.madeExtraPoints), right: true },
  ],
  "D/ST": [
    { label: "Sacks", get: (r) => n(r.s.defensiveSacks), right: true },
    { label: "INT", get: (r) => n(r.s.defensiveInterceptions), right: true },
    { label: "Def TD", get: (r) => n(r.s.defensiveTouchdowns), right: true },
    { label: "PA", get: (r) => n(r.s.defensivePointsAllowed), right: true },
  ],
};

export default async function PlayerComparisonsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; pos?: string; sel?: string }>;
}) {
  const seasons = await getSeasons();
  if (seasons.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16 text-muted">
        No seasons found yet.
      </main>
    );
  }

  const sp = await searchParams;
  const years = seasons.map((s) => s.year);
  const year =
    sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : years[0];
  const isDraft = sp.pos === "draft";
  const posDef = POSITIONS.find((p) => p.key === sp.pos) ?? POSITIONS[0];
  const sel = sp.sel ?? null;

  const rows = isDraft ? [] : await getPlayerComparison(year, posDef.pos);
  const draftRows = isDraft ? await getDraftValue(year) : [];
  const cols = [...COMMON, ...(EXTRA[posDef.pos] ?? [])];
  const hasTargets = ["WR", "RB", "TE"].includes(posDef.pos);

  // Per-NFL-team distribution (group the comparison rows by NFL team)
  const byNfl = new Map<string, PlayerCompRow[]>();
  if (!isDraft) {
    for (const r of rows) {
      if (!r.nflTeam) continue;
      const arr = byNfl.get(r.nflTeam) ?? [];
      arr.push(r);
      byNfl.set(r.nflTeam, arr);
    }
  }
  const distribution = [...byNfl.entries()]
    .map(([nfl, players]) => {
      const totTgt = players.reduce((a, p) => a + (p.s.receivingTargets || 0), 0);
      const totPts = players.reduce((a, p) => a + p.totalPts, 0);
      return { nfl, players, totTgt, totPts };
    })
    .sort((a, b) => b.totPts - a.totPts);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Player Comparisons</h1>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/player-comparisons?year=${y}&pos=${posDef.key}`}
              className={tabCls(y === year)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {POSITIONS.map((p) => (
          <Link
            key={p.key}
            href={`/player-comparisons?year=${year}&pos=${p.key}`}
            className={tabCls(!isDraft && p.key === posDef.key)}
          >
            {p.label}
          </Link>
        ))}
        <Link
          href={`/player-comparisons?year=${year}&pos=draft`}
          className={tabCls(isDraft)}
        >
          Draft Value
        </Link>
      </nav>

      {!isDraft && (
        <>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Player</th>
              <th className="px-3 py-3 font-medium">Fantasy</th>
              <th className="px-3 py-3 font-medium">NFL</th>
              {cols.map((c) => (
                <th
                  key={c.label}
                  className={`px-3 py-3 font-medium ${c.right ? "text-right" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.name}
                className="border-b border-border/60 last:border-0 hover:bg-surface-2"
              >
                <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {r.nflTeam ? (
                    <Link
                      href={`/player-comparisons?year=${year}&pos=${posDef.key}&sel=${encodeURIComponent(r.nflTeam)}`}
                      scroll={false}
                      className="hover:text-accent hover:underline"
                    >
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
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
                    className={`px-3 py-2 tabular-nums ${c.right ? "text-right" : ""}`}
                  >
                    {c.get(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="mt-4 text-sm text-muted">No players found.</p>
      )}

      {sel && distribution.some((d) => d.nfl === sel) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Link
            href={`/player-comparisons?year=${year}&pos=${posDef.key}`}
            scroll={false}
            aria-label="Close"
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold tracking-tight">
                {sel} — {hasTargets ? "target & points share" : "points share"}
              </h2>
              <Link
                href={`/player-comparisons?year=${year}&pos=${posDef.key}`}
                scroll={false}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground"
              >
                ✕
              </Link>
            </div>
            <div className="grid gap-4">
              {distribution
                .filter((d) => d.nfl === sel)
                .map((d) => (
              <div
                key={d.nfl}
                className="rounded-xl border border-border bg-surface p-3"
              >
                <div className="mb-2 text-sm font-semibold">{d.nfl}</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 font-medium">Player</th>
                      {hasTargets && (
                        <th className="py-1 text-right font-medium">Tgt%</th>
                      )}
                      <th className="py-1 text-right font-medium">Pts</th>
                      <th className="py-1 text-right font-medium">Pts%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.players.map((p) => (
                      <tr key={p.name} className="border-t border-border/40">
                        <td className="truncate py-1 pr-2">{p.name}</td>
                        {hasTargets && (
                          <td className="py-1 text-right tabular-nums text-muted">
                            {d.totTgt
                              ? `${(((p.s.receivingTargets || 0) / d.totTgt) * 100).toFixed(0)}%`
                              : "—"}
                          </td>
                        )}
                        <td className="py-1 text-right tabular-nums">
                          {p.totalPts.toFixed(0)}
                        </td>
                        <td className="py-1 text-right tabular-nums text-muted">
                          {d.totPts
                            ? `${((p.totalPts / d.totPts) * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {isDraft && (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            TE/RB/WR ranked by draft value = (total points)² × √(draft
            position). Higher means more production relative to how late they
            were drafted.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Player</th>
                  <th className="px-3 py-3 font-medium">Pos</th>
                  <th className="px-3 py-3 font-medium">Fantasy</th>
                  <th className="px-3 py-3 font-medium">Original Drafter</th>
                  <th className="px-3 py-3 text-right font-medium">Draft</th>
                  <th className="px-3 py-3 text-right font-medium">Round</th>
                  <th className="px-3 py-3 text-right font-medium">Pts</th>
                  <th className="px-3 py-3 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((r, i) => (
                  <tr
                    key={r.name}
                    className="border-b border-border/60 last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-muted">{r.position}</td>
                    <td className="px-3 py-2">
                      {r.fantasyTeam ? (
                        <Link
                          href={`/teams/${r.fantasyTeam.espnId}`}
                          className="flex items-center gap-1.5 whitespace-nowrap hover:underline"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: teamColor(r.fantasyTeam.espnId),
                            }}
                          />
                          {r.fantasyTeam.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.originalDrafter ? (
                        <Link
                          href={`/teams/${r.originalDrafter.espnId}`}
                          className="flex items-center gap-1.5 whitespace-nowrap hover:underline"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: teamColor(
                                r.originalDrafter.espnId,
                              ),
                            }}
                          />
                          {r.originalDrafter.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.overall}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {r.round}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.totalPts.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {r.value.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {draftRows.length === 0 && (
            <p className="mt-4 text-sm text-muted">No draft data.</p>
          )}
        </>
      )}
    </main>
  );
}
