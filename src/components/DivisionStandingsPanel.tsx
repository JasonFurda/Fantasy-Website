import Link from "next/link";
import type { DivisionStandings } from "@/lib/queries";
import StandingsTable from "@/components/StandingsTable";

/** The homepage standings block: each league division side by side, with a
 *  link out to the full table. Shared so the browsing homepage and the
 *  personalized one stay identical. Renders nothing if the season has no
 *  divisions configured in league-config. */
export default function DivisionStandingsPanel({
  divisions,
  highlightEspnId,
}: {
  divisions: DivisionStandings[];
  highlightEspnId?: number;
}) {
  if (divisions.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Standings
        </h2>
        <Link href="/standings" className="text-xs text-accent hover:underline">
          Full standings →
        </Link>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        {divisions.map((d) => (
          <section key={d.name}>
            <h3 className="mb-2 text-base font-semibold">{d.name}</h3>
            <StandingsTable
              standings={d.standings}
              highlightEspnId={highlightEspnId}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
