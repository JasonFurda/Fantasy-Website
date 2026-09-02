import Link from "next/link";
import type { Metadata } from "next";
import {
  getTeamOutlook,
  getCurrentFranchises,
  DEF_MIN_SAMPLES,
  type OutlookPlayer,
  type DefenseRatings,
  type DefenseVsPos,
} from "@/lib/queries";
import { cookies } from "next/headers";
import { MY_TEAM_COOKIE } from "@/lib/my-team";
import { teamColor } from "@/lib/teams-config";
import TeamPickerModal from "@/components/TeamPickerModal";
import ChangeTeamButton from "@/components/ChangeTeamButton";
import DefenseVsPositionTable from "@/components/DefenseVsPositionTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outlook · Chamoms Fantasy",
  description:
    "How your players' matchups grade out against each defense this week.",
};

/** Softest matchups get green, toughest get red. Ranks are 1 = allows the most,
 *  so low rank = good for your player. */
function verdict(r: DefenseVsPos, total: number) {
  const pct = total > 1 ? (r.rank - 1) / (total - 1) : 0.5;
  if (pct <= 0.25) return { label: "Great", cls: "text-accent" };
  if (pct <= 0.45) return { label: "Good", cls: "text-accent/80" };
  if (pct <= 0.65) return { label: "Neutral", cls: "text-muted" };
  if (pct <= 0.85) return { label: "Tough", cls: "text-orange-400" };
  return { label: "Avoid", cls: "text-red-400" };
}

function PlayerRow({
  p,
  ratings,
}: {
  p: OutlookPlayer;
  ratings: DefenseRatings | null;
}) {
  const total = ratings?.defenses.length ?? 0;
  const v = p.rating ? verdict(p.rating, total) : null;
  const onBye = p.opponent === "BYE";

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-surface-2">
      <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted">
        {p.slot}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-medium">
        {p.playerName}
      </td>
      <td className="px-3 py-2 text-muted">{p.position ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-muted">
        {onBye ? (
          <span className="text-muted">Bye</span>
        ) : p.opponent ? (
          <>
            {p.proTeam} <span className="text-border">vs</span> {p.opponent}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted">
        {p.projected == null || p.projected === 0
          ? "—"
          : p.projected.toFixed(1)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {p.rating ? (
          <span className={p.rating.thin ? "text-muted" : undefined}>
            {p.rating.avgAllowed.toFixed(1)}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {p.rating ? (
          <span className={p.rating.thin ? "text-muted" : undefined}>
            {p.rating.vsLeague >= 0 ? "+" : ""}
            {p.rating.vsLeague.toFixed(1)}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {p.rating && v ? (
          <span
            className={`whitespace-nowrap font-semibold ${p.rating.thin ? "text-muted" : v.cls}`}
            title={`${p.rating.defense} allows the ${ordinal(p.rating.rank)}-most fantasy points to ${p.rating.position} (${p.rating.samples} player-games)`}
          >
            {v.label}
            <span className="ml-1 font-normal text-muted">
              #{p.rating.rank}
              {p.rating.thin ? "*" : ""}
            </span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function RosterTable({
  title,
  players,
  ratings,
}: {
  title: string;
  players: OutlookPlayer[];
  ratings: DefenseRatings | null;
}) {
  if (players.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-3 font-medium">Slot</th>
              <th className="px-3 py-3 font-medium">Player</th>
              <th className="px-3 py-3 font-medium">Pos</th>
              <th className="px-3 py-3 font-medium">Matchup</th>
              <th className="px-3 py-3 text-right font-medium">Proj</th>
              <th
                className="px-3 py-3 text-right font-medium"
                title="Fantasy points that defense allows per game to this position"
              >
                Def allows
              </th>
              <th
                className="px-3 py-3 text-right font-medium"
                title="Versus the league average for the position"
              >
                vs Avg
              </th>
              <th className="px-3 py-3 text-right font-medium">Matchup grade</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <PlayerRow key={`${p.slot}-${p.playerName}`} p={p} ratings={ratings} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function OutlookPage() {
  // "none" means they deliberately chose to browse without a team, so offer the
  // picker but don't force the popup on them the way an unset cookie does.
  const raw = (await cookies()).get(MY_TEAM_COOKIE)?.value ?? null;
  const espnId =
    raw && raw !== "none" && Number.isFinite(Number(raw)) ? Number(raw) : null;

  if (espnId == null) {
    const franchises = await getCurrentFranchises();
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Outlook</h1>
        <p className="mb-6 max-w-2xl text-sm text-muted">
          Pick your team and this page will show who each of your players faces
          this week, and whether that defense tends to give up points to their
          position.
        </p>
        <ChangeTeamButton
          label="Pick your team"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        />
        {raw !== "none" && (
          <TeamPickerModal
            teams={franchises.map((t) => ({
              espnId: t.espn_id,
              name: t.name.trim(),
              color: teamColor(t.espn_id),
            }))}
          />
        )}
      </main>
    );
  }

  const outlook = await getTeamOutlook(espnId);
  if (!outlook) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 text-muted">
        No schedule data for your team yet.
      </main>
    );
  }

  const { ratings } = outlook;
  const color = teamColor(outlook.team.espn_id);
  const staleRatings = ratings != null && ratings.year !== outlook.year;
  const anyThin = [...outlook.starters, ...outlook.bench].some(
    (p) => p.rating?.thin,
  );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="h-10 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Outlook</h1>
            <p className="mt-0.5 text-sm text-muted">
              <span style={{ color }} className="font-semibold">
                {outlook.team.name.trim()}
              </span>{" "}
              · Week {outlook.week}
              {outlook.fantasyOpponent && (
                <> vs {outlook.fantasyOpponent.name.trim()}</>
              )}
              {outlook.played && " · final"}
            </p>
          </div>
        </div>
        <ChangeTeamButton className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground" />
      </div>

      {ratings == null ? (
        <p className="mb-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          No completed games anywhere in the database yet, so there is nothing
          to rate defenses on.
        </p>
      ) : (
        <p className="mb-6 max-w-3xl text-sm text-muted">
          &ldquo;Def allows&rdquo; is the fantasy points that defense gives up
          per game to the player&apos;s position, from{" "}
          <span className="text-foreground">
            {ratings.year} ({ratings.weeks} weeks)
          </span>
          . The grade ranks it against the other {ratings.defenses.length}{" "}
          defenses — <span className="text-accent">Great</span> means they give
          up a lot to that position.
          {staleRatings && (
            <>
              {" "}
              <span className="text-foreground">
                {outlook.year}{" "}
                has not played enough weeks to rate on its own
                yet, so these are last season&apos;s defenses.
              </span>
            </>
          )}
        </p>
      )}

      <div className="flex flex-col gap-8">
        <RosterTable
          title="Starters"
          players={outlook.starters}
          ratings={ratings}
        />
        <RosterTable title="Bench" players={outlook.bench} ratings={ratings} />
      </div>

      {anyThin && (
        <p className="mt-4 text-xs text-muted">
          * Fewer than {DEF_MIN_SAMPLES} player-games behind that number —
          treat it as a hint, not a read.
        </p>
      )}

      {ratings && (
        <section className="mt-12">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Every defense, by position
            </h2>
            <span className="text-xs text-muted">
              fantasy points allowed per game · {ratings.year}
            </span>
          </div>
          <DefenseVsPositionTable ratings={ratings} />
        </section>
      )}

      <p className="mt-8 text-xs text-muted">
        Built from every rostered player who played against that defense,
        starters and bench alike. Free agents aren&apos;t counted, so these run
        a little high in absolute terms — the ranking between defenses is the
        useful part.{" "}
        <Link href="/matchups" className="text-accent hover:underline">
          Full matchups →
        </Link>
      </p>
    </main>
  );
}
