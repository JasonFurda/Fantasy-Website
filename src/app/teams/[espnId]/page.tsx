import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFranchise } from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";

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

  const franchise = await getFranchise(espnId);
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
  const titles = franchise.seasons.filter((s) => s.isChampionByRecord).length;
  const ranks = franchise.seasons.map((s) => s.rank).filter((r) => r > 0);
  const bestFinish = ranks.length ? Math.min(...ranks) : 0;
  const avgPF = franchise.seasons.length
    ? totalPF / franchise.seasons.length
    : 0;

  const stats = [
    {
      label: "All-time record",
      value: `${wins}-${losses}${ties ? `-${ties}` : ""}`,
    },
    { label: "Win %", value: winPct.toFixed(3).replace(/^0/, "") },
    { label: "Championships", value: titles > 0 ? `🏆 ${titles}` : "0" },
    { label: "Best finish", value: bestFinish ? ordinal(bestFinish) : "—" },
    { label: "Total points", value: totalPF.toFixed(0) },
    { label: "Avg pts / season", value: avgPF.toFixed(1) },
  ];

  return (
    <main style={{ ["--team" as string]: color }}>
      {/* Hero */}
      <header className="relative h-[42vh] min-h-[300px] w-full overflow-hidden">
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
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, var(--background) 8%, transparent 60%), linear-gradient(to right, ${color}40, transparent 70%)`,
          }}
        />

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-5xl px-6 pb-6">
            <Link
              href="/teams"
              className="text-sm text-white/80 drop-shadow transition-colors hover:text-white"
            >
              ← All teams
            </Link>
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

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Career stats */}
        <section>
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
        </section>

        {/* Season history */}
        <section className="mt-10">
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
                        {s.isChampionByRecord && <span aria-hidden>🏆</span>}
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
