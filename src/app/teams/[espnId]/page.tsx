import Link from "next/link";
import { notFound } from "next/navigation";
import { getFranchise } from "@/lib/queries";
import { teamColor, teamArt } from "@/lib/teams-config";
import TeamArt from "@/components/TeamArt";

export const dynamic = "force-dynamic";

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

  return (
    <main
      className="mx-auto max-w-5xl px-6 py-12"
      style={{ ["--team" as string]: color }}
    >
      <Link
        href="/teams"
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        ← All teams
      </Link>

      {/* Header */}
      <header
        className="mt-4 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${color}66`,
          background: `linear-gradient(135deg, ${color}26, var(--surface) 60%)`,
        }}
      >
        <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
          <TeamArt src={art} name={franchise.latestName} color={color} />
          <div>
            <div
              className="inline-block rounded-full px-3 py-1 text-sm font-medium"
              style={{ backgroundColor: `${color}26`, color }}
            >
              {franchise.owner}
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              {franchise.latestName}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {franchise.seasons.length}{" "}
              {franchise.seasons.length === 1 ? "season" : "seasons"} in the
              league
            </p>
          </div>
        </div>
      </header>

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
                    {s.rank > 0 ? `${s.rank} / ${s.teamCount}` : "—"}
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
    </main>
  );
}
