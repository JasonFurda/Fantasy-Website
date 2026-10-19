"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalcTeam, TradeCalcData } from "@/lib/queries";
import {
  evaluateTrade,
  IR_WEEKS,
  type LineupSpot,
  type TeamEval,
} from "@/lib/trade-calc";
import { teamColor } from "@/lib/teams-config";
import { MY_TEAM_COOKIE } from "@/lib/my-team";

const fmt = (n: number) => n.toFixed(1);
const signed = (n: number, d = 1) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}`;
const netCls = (n: number) =>
  n > 0.05 ? "text-accent" : n < -0.05 ? "text-red-400" : "text-muted";

const INJURY_TAG: Record<string, string> = {
  INJURY_RESERVE: "IR",
  OUT: "O",
  DOUBTFUL: "D",
  QUESTIONABLE: "Q",
  DAY_TO_DAY: "DTD",
  SUSPENSION: "SSPD",
};

function Dot({ espnId }: { espnId: number }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: teamColor(espnId) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Picking players
// ---------------------------------------------------------------------------

function RosterPicker({
  label,
  teams,
  team,
  otherId,
  selected,
  onTeam,
  onToggle,
}: {
  label: string;
  teams: CalcTeam[];
  team: CalcTeam;
  otherId: number;
  selected: string[];
  onTeam: (espnId: number) => void;
  onToggle: (name: string) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-1 flex items-center gap-2">
          <Dot espnId={team.espnId} />
          <select
            value={team.espnId}
            onChange={(e) => onTeam(Number(e.target.value))}
            className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm font-semibold text-foreground"
          >
            {teams
              .filter((t) => t.espnId !== otherId)
              .map((t) => (
                <option key={t.espnId} value={t.espnId}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <ul className="divide-y divide-border/40">
        {team.players.map((p) => {
          const on = selected.includes(p.name);
          const tag = p.injuryStatus ? INJURY_TAG[p.injuryStatus] : undefined;
          return (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => onToggle(p.name)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  on ? "bg-accent/15" : "hover:bg-surface-2"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    on
                      ? "border-accent bg-accent text-background"
                      : "border-border text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{p.name}</span>{" "}
                  {tag && (
                    <span className="rounded bg-red-400/15 px-1 text-[10px] font-semibold text-red-400">
                      {tag}
                    </span>
                  )}
                  <span className="block text-xs text-muted">
                    {[p.position, p.proTeam, p.byeWeek ? `bye ${p.byeWeek}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="font-semibold">{fmt(p.value)}</span>
                  <span className="block text-[11px] text-muted">pts/gm</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** Who enters and leaves the full-strength starting lineup. Compared as sets,
 *  so a starter who just shifts slots (WR → flex) isn't listed. A slot filled
 *  from waivers shows as a pickup at that position. */
function LineupChanges({ t }: { t: TeamEval }) {
  const label = (s: LineupSpot) =>
    s.player
      ? { key: s.player.name, name: s.player.name, pos: s.player.position, pts: s.pts }
      : {
          key: `waiver-${s.slot}`,
          name: "Waiver pickup",
          pos: s.slot === "RB/WR/TE" ? "Flex" : s.slot,
          pts: s.pts,
        };
  const before = t.lineupBefore.map(label);
  const after = t.lineupAfter.map(label);
  const count = (xs: { key: string }[], k: string) => xs.filter((x) => x.key === k).length;
  const diff = (a: typeof before, b: typeof before) => {
    const seen = new Map<string, number>();
    return a.filter((x) => {
      const n = (seen.get(x.key) ?? 0) + 1;
      seen.set(x.key, n);
      return n > count(b, x.key);
    });
  };
  const ins = diff(after, before);
  const outs = diff(before, after);
  if (ins.length === 0 && outs.length === 0)
    return (
      <p className="text-xs text-muted">
        Best lineup doesn&apos;t change — the trade only moves bench depth.
      </p>
    );
  const Row = ({ x, sign }: { x: (typeof before)[number]; sign: "in" | "out" }) => (
    <li className="flex items-baseline gap-2 text-sm">
      <span className={`w-4 shrink-0 font-bold ${sign === "in" ? "text-accent" : "text-red-400"}`}>
        {sign === "in" ? "+" : "−"}
      </span>
      <span className={`min-w-0 flex-1 ${sign === "out" ? "text-muted" : "font-medium"}`}>
        {x.name} <span className="text-xs font-normal text-muted">{x.pos}</span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted">{fmt(x.pts)}</span>
    </li>
  );
  return (
    <ul className="flex flex-col gap-1">
      {ins.map((x, i) => (
        <Row key={`in-${i}`} x={x} sign="in" />
      ))}
      {outs.map((x, i) => (
        <Row key={`out-${i}`} x={x} sign="out" />
      ))}
    </ul>
  );
}

function TeamResult({ t, weeks }: { t: TeamEval; weeks: number }) {
  const perWeek = t.avgAfter - t.avgBefore;
  const dWins = t.winsAfter - t.winsBefore;
  const paper = t.paperGet - t.paperGive;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex min-w-0 items-center gap-2">
        <Dot espnId={t.espnId} />
        <h3 className="truncate font-semibold">{t.name}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Lineup pts / wk</div>
          <div className={`text-2xl font-bold tabular-nums ${netCls(perWeek)}`}>
            {signed(perWeek)}
          </div>
          <div className="text-xs text-muted tabular-nums">
            {fmt(t.avgBefore)} → {fmt(t.avgAfter)} · {signed(t.totalDelta)} over {weeks} wk
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Expected wins</div>
          <div className={`text-2xl font-bold tabular-nums ${netCls(dWins)}`}>
            {signed(dWins, 2)}
          </div>
          <div className="text-xs text-muted tabular-nums">
            {t.winsBefore.toFixed(2)} → {t.winsAfter.toFixed(2)} rest of season
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">
          Starting lineup (full strength)
        </div>
        <LineupChanges t={t} />
      </div>

      {t.drops.length > 0 && (
        <p className="text-xs text-muted">
          Roster is full, so they&apos;d have to drop{" "}
          <span className="text-foreground">
            {t.drops.map((p) => p.name).join(", ")}
          </span>{" "}
          (whoever costs the lineup least).
        </p>
      )}

      <p className="mt-auto border-t border-border/60 pt-3 text-xs text-muted">
        On paper: gives {fmt(t.paperGive)}, gets {fmt(t.paperGet)} pts/gm (
        <span className={netCls(paper)}>{signed(paper)}</span>) — the lineup
        numbers above are what that is actually worth to this roster.
      </p>
    </section>
  );
}

function WeeklyTable({ teams }: { teams: [TeamEval, TeamEval] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-border/60">
            <th className="px-3 py-2 text-left font-medium">Week</th>
            {teams[0].weekly.map((w) => (
              <th key={w.week} className="px-2 py-2 text-right font-medium">
                {w.week}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.espnId} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <Dot espnId={t.espnId} />
                  <span className="max-w-[7rem] truncate sm:max-w-[12rem]">{t.name}</span>
                </span>
              </td>
              {t.weekly.map((w) => {
                const d = w.after - w.before;
                return (
                  <td
                    key={w.week}
                    className={`px-2 py-2 text-right tabular-nums ${netCls(d)}`}
                    title={`${fmt(w.before)} → ${fmt(w.after)}`}
                  >
                    {signed(d)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

type State = { a: number; b: number; aGives: string[]; bGives: string[] };

/** The visitor's chosen franchise, from the same cookie useMyTeamEspnId reads. */
function myTeamFromCookie(): number | null {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${MY_TEAM_COOKIE}=`))
    ?.slice(MY_TEAM_COOKIE.length + 1);
  const n = Number(decodeURIComponent(raw ?? ""));
  return raw && raw !== "none" && Number.isFinite(n) ? n : null;
}

/** Starting trade: a shared link (?a=&b=&ag=&bg=, names split by "|") if there
 *  is one, else the visitor's own team on the left. Only ever runs in the
 *  browser — this component is loaded with ssr: false. */
function initialState(data: TradeCalcData): State {
  const q = new URLSearchParams(window.location.search);
  const valid = (n: number | null) =>
    n != null && data.teams.some((t) => t.espnId === n) ? n : undefined;
  const names = (k: string) => (q.get(k) ? q.get(k)!.split("|") : []);
  const a =
    valid(Number(q.get("a"))) ?? valid(myTeamFromCookie()) ?? data.teams[0].espnId;
  let b = valid(Number(q.get("b"))) ?? data.teams.find((t) => t.espnId !== a)!.espnId;
  if (b === a) b = data.teams.find((t) => t.espnId !== a)!.espnId;
  return { a, b, aGives: names("ag"), bGives: names("bg") };
}

export default function TradeCalculator({ data }: { data: TradeCalcData }) {
  const [state, setState] = useState<State>(() => initialState(data));

  // Keep the URL shareable.
  useEffect(() => {
    const q = new URLSearchParams({ a: String(state.a), b: String(state.b) });
    if (state.aGives.length) q.set("ag", state.aGives.join("|"));
    if (state.bGives.length) q.set("bg", state.bGives.join("|"));
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [state]);

  const teamA = data.teams.find((t) => t.espnId === state.a)!;
  const teamB = data.teams.find((t) => t.espnId === state.b)!;
  const toggle = (side: "aGives" | "bGives", name: string) =>
    setState((s) => ({
      ...s,
      [side]: s[side].includes(name)
        ? s[side].filter((n) => n !== name)
        : [...s[side], name],
    }));

  const result = useMemo(
    () =>
      state.aGives.length && state.bGives.length
        ? evaluateTrade(data, state)
        : null,
    [data, state],
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <RosterPicker
          label="Team 1 gives"
          teams={data.teams}
          team={teamA}
          otherId={state.b}
          selected={state.aGives}
          onTeam={(a) => setState((s) => ({ ...s, a, aGives: [] }))}
          onToggle={(n) => toggle("aGives", n)}
        />
        <RosterPicker
          label="Team 2 gives"
          teams={data.teams}
          team={teamB}
          otherId={state.a}
          selected={state.bGives}
          onTeam={(b) => setState((s) => ({ ...s, b, bGives: [] }))}
          onToggle={(n) => toggle("bGives", n)}
        />
      </div>

      {!result ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted">
          Select at least one player from each team to see the trade played out.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">How it plays out</h2>
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, aGives: [], bGives: [] }))}
              className="text-sm text-muted hover:text-foreground"
            >
              Clear trade
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {result.teams.map((t) => (
              <TeamResult key={t.espnId} t={t} weeks={result.weeks.length} />
            ))}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Lineup points change by week</h3>
            <WeeklyTable teams={result.teams} />
          </div>
        </div>
      )}

      <details className="text-sm text-muted">
        <summary className="cursor-pointer select-none text-foreground">
          How this works
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p>
            Each player&apos;s <span className="text-foreground">pts/gm</span> is
            his season average in games he played, blended with ESPN&apos;s
            projection for this week (worth about three games, so early-season
            and injury-return players lean on the projection).
          </p>
          <p>
            For every remaining regular-season week, both rosters — before and
            after the trade — set their best legal lineup. Players on a bye sit,
            OUT players miss the next week, and IR players are assumed out for
            {" "}{IR_WEEKS} weeks. Any lineup spot the roster can&apos;t fill
            with someone better than a waiver pickup gets one (waiver level:{" "}
            {Object.entries(data.waiver)
              .map(([pos, v]) => `${pos} ${fmt(v)}`)
              .join(", ")}
            ). So a trade is worth what it changes in the lineup: a star who
            would replace a strong starter adds less than one who fills a hole,
            and giving up depth hurts most in bye weeks.
          </p>
          <p>
            If a team ends up over the {data.rosterSize}-player roster limit it
            drops whichever of its own players costs its lineups the fewest
            points over the rest of the season. Expected wins play out the remaining
            schedule against each opponent&apos;s lineup, using this
            season&apos;s spread of weekly scores (±{fmt(data.scoreSd)} pts).
          </p>
        </div>
      </details>
    </div>
  );
}
