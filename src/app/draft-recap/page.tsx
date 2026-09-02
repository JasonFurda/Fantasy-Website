import Link from "next/link";
import type { Metadata } from "next";
import { getSeasons, getDraftRecap, type DraftRecapPick } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft Recap · Chamoms Fantasy",
  description: "Every pick of the league draft, with its draft value.",
};

const MEDALS: Record<number, string> = {
  1: "#f5c518", // gold
  2: "#c4ccd4", // silver
  3: "#cd7f32", // bronze
};

function TeamTag({ team }: { team: { name: string; espnId: number } | null }) {
  if (!team) return <span className="text-muted">—</span>;
  return (
    <Link
      href={`/teams/${team.espnId}`}
      className="flex items-center gap-1.5 whitespace-nowrap hover:underline"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: teamColor(team.espnId) }}
      />
      {team.name}
    </Link>
  );
}

function PlayerLink({ name, year }: { name: string; year: number }) {
  return (
    <Link
      href={`/player-comparisons?year=${year}&pos=draft&player=${encodeURIComponent(name)}`}
      className="hover:text-accent hover:underline"
    >
      {name}
    </Link>
  );
}

function PickRow({
  p,
  year,
  scored,
}: {
  p: DraftRecapPick;
  year: number;
  /** Before the season has any points, every total is 0 — show dashes so the
   *  board doesn't read as "everyone scored nothing". */
  scored: boolean;
}) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2">
      <td className="px-3 py-2 tabular-nums text-muted">{p.overall}</td>
      <td className="whitespace-nowrap px-3 py-2 font-medium">
        <PlayerLink name={p.playerName} year={year} />
      </td>
      <td className="px-3 py-2 text-muted">{p.position ?? "—"}</td>
      <td className="px-3 py-2 text-muted">{p.nflTeam ?? "—"}</td>
      <td className="px-3 py-2">
        <TeamTag team={p.drafter} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {p.totalPts == null || !scored ? (
          <span className="text-muted">—</span>
        ) : (
          p.totalPts.toFixed(1)
        )}
      </td>
      <td className="px-3 py-2 text-right font-bold tabular-nums">
        {p.value == null || !scored ? (
          <span className="font-normal text-muted">—</span>
        ) : (
          p.value.toFixed(1)
        )}
      </td>
    </tr>
  );
}

export default async function DraftRecapPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const seasons = await getSeasons();
  if (seasons.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-muted">
        No seasons found yet.
      </main>
    );
  }

  const sp = await searchParams;
  const years = seasons.map((s) => s.year);
  const year =
    sp.year && years.includes(Number(sp.year)) ? Number(sp.year) : years[0];
  const recap = await getDraftRecap(year);

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Draft Recap</h1>
          {recap.totalPicks > 0 && (
            <p className="mt-1 text-sm text-muted">
              {year} draft · {recap.totalPicks} picks · {recap.rounds.length}{" "}
              rounds · {recap.teamCount} teams
            </p>
          )}
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/draft-recap?year=${y}`}
              className={tabCls(y === year)}
            >
              {y}
            </Link>
          ))}
        </nav>
      </div>

      {recap.totalPicks === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-sm text-muted">
          No draft data for {year}.
        </p>
      ) : (
        <>
          <p className="mb-6 max-w-2xl text-sm text-muted">
            Value = (total points)² × √(draft position) — the same number the{" "}
            <Link
              href={`/player-comparisons?year=${year}&pos=draft`}
              className="text-accent hover:underline"
            >
              Draft Value
            </Link>{" "}
            table shows. Higher means more production relative to how late the
            pick was. It is only defined for TE/RB/WR, so every other pick shows
            a dash.
          </p>

          {!recap.scored && (
            <div className="mb-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-muted">
              <span className="font-semibold text-accent">
                No games played yet.
              </span>{" "}
              The board is final, but points and value fill in once the season
              starts.
            </div>
          )}

          {recap.topValue.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Best value picks
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recap.topValue.map((p, i) => (
                  <div
                    key={p.playerName}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${
                        MEDALS[i + 1]
                          ? "font-bold text-[#0b0f14] shadow"
                          : "text-muted"
                      }`}
                      style={
                        MEDALS[i + 1]
                          ? { backgroundColor: MEDALS[i + 1] }
                          : undefined
                      }
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        <PlayerLink name={p.playerName} year={year} />
                      </div>
                      <div className="text-[11px] text-muted">
                        {p.position} · pick {p.overall} ·{" "}
                        {p.drafter?.name ?? "—"}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {p.value?.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-col gap-8">
            {recap.rounds.map((r) => (
              <section key={r.round}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                  Round {r.round}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                        <th className="px-3 py-3 font-medium">#</th>
                        <th className="px-3 py-3 font-medium">Player</th>
                        <th className="px-3 py-3 font-medium">Pos</th>
                        <th className="px-3 py-3 font-medium">NFL</th>
                        <th className="px-3 py-3 font-medium">Drafted by</th>
                        <th className="px-3 py-3 text-right font-medium">
                          Pts
                        </th>
                        <th className="px-3 py-3 text-right font-medium">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.picks.map((p) => (
                        <PickRow
                          key={p.overall}
                          p={p}
                          year={year}
                          scored={recap.scored}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
