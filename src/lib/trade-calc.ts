// Trade calculator engine. Pure functions over getTradeCalcData's payload, run
// in the browser so trying out trades costs no server work.
//
// A trade is judged by what it does to each team's actual lineups for the rest
// of the regular season, not by comparing the players in isolation: every week
// each roster sets its best legal lineup (byes and injuries benched), any slot
// nobody can fill gets a waiver pickup, and the remaining schedule is played
// out against the opponents' lineups to turn points into expected wins.

import type { CalcPlayer, TradeCalcData } from "@/lib/queries";

/** Weeks a player on injured reserve is assumed to miss, counted from the
 *  current week (the NFL's minimum IR stint). */
export const IR_WEEKS = 4;

export type Proposal = {
  a: number; // espn_id
  b: number;
  aGives: string[]; // player names
  bGives: string[];
};

export type LineupSpot = {
  slot: string;
  /** The player in the slot, or null for a waiver pickup. */
  player: CalcPlayer | null;
  pts: number;
};

export type TeamEval = {
  espnId: number;
  name: string;
  gives: CalcPlayer[];
  gets: CalcPlayer[];
  /** Players cut to get back under the roster limit (lowest value first). */
  drops: CalcPlayer[];
  weekly: { week: number; before: number; after: number }[];
  /** Expected starter points per week, before and after, over the weeks. */
  avgBefore: number;
  avgAfter: number;
  totalDelta: number;
  winsBefore: number;
  winsAfter: number;
  /** Full-strength lineup (no byes or injuries), before and after. */
  lineupBefore: LineupSpot[];
  lineupAfter: LineupSpot[];
  /** On-paper value: points per game given up and received. */
  paperGive: number;
  paperGet: number;
};

export type TradeEval = { teams: [TeamEval, TeamEval]; weeks: number[] };

/** Can this player score in this week? Byes and injuries say no. */
function available(p: CalcPlayer, week: number, data: TradeCalcData): boolean {
  if (p.byeWeek === week) return false;
  if (p.injuryStatus === "INJURY_RESERVE" && week < data.currentWeek + IR_WEEKS)
    return false;
  // OUT is this week's status: assume he misses the first week played out.
  if (p.injuryStatus === "OUT" && week === data.weeks[0]) return false;
  return true;
}

/** Waiver-level points for a slot; a flex slot ("RB/WR/TE") takes its best
 *  position. "D/ST" is a position of its own, not a flex. */
function waiverFor(slot: string, data: TradeCalcData): number {
  if (data.waiver[slot] != null) return data.waiver[slot];
  return Math.max(0, ...slot.split("/").map((pos) => data.waiver[pos] ?? 0));
}

/** The best legal lineup from these players. Single-position slots fill first
 *  so a flex slot only takes what's left — with RB/WR/TE flex that greedy fill
 *  is optimal. A slot whose best option is below waiver level gets a pickup. */
export function bestLineup(
  players: CalcPlayer[],
  data: TradeCalcData,
  week: number | null, // null = full strength
): LineupSpot[] {
  const pool = players
    .filter((p) => week == null || available(p, week, data))
    .sort((a, b) => b.value - a.value);
  const used = new Set<string>();
  const order = data.lineup
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => Number(a.slot.includes("/")) - Number(b.slot.includes("/")));
  const spots: LineupSpot[] = new Array(data.lineup.length);
  for (const { slot, i } of order) {
    const best = pool.find((p) => !used.has(p.name) && p.eligible.includes(slot));
    const floor = waiverFor(slot, data);
    if (best && best.value >= floor) {
      used.add(best.name);
      spots[i] = { slot, player: best, pts: best.value };
    } else {
      spots[i] = { slot, player: null, pts: floor };
    }
  }
  return spots;
}

const lineupPts = (spots: LineupSpot[]) => spots.reduce((a, s) => a + s.pts, 0);

/** Lineup points a roster scores over all the weeks being played out. */
function seasonPts(players: CalcPlayer[], data: TradeCalcData): number {
  return sum(data.weeks.map((w) => lineupPts(bestLineup(players, data, w))));
}

/** A roster after a trade, trimmed back to the roster limit. Each cut is the
 *  player it already had (never one it just received) whose loss costs the
 *  fewest lineup points over the remaining weeks — so bye-week cover is kept
 *  — with ties going to the lower-value player. Injured-reserve players don't
 *  count against the limit. */
function tradedRoster(
  players: CalcPlayer[],
  gives: Set<string>,
  gets: CalcPlayer[],
  data: TradeCalcData,
): { roster: CalcPlayer[]; drops: CalcPlayer[] } {
  let roster = [...players.filter((p) => !gives.has(p.name)), ...gets];
  const received = new Set(gets.map((p) => p.name));
  const drops: CalcPlayer[] = [];
  const onIR = (p: CalcPlayer) => p.injuryStatus === "INJURY_RESERVE";
  while (roster.filter((p) => !onIR(p)).length > data.rosterSize) {
    const candidates = roster.filter((p) => !onIR(p) && !received.has(p.name));
    if (candidates.length === 0) break;
    let best: { p: CalcPlayer; pts: number } | null = null;
    for (const p of candidates) {
      const pts = seasonPts(roster.filter((x) => x !== p), data);
      if (
        !best ||
        pts > best.pts + 1e-6 ||
        (Math.abs(pts - best.pts) <= 1e-6 && p.value < best.p.value)
      )
        best = { p, pts };
    }
    drops.push(best!.p);
    roster = roster.filter((x) => x !== best!.p);
  }
  return { roster, drops };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf). */
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function evaluateTrade(data: TradeCalcData, prop: Proposal): TradeEval | null {
  const teamA = data.teams.find((t) => t.espnId === prop.a);
  const teamB = data.teams.find((t) => t.espnId === prop.b);
  if (!teamA || !teamB || prop.a === prop.b) return null;

  const pick = (players: CalcPlayer[], names: string[]) =>
    players.filter((p) => names.includes(p.name));
  const aGives = pick(teamA.players, prop.aGives);
  const bGives = pick(teamB.players, prop.bGives);
  const aAfter = tradedRoster(teamA.players, new Set(prop.aGives), bGives, data);
  const bAfter = tradedRoster(teamB.players, new Set(prop.bGives), aGives, data);

  // Expected lineup points for every team and week, before and after.
  const rosterBefore = new Map(data.teams.map((t) => [t.espnId, t.players]));
  const rosterAfter = new Map(rosterBefore);
  rosterAfter.set(prop.a, aAfter.roster);
  rosterAfter.set(prop.b, bAfter.roster);
  const weekPts = (rosters: Map<number, CalcPlayer[]>) => {
    const out = new Map<string, number>(); // `${espn}:${week}`
    for (const [espnId, players] of rosters)
      for (const w of data.weeks)
        out.set(`${espnId}:${w}`, lineupPts(bestLineup(players, data, w)));
    return out;
  };
  const ptsBefore = weekPts(rosterBefore);
  const ptsAfter = weekPts(rosterAfter);

  // The weekly score difference between two teams has sd √2·σ.
  const diffSd = Math.max(1, data.scoreSd * Math.SQRT2);
  const expectedWins = (espnId: number, pts: Map<string, number>) =>
    sum(
      data.schedule
        .filter((g) => g.home === espnId || g.away === espnId)
        .map((g) => {
          const opp = g.home === espnId ? g.away : g.home;
          const me = pts.get(`${espnId}:${g.week}`) ?? 0;
          const them = pts.get(`${opp}:${g.week}`) ?? 0;
          return phi((me - them) / diffSd);
        }),
    );

  const build = (
    team: typeof teamA,
    gives: CalcPlayer[],
    gets: CalcPlayer[],
    after: { roster: CalcPlayer[]; drops: CalcPlayer[] },
  ): TeamEval => {
    const weekly = data.weeks.map((w) => ({
      week: w,
      before: round1(ptsBefore.get(`${team.espnId}:${w}`) ?? 0),
      after: round1(ptsAfter.get(`${team.espnId}:${w}`) ?? 0),
    }));
    const n = Math.max(1, weekly.length);
    return {
      espnId: team.espnId,
      name: team.name,
      gives,
      gets,
      drops: after.drops,
      weekly,
      avgBefore: round1(sum(weekly.map((w) => w.before)) / n),
      avgAfter: round1(sum(weekly.map((w) => w.after)) / n),
      totalDelta: round1(sum(weekly.map((w) => w.after - w.before))),
      winsBefore: Math.round(expectedWins(team.espnId, ptsBefore) * 100) / 100,
      winsAfter: Math.round(expectedWins(team.espnId, ptsAfter) * 100) / 100,
      lineupBefore: bestLineup(team.players, data, null),
      lineupAfter: bestLineup(after.roster, data, null),
      paperGive: round1(sum(gives.map((p) => p.value))),
      paperGet: round1(sum(gets.map((p) => p.value))),
    };
  };

  return {
    weeks: data.weeks,
    teams: [build(teamA, aGives, bGives, aAfter), build(teamB, bGives, aGives, bAfter)],
  };
}
