import type { WeekOptimalRoster as WeekOptimal } from "@/lib/queries";
import { teamColor } from "@/lib/teams-config";

function slotLabel(slot: string): string {
  if (slot === "RB/WR/TE") return "FLEX";
  return slot;
}

export default function WeekOptimalRoster({ data }: { data: WeekOptimal }) {
  return (
    <div className="border-y border-border bg-surface sm:rounded-2xl sm:border">
      {/* Header */}
      <div className="border-b border-border p-4 text-center sm:p-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">
          Week {data.week} · Optimal Roster
        </div>
        <div className="mt-1 text-4xl font-black tabular-nums">
          {data.total.toFixed(1)}
        </div>
        <div className="mt-1 text-xs text-muted">
          the highest-scoring lineup possible from every player in the league
          {data.fromFreeAgents > 0 && (
            <>
              {" — "}
              <span className="font-semibold text-accent">
                {data.fromFreeAgents} free agent
                {data.fromFreeAgents === 1 ? "" : "s"}
              </span>{" "}
              ({data.freeAgentPoints.toFixed(1)} pts)
            </>
          )}
        </div>
      </div>

      {/* Roster */}
      <div>
        {data.slots.map((p, i) => {
          const fa = p.teamEspnId == null;
          const dot = fa ? "var(--muted, #888)" : teamColor(p.teamEspnId!);
          return (
            <div
              key={`${p.slot}-${i}`}
              className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-0"
            >
              {/* Slot */}
              <div className="w-12 shrink-0 text-center text-[11px] font-semibold uppercase text-muted sm:w-14 sm:text-xs">
                {slotLabel(p.slot)}
              </div>

              {/* Player */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-tight">
                  {p.playerName}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dot }}
                  />
                  <span className="truncate">
                    {fa ? (
                      <span className="font-medium text-accent">Free Agent</span>
                    ) : (
                      p.teamName
                    )}
                  </span>
                  {p.proTeam && (
                    <span className="shrink-0 text-muted/70">· {p.proTeam}</span>
                  )}
                </div>
              </div>

              {/* Points */}
              <div className="w-14 shrink-0 text-right text-base font-bold tabular-nums">
                {p.points.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
