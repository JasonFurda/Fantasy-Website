import { type Standing, winPct } from "@/lib/queries";

const MEDALS: Record<number, string> = {
  1: "#f5c518", // gold
  2: "#c4ccd4", // silver
  3: "#cd7f32", // bronze
};
function medalStyle(rank: number) {
  const c = MEDALS[rank];
  return c ? { backgroundColor: c, color: "#0b0f14" } : undefined;
}

export default function StandingsTable({
  standings,
}: {
  standings: Standing[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 text-right font-medium">W-L</th>
            <th className="px-4 py-3 text-right font-medium">Win %</th>
            <th className="px-4 py-3 text-right font-medium">PF</th>
            <th className="px-4 py-3 text-right font-medium">PA</th>
            <th className="px-4 py-3 text-right font-medium">Diff</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const diff = s.pointsFor - s.pointsAgainst;
            return (
              <tr
                key={s.team.id}
                className={`border-b border-border/60 last:border-0 transition-colors ${
                  MEDALS[s.rank]
                    ? "font-medium [&>td]:text-[#0b0f14]"
                    : "hover:bg-surface-2"
                }`}
                style={medalStyle(s.rank)}
              >
                <td
                  className={`px-4 py-3 tabular-nums ${MEDALS[s.rank] ? "font-bold" : "text-muted"}`}
                >
                  {s.rank}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{s.team.name}</div>
                  <div className="text-xs text-muted">{s.team.owner}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {s.wins}-{s.losses}
                  {s.ties ? `-${s.ties}` : ""}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {winPct(s).toFixed(3).replace(/^0/, "")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {s.pointsFor.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {s.pointsAgainst.toFixed(1)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    diff > 0
                      ? "text-accent"
                      : diff < 0
                        ? "text-red-400"
                        : "text-muted"
                  }`}
                >
                  {diff > 0 ? "+" : ""}
                  {diff.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
