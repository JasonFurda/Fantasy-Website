import type { MatchupDetail, OptimalSlotRow } from "@/lib/queries";

function Name({
  p,
  align,
}: {
  p: OptimalSlotRow | null;
  align: "left" | "right";
}) {
  if (!p || !p.playerName) return <div className="flex-1" />;
  return (
    <div
      className={`min-w-0 flex-1 rounded-md px-2 py-2 sm:px-3 sm:py-2.5 ${
        align === "right" ? "text-right" : "text-left"
      } ${p.fromBench ? "bg-accent/15" : ""}`}
    >
      <div className="text-sm font-medium leading-tight break-words hyphens-auto">
        {p.playerName}
      </div>
      {p.fromBench && (
        <div
          className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent ${
            align === "right" ? "text-right" : "text-left"
          }`}
        >
          from bench
        </div>
      )}
    </div>
  );
}

function Pts({ p }: { p: OptimalSlotRow | null }) {
  if (!p || !p.playerName) return <div className="w-12 shrink-0 sm:w-16" />;
  return (
    <div className="w-12 shrink-0 text-center sm:w-16">
      <div
        className={`tabular-nums ${p.fromBench ? "font-bold text-accent" : ""}`}
      >
        {p.points.toFixed(1)}
      </div>
    </div>
  );
}

function Row({
  away,
  home,
  slot,
}: {
  away: OptimalSlotRow | null;
  home: OptimalSlotRow | null;
  slot: string;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1 last:border-0 sm:gap-2 sm:px-3">
      <Name p={away} align="right" />
      <Pts p={away} />
      <div className="w-9 shrink-0 text-center text-[10px] font-semibold uppercase text-muted sm:w-12 sm:text-xs">
        {slot}
      </div>
      <Pts p={home} />
      <Name p={home} align="left" />
    </div>
  );
}

function zip(
  a: OptimalSlotRow[],
  b: OptimalSlotRow[],
): [OptimalSlotRow | null, OptimalSlotRow | null][] {
  const n = Math.max(a.length, b.length);
  const out: [OptimalSlotRow | null, OptimalSlotRow | null][] = [];
  for (let i = 0; i < n; i++) out.push([a[i] ?? null, b[i] ?? null]);
  return out;
}

function Header({
  name,
  total,
  actual,
  color,
  align,
}: {
  name: string;
  total: number;
  actual: number;
  color: string;
  align: "left" | "right";
}) {
  const left = total - actual;
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="mt-1 text-lg font-bold tracking-tight" style={{ color }}>
        {name}
      </div>
      <div className="mt-1 text-4xl font-black tabular-nums">
        {total.toFixed(1)}
      </div>
      <div className="text-xs text-muted">
        started {actual.toFixed(1)}
        {left > 0.05 && (
          <>
            {" · "}
            <span className="font-semibold text-accent">
              +{left.toFixed(1)}
            </span>{" "}
            on bench
          </>
        )}
      </div>
    </div>
  );
}

export default function OptimalRoster({
  detail,
  awayColor,
  homeColor,
}: {
  detail: MatchupDetail;
  awayColor: string;
  homeColor: string;
}) {
  const rows = zip(detail.away.optimal.slots, detail.home.optimal.slots);

  return (
    <div className="border-y border-border bg-surface sm:rounded-2xl sm:border">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 border-b border-border p-4 sm:gap-4 sm:p-5">
        <Header
          name={detail.awayTeam?.name.trim() ?? "Away"}
          total={detail.away.optimal.total}
          actual={detail.away.optimal.actual}
          color={awayColor}
          align="right"
        />
        <div className="px-2 pt-6 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
          best
          <br />
          lineup
        </div>
        <Header
          name={detail.homeTeam?.name.trim() ?? "Home"}
          total={detail.home.optimal.total}
          actual={detail.home.optimal.actual}
          color={homeColor}
          align="left"
        />
      </div>

      <div className="px-4 py-3 text-center text-xs text-muted">
        The highest-scoring lineup each team could have started that week.
        Players who were left on the bench are{" "}
        <span className="font-semibold text-accent">highlighted</span>.
      </div>

      <div>
        {rows.map(([a, h], i) => (
          <Row key={`o${i}`} away={a} home={h} slot={(a ?? h)?.slot ?? ""} />
        ))}
      </div>
    </div>
  );
}
