import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFranchise, getFranchiseRoster } from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";
import { championshipsFor } from "@/lib/league-config";
import RosterByYear from "@/components/RosterByYear";

export const dynamic = "force-dynamic";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ espnId: string }>;
}) {
  const { espnId: espnIdParam } = await params;
  const espnId = Number(espnIdParam);
  if (!Number.isFinite(espnId)) notFound();

  const [franchise, roster] = await Promise.all([
    getFranchise(espnId),
    getFranchiseRoster(espnId),
  ]);
  if (!franchise) notFound();

  const color = teamColor(espnId);
  const art = teamArt(espnId);

  // Career aggregates
  const wins = franchise.seasons.reduce((a, s) => a + s.wins, 0);
  const losses = franchise.seasons.reduce((a, s) => a + s.losses, 0);
  const ties = franchise.seasons.reduce((a, s) => a + s.ties, 0);
  const games = wins + losses + ties;
  const winPct = games ? (wins + ties * 0.5) / games : 0;
  const totalPF = franchise.seasons.reduce((a, s) => a + s.pointsFor, 0);
  const titles = championshipsFor(espnId);
  const ranks = franchise.seasons.map((s) => s.rank).filter((r) => r > 0);
  const bestFinish = ranks.length ? Math.min(...ranks) : 0;
  const avgPlacement = ranks.length
    ? ranks.reduce((a, r) => a + r, 0) / ranks.length
    : 0;

  const stats = [
    {
      label: "Overall record",
      value: `${wins}-${losses}${ties ? `-${ties}` : ""}`,
    },
    { label: "Win %", value: winPct.toFixed(3).replace(/^0/, "") },
    {
      label: "Avg placement",
      value: avgPlacement ? avgPlacement.toFixed(1) : "—",
    },
    { label: "Best finish", value: bestFinish ? ordinal(bestFinish) : "—" },
    { label: "Championships", value: titles > 0 ? `🏆 ${titles}` : "0" },
    { label: "Total points", value: totalPF.toFixed(0) },
  ];

  return (
    <main style={{ ["--team" as string]: color }}>
      {/* Hero */}
      <header className="relative h-[58vh] min-h-[360px] w-full overflow-hidden">
        {art ? (
          <Image src={art} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `radial-gradient(circle at 30% 40%, ${color}66, transparent 60%), var(--surface-2)`,
            }}
          />
        )}
        {/* gradual fade into the page background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, var(--background) 0%, color-mix(in srgb, var(--background) 80%, transparent) 22%, transparent 78%), linear-gradient(to right, ${color}33, transparent 65%)`,
          }}
        />

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-5xl px-6 pb-8">
            <Link
              href="/teams"
              className="inline-block text-sm text-white/80 drop-shadow transition-colors hover:text-white"
            >
              ← All teams
            </Link>
            <br />
            <div
              className="mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold"
              style={{ backgroundColor: color, color: "#0b0f14" }}
            >
              {franchise.owner}
            </div>
            <h1 className="mt-2 text-5xl font-black tracking-tight text-white drop-shadow-lg">
              {franchise.latestName}
            </h1>
            <p className="mt-1 text-sm text-white/80 drop-shadow">
              {franchise.seasons.length}{" "}
              {franchise.seasons.length === 1 ? "season" : "seasons"} in the
              league
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        {/* Section 1: Career totals */}
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">Career totals</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="text-xs uppercase tracking-wide text-muted">
                  {s.label}
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums">
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Top 3 scorers */}
          <h3 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
            Top scorers (all-time)
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {roster.topScorers.map((p, i) => (
              <div
                key={p.name}
                className="flex items-center gap-3 rounded-xl border bg-surface p-4"
                style={{ borderColor: i === 0 ? color : "var(--border)" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#0b0f14]"
                  style={{ backgroundColor: color, opacity: 1 - i * 0.25 }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-sm tabular-nums text-muted">
                    {p.points.toFixed(1)} pts
                  </div>
                </div>
              </div>
            ))}
            {roster.topScorers.length === 0 && (
              <p className="text-sm text-muted">No player data available.</p>
            )}
          </div>
        </section>

        {/* Section 2: Roster (toggle by year) */}
        <section>
          <RosterByYear byYear={roster.byYear} color={color} />
        </section>

        {/* Season history */}
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">
            Season history
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Year</th>
                  <th className="px-4 py-3 font-medium">Name that season</th>
                  <th className="px-4 py-3 text-right font-medium">Finish</th>
                  <th className="px-4 py-3 text-right font-medium">Record</th>
                  <th className="px-4 py-3 text-right font-medium">PF</th>
                  <th className="px-4 py-3 text-right font-medium">PA</th>
                </tr>
              </thead>
              <tbody>
                {franchise.seasons.map((s) => (
                  <tr
                    key={s.year}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{s.year}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        {s.isChampion && <span aria-hidden>🏆</span>}
                        {s.name.trim()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.rank > 0 ? `${ordinal(s.rank)} / ${s.teamCount}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.wins}-{s.losses}
                      {s.ties ? `-${s.ties}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.pointsFor.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {s.pointsAgainst.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
