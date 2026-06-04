import type { MatchupDetail, SlotRow } from "@/lib/queries";

/**
 * Performance vs projection as a background tint on a player's entry.
 * Green = overperform, red = underperform; deeper as the deviation grows
 * (±50% of projected = full intensity).
 */
function perfBg(points: number, projected: number | null): string | undefined {
  if (projected == null || projected <= 0) return undefined;
  const ratio = (points - projected) / projected;

  // Doubled their projection or better → light blue.
  if (ratio >= 1.0) return "hsla(200, 90%, 60%, 0.55)";

  const DEAD = 0.1; // within ±10% of projection → no color
  const FULL = 0.8; // ~80% over/under → full intensity
  if (Math.abs(ratio) < DEAD) return undefined;

  const a = Math.min(1, (Math.abs(ratio) - DEAD) / (FULL - DEAD));
  const eased = a * a; // reserve the brightest colors for exceptional games
  const hue = ratio > 0 ? 145 : 0; // green vs red
  const sat = 55 + eased * 35;
  const light = 50 - eased * 6;
  const alpha = 0.1 + eased * 0.5;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha.toFixed(2)})`;
}

function PlayerName({ p, align }: { p: SlotRow | null; align: "left" | "right" }) {
  if (!p) return <div className="flex-1" />;
  return (
    <div
      className={`min-w-0 flex-1 rounded-md px-2 py-1 ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{ backgroundColor: perfBg(p.points, p.projected) }}
    >
      <div className="truncate text-sm font-medium">{p.playerName}</div>
    </div>
  );
}

function Pts({ p, win }: { p: SlotRow | null; win: boolean }) {
  if (!p) return <div className="w-16 shrink-0" />;
  return (
    <div className="w-16 shrink-0 text-center">
      <div className={`tabular-nums ${win ? "font-bold" : ""}`}>
        {p.points.toFixed(1)}
      </div>
      {p.projected != null && (
        <div className="text-[10px] tabular-nums text-muted">
          proj {p.projected.toFixed(1)}
        </div>
      )}
    </div>
  );
}

function Row({
  away,
  home,
  slot,
}: {
  away: SlotRow | null;
  home: SlotRow | null;
  slot: string;
}) {
  const a = away?.points ?? 0;
  const h = home?.points ?? 0;
  return (
    <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2 last:border-0">
      <PlayerName p={away} align="right" />
      <Pts p={away} win={a > h} />
      <div className="w-12 shrink-0 text-center text-xs font-semibold uppercase text-muted">
        {slot}
      </div>
      <Pts p={home} win={h > a} />
      <PlayerName p={home} align="left" />
    </div>
  );
}

function zip(a: SlotRow[], b: SlotRow[]): [SlotRow | null, SlotRow | null][] {
  const n = Math.max(a.length, b.length);
  const out: [SlotRow | null, SlotRow | null][] = [];
  for (let i = 0; i < n; i++) out.push([a[i] ?? null, b[i] ?? null]);
  return out;
}

function TeamHeader({
  name,
  owner,
  score,
  projected,
  color,
  winner,
  align,
}: {
  name: string;
  owner: string;
  score: number;
  projected: number | null;
  color: string;
  winner: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className="mt-1 text-lg font-bold tracking-tight"
        style={{ color }}
      >
        {name}
      </div>
      <div className="text-xs text-muted">{owner}</div>
      <div
        className={`mt-1 text-4xl font-black tabular-nums ${winner ? "" : "text-foreground/60"}`}
      >
        {score.toFixed(1)}
      </div>
      {projected != null && (
        <div className="text-xs text-muted">proj {projected.toFixed(1)}</div>
      )}
    </div>
  );
}

export default function MatchupBoxScore({
  detail,
  awayColor,
  homeColor,
}: {
  detail: MatchupDetail;
  awayColor: string;
  homeColor: string;
}) {
  const awayWin = detail.awayScore > detail.homeScore;
  const homeWin = detail.homeScore > detail.awayScore;

  const starters = zip(detail.away.starters, detail.home.starters);
  const bench = zip(detail.away.bench, detail.home.bench);

  return (
    <div className="rounded-2xl border border-border bg-surface">
      {/* Score header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 border-b border-border p-5">
        <TeamHeader
          name={detail.awayTeam?.name.trim() ?? "Away"}
          owner={detail.awayTeam?.owner ?? ""}
          score={detail.awayScore}
          projected={detail.awayProjected}
          color={awayColor}
          winner={awayWin}
          align="right"
        />
        <div className="px-2 pt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          vs
        </div>
        <TeamHeader
          name={detail.homeTeam?.name.trim() ?? "Home"}
          owner={detail.homeTeam?.owner ?? ""}
          score={detail.homeScore}
          projected={detail.homeProjected}
          color={homeColor}
          winner={homeWin}
          align="left"
        />
      </div>

      {/* Starters */}
      <div className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted">
        Starters
      </div>
      <div>
        {starters.map(([a, h], i) => (
          <Row key={`s${i}`} away={a} home={h} slot={(a ?? h)?.slot ?? ""} />
        ))}
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <>
          <div className="border-t border-border px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted">
            Bench
          </div>
          <div className="opacity-75">
            {bench.map(([a, h], i) => (
              <Row key={`b${i}`} away={a} home={h} slot={(a ?? h)?.slot ?? "BE"} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
