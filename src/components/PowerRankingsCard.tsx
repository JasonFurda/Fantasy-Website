import Link from "next/link";
import type { PowerRow } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

const MEDALS: Record<number, string> = {
  1: "#f5c518", // gold
  2: "#c4ccd4", // silver
  3: "#cd7f32", // bronze
};

function PowerLi({ r, mine }: { r: PowerRow; mine: boolean }) {
  return (
    <li>
      <Link
        href={`/teams/${r.team.espn_id}`}
        className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2 ${
          mine ? "bg-accent/10" : ""
        }`}
      >
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${
            MEDALS[r.rank] ? "font-bold text-[#0b0f14] shadow" : "text-muted"
          }`}
          style={MEDALS[r.rank] ? { backgroundColor: MEDALS[r.rank] } : undefined}
        >
          {r.rank}
        </span>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: teamColor(r.team.espn_id) }}
        />
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            mine ? "font-semibold" : "font-medium"
          }`}
        >
          {r.team.name.trim()}
        </span>
        <span className="shrink-0 text-xs tabular-nums">
          {r.change == null || r.change === 0 ? (
            <span className="text-muted">—</span>
          ) : r.change > 0 ? (
            <span className="text-accent">▲ {r.change}</span>
          ) : (
            <span className="text-red-400">▼ {Math.abs(r.change)}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export default function PowerRankingsCard({
  year,
  rows,
  highlightEspnId,
  preseason = false,
}: {
  year: number;
  rows: PowerRow[];
  highlightEspnId?: number;
  preseason?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Power Rankings · {year}
          {preseason && (
            <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted">
              preseason
            </span>
          )}
        </h2>
        <Link
          href="/power-rankings"
          className="text-xs text-accent hover:underline"
        >
          Full rankings →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No games played yet.</p>
      ) : (
        (() => {
          // 1..half down the left column, the rest down the right column.
          const half = Math.ceil(rows.length / 2);
          const columns = [rows.slice(0, half), rows.slice(half)];
          return (
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {columns.map((col, ci) => (
                <ol key={ci} className="grid content-start gap-1">
                  {col.map((r) => (
                    <PowerLi
                      key={r.team.id}
                      r={r}
                      mine={highlightEspnId === r.team.espn_id}
                    />
                  ))}
                </ol>
              ))}
            </div>
          );
        })()
      )}
    </section>
  );
}
