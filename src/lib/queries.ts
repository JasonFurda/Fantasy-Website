import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import {
  isPlayoffWeek,
  playoffStartWeek,
  isChampion,
  championshipsFor,
  finalPlacement,
  preseasonPowerRankings,
  divisionsFor,
} from "@/lib/league-config";
import { teamColor } from "@/lib/teams-config";
import { volatility } from "@/lib/volatility";

// The database only changes once a day (GitHub Actions sync runs daily), so read
// results are cached and reused across requests — this is what makes navigation
// feel instant instead of re-querying Supabase (a cold render costs seconds).
// A short TTL made caches expire constantly on this low-traffic site, so most
// visits hit a cold render; an hour is still far fresher than the daily data.
// `cached()` wraps a query function; the cache key is the args plus the label.
const READ_TTL_SECONDS = 3600;
function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  label: string,
): (...args: A) => Promise<R> {
  return unstable_cache(fn, [label], {
    revalidate: READ_TTL_SECONDS,
    tags: ["db"],
  });
}

export type Season = {
  year: number;
  current_week: number;
  is_active: boolean;
};

export type Team = {
  id: number;
  espn_id: number;
  year: number;
  name: string;
  owner: string;
};

export type Matchup = {
  id: number;
  year: number;
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
};

export type Standing = {
  rank: number;
  team: Team;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

function isPlayed(m: Matchup): boolean {
  const hs = m.home_score ?? 0;
  const as = m.away_score ?? 0;
  return !(hs === 0 && as === 0);
}

export const getSeasons = cached(async function getSeasons(): Promise<Season[]> {
  const { data } = await supabase
    .from("seasons")
    .select("year, current_week, is_active")
    .order("year", { ascending: false });
  return (data as Season[]) ?? [];
}, "getSeasons");

export const getTeams = cached(async function getTeams(
  year: number,
): Promise<Team[]> {
  const { data } = await supabase
    .from("teams")
    .select("id, espn_id, year, name, owner")
    .eq("year", year);
  return (data as Team[]) ?? [];
}, "getTeams");

export const getMatchups = cached(async function getMatchups(
  year: number,
): Promise<Matchup[]> {
  const { data } = await supabase
    .from("matchups")
    .select("id, year, week, home_team_id, away_team_id, home_score, away_score")
    .eq("year", year)
    .order("week", { ascending: true });
  return (data as Matchup[]) ?? [];
}, "getMatchups");

export function buildStandings(teams: Team[], matchups: Matchup[]): Standing[] {
  const acc = new Map<
    number,
    Omit<Standing, "rank"> & { team: Team }
  >();
  for (const team of teams) {
    acc.set(team.id, {
      team,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const m of matchups) {
    if (!isPlayed(m)) continue;
    if (isPlayoffWeek(m.year, m.week)) continue; // regular-season records only
    const home = acc.get(m.home_team_id);
    const away = acc.get(m.away_team_id);
    if (!home || !away) continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    home.pointsFor += hs;
    home.pointsAgainst += as;
    away.pointsFor += as;
    away.pointsAgainst += hs;
    if (hs > as) {
      home.wins++;
      away.losses++;
    } else if (as > hs) {
      away.wins++;
      home.losses++;
    } else {
      home.ties++;
      away.ties++;
    }
  }

  return [...acc.values()]
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        a.losses - b.losses ||
        b.pointsFor - a.pointsFor,
    )
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function winPct(s: Standing): number {
  const games = s.wins + s.losses + s.ties;
  if (games === 0) return 0;
  return (s.wins + s.ties * 0.5) / games;
}

/** Aggregate regular-season standings across every season, by franchise (espn_id). */
export const getAllTimeStandings = cached(
  getAllTimeStandingsImpl,
  "getAllTimeStandings",
);
async function getAllTimeStandingsImpl(): Promise<Standing[]> {
  const seasons = await getSeasons();
  if (seasons.length === 0) return [];

  const perYear = await Promise.all(
    seasons.map(async (s) => {
      const [teams, matchups] = await Promise.all([
        getTeams(s.year),
        getMatchups(s.year),
      ]);
      return { year: s.year, standings: buildStandings(teams, matchups) };
    }),
  );

  const latestYear = Math.max(...seasons.map((s) => s.year));
  const agg = new Map<
    number,
    {
      team: Team;
      wins: number;
      losses: number;
      ties: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  >();

  for (const { year, standings } of perYear) {
    for (const st of standings) {
      const espnId = st.team.espn_id;
      let row = agg.get(espnId);
      if (!row) {
        row = {
          team: st.team,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        };
        agg.set(espnId, row);
      }
      row.wins += st.wins;
      row.losses += st.losses;
      row.ties += st.ties;
      row.pointsFor += st.pointsFor;
      row.pointsAgainst += st.pointsAgainst;
      if (year === latestYear) row.team = st.team; // use most recent name/owner
    }
  }

  return [...agg.values()]
    .sort(
      (a, b) =>
        b.wins - a.wins || a.losses - b.losses || b.pointsFor - a.pointsFor,
    )
    .map((r, i) => ({
      rank: i + 1,
      team: { ...r.team, id: r.team.espn_id }, // stable key for the table
      wins: r.wins,
      losses: r.losses,
      ties: r.ties,
      pointsFor: r.pointsFor,
      pointsAgainst: r.pointsAgainst,
    }));
}

export type FraudRow = {
  team: Team;
  record: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number; // 0-100
  pointsFor: number;
  pointsAgainst: number;
  pfPercentile: number;
  paPercentile: number;
  fraudScore: number;
};

export type GameRow = {
  team: Team;
  year: number;
  score: number;
  week: number;
  opponent: Team | null;
  opponentScore: number;
  won: boolean;
  matchupId: number;
};

export type MismanageRow = {
  team: Team;
  record: string;
  pctOptimal: number; // 0-100
  maxPoints: number;
  actualPoints: number;
  pointsLeft: number;
  avgPerWeek: number;
  weeks: number;
};

export type YearStats = {
  fraud: FraudRow[];
  club200: GameRow[];
  subClub: GameRow[];
  mismanage: MismanageRow[];
};

type OptPlayer = { points: number; eligible: string[]; slot: string; isBench: boolean };

/** Best possible starting points given the slots the team actually started. */
function optimalPoints(players: OptPlayer[]): number {
  const width = (s: string) => s.split("/").length;
  const slots = players
    .filter((p) => !p.isBench)
    .map((p) => ({ slot: p.slot, w: width(p.slot), filled: false }));
  const cands = [...players].sort((a, b) => b.points - a.points);
  let total = 0;
  for (const p of cands) {
    let best: (typeof slots)[number] | null = null;
    for (const s of slots) {
      if (s.filled) continue;
      if (p.eligible.includes(s.slot) && (!best || s.w < best.w)) best = s;
    }
    if (best) {
      best.filled = true;
      total += p.points;
    }
  }
  return total;
}

/** Season-level stat leaderboards for one year. */
export const getYearStats = cached(getYearStatsImpl, "getYearStats");
async function getYearStatsImpl(year: number): Promise<YearStats> {
  const [teams, matchups] = await Promise.all([
    getTeams(year),
    getMatchups(year),
  ]);
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));
  const standings = buildStandings(teams, matchups); // regular season

  // --- Fraud Watch (matches the original formula) ---
  const pfs = standings.map((s) => s.pointsFor);
  const pas = standings.map((s) => s.pointsAgainst);
  const minPF = Math.min(...pfs);
  const maxPF = Math.max(...pfs);
  const minPA = Math.min(...pas);
  const maxPA = Math.max(...pas);
  const pct = (v: number, lo: number, hi: number) =>
    hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50;

  const fraud: FraudRow[] = standings
    .map((s) => {
      const games = s.wins + s.losses + s.ties;
      const winPct = games ? (s.wins / games) * 100 : 0;
      const pfPercentile = pct(s.pointsFor, minPF, maxPF);
      const paPercentile = pct(s.pointsAgainst, minPA, maxPA);
      return {
        team: s.team,
        record: `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        winPct,
        pointsFor: s.pointsFor,
        pointsAgainst: s.pointsAgainst,
        pfPercentile,
        paPercentile,
        fraudScore: winPct - pfPercentile * 0.75 - paPercentile * 0.5,
      };
    })
    .sort((a, b) => b.fraudScore - a.fraudScore);

  // --- 200 Club / Sub-100 Club (single-game team scores, all weeks) ---
  const games: GameRow[] = [];
  for (const m of matchups) {
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    if (hs === 0 && as === 0) continue; // unplayed
    const home = teamById.get(m.home_team_id) ?? null;
    const away = teamById.get(m.away_team_id) ?? null;
    games.push({
      team: home!,
      year,
      score: hs,
      week: m.week,
      opponent: away,
      opponentScore: as,
      won: hs > as,
      matchupId: m.id,
    });
    games.push({
      team: away!,
      year,
      score: as,
      week: m.week,
      opponent: home,
      opponentScore: hs,
      won: as > hs,
      matchupId: m.id,
    });
  }
  const club200 = games
    .filter((g) => g.team && g.score >= 200)
    .sort((a, b) => b.score - a.score);
  const subClub = games
    .filter((g) => g.team && g.score > 0 && g.score < 100)
    .sort((a, b) => a.score - b.score);

  // --- Mismanagement (% of optimal points) ---
  // All played weeks, including playoffs (mismanagement spans the whole season).
  const playedIds = matchups
    .filter((m) => (m.home_score ?? 0) !== 0 || (m.away_score ?? 0) !== 0)
    .map((m) => m.id);
  const matchupSide = new Map<number, { home: number; away: number }>();
  for (const m of matchups) {
    matchupSide.set(m.id, { home: m.home_team_id, away: m.away_team_id });
  }

  const recordByTeam = new Map<number, string>(
    standings.map((s) => [
      s.team.id,
      `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`,
    ]),
  );

  // teamId -> { week -> OptPlayer[] }
  const teamWeeks = new Map<number, Map<number, OptPlayer[]>>();
  const weekByMatchup = new Map<number, number>(
    matchups.map((m) => [m.id, m.week]),
  );

  if (playedIds.length > 0) {
    type SlotQueryRow = {
      matchup_id: number;
      team_side: "home" | "away";
      points: number | null;
      slot: string;
      is_bench: boolean | null;
      eligible_slots: string[] | null;
    };
    // Fetch in matchup-id chunks to stay under the 1000-row response cap.
    const rows: SlotQueryRow[] = [];
    const CHUNK = 20;
    const chunks: number[][] = [];
    for (let i = 0; i < playedIds.length; i += CHUNK)
      chunks.push(playedIds.slice(i, i + CHUNK));
    const results = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from("player_slots")
          .select("matchup_id, team_side, points, slot, is_bench, eligible_slots")
          .in("matchup_id", chunk),
      ),
    );
    for (const { data } of results) if (data) rows.push(...(data as SlotQueryRow[]));

    for (const r of rows) {
      const sides = matchupSide.get(r.matchup_id);
      if (!sides) continue;
      const teamId = r.team_side === "home" ? sides.home : sides.away;
      const week = weekByMatchup.get(r.matchup_id) ?? 0;
      let wm = teamWeeks.get(teamId);
      if (!wm) {
        wm = new Map();
        teamWeeks.set(teamId, wm);
      }
      const arr = wm.get(week) ?? [];
      arr.push({
        points: Number(r.points ?? 0),
        eligible: Array.isArray(r.eligible_slots) ? r.eligible_slots : [],
        slot: r.slot,
        isBench: !!r.is_bench,
      });
      wm.set(week, arr);
    }
  }

  const mismanage: MismanageRow[] = [];
  for (const [teamId, weeks] of teamWeeks) {
    const team = teamById.get(teamId);
    if (!team) continue;
    let actual = 0;
    let optimal = 0;
    for (const players of weeks.values()) {
      actual += players
        .filter((p) => !p.isBench)
        .reduce((a, p) => a + p.points, 0);
      optimal += optimalPoints(players);
    }
    const pointsLeft = optimal - actual;
    mismanage.push({
      team,
      record: recordByTeam.get(teamId) ?? "",
      pctOptimal: optimal > 0 ? (actual / optimal) * 100 : 100,
      maxPoints: optimal,
      actualPoints: actual,
      pointsLeft,
      avgPerWeek: weeks.size ? pointsLeft / weeks.size : 0,
      weeks: weeks.size,
    });
  }
  mismanage.sort((a, b) => a.pctOptimal - b.pctOptimal); // worst first

  return { fraud, club200, subClub, mismanage };
}

/** All-time aggregation of the year-stat leaderboards across every season. */
export const getAllTimeStats = cached(getAllTimeStatsImpl, "getAllTimeStats");
async function getAllTimeStatsImpl(): Promise<YearStats> {
  const seasons = await getSeasons(); // newest first
  const per = await Promise.all(seasons.map((s) => getYearStats(s.year)));

  // Clubs: just combine every season's single-game feats.
  const club200 = per
    .flatMap((p) => p.club200)
    .sort((a, b) => b.score - a.score);
  const subClub = per
    .flatMap((p) => p.subClub)
    .sort((a, b) => a.score - b.score);

  // Fraud: aggregate W-L and PF/PA by franchise, then recompute percentiles.
  type FAgg = {
    team: Team;
    wins: number;
    losses: number;
    ties: number;
    pf: number;
    pa: number;
  };
  const fMap = new Map<number, FAgg>();
  for (const p of per) {
    for (const f of p.fraud) {
      const id = f.team.espn_id;
      let a = fMap.get(id);
      if (!a) {
        a = { team: f.team, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };
        fMap.set(id, a); // first seen = latest season (per is newest first)
      }
      a.wins += f.wins;
      a.losses += f.losses;
      a.ties += f.ties;
      a.pf += f.pointsFor;
      a.pa += f.pointsAgainst;
    }
  }
  const fAggs = [...fMap.values()];
  const pfs = fAggs.map((a) => a.pf);
  const pas = fAggs.map((a) => a.pa);
  const minPF = Math.min(...pfs);
  const maxPF = Math.max(...pfs);
  const minPA = Math.min(...pas);
  const maxPA = Math.max(...pas);
  const pct = (v: number, lo: number, hi: number) =>
    hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50;
  const fraud: FraudRow[] = fAggs
    .map((a) => {
      const games = a.wins + a.losses + a.ties;
      const winPct = games ? (a.wins / games) * 100 : 0;
      const pfPercentile = pct(a.pf, minPF, maxPF);
      const paPercentile = pct(a.pa, minPA, maxPA);
      return {
        team: a.team,
        record: `${a.wins}-${a.losses}${a.ties ? `-${a.ties}` : ""}`,
        wins: a.wins,
        losses: a.losses,
        ties: a.ties,
        winPct,
        pointsFor: a.pf,
        pointsAgainst: a.pa,
        pfPercentile,
        paPercentile,
        fraudScore: winPct - pfPercentile * 0.75 - paPercentile * 0.5,
      };
    })
    .sort((a, b) => b.fraudScore - a.fraudScore);

  // Mismanagement: aggregate optimal/actual/weeks by franchise.
  type MAgg = {
    team: Team;
    actual: number;
    max: number;
    weeks: number;
    record: string;
  };
  const mMap = new Map<number, MAgg>();
  for (const p of per) {
    for (const m of p.mismanage) {
      const id = m.team.espn_id;
      let a = mMap.get(id);
      if (!a) {
        a = { team: m.team, actual: 0, max: 0, weeks: 0, record: "" };
        mMap.set(id, a);
      }
      a.actual += m.actualPoints;
      a.max += m.maxPoints;
      a.weeks += m.weeks;
    }
  }
  const recordByEspn = new Map(
    fAggs.map((a) => [
      a.team.espn_id,
      `${a.wins}-${a.losses}${a.ties ? `-${a.ties}` : ""}`,
    ]),
  );
  const mismanage: MismanageRow[] = [...mMap.values()]
    .map((a) => {
      const pointsLeft = a.max - a.actual;
      return {
        team: a.team,
        record: recordByEspn.get(a.team.espn_id) ?? "",
        pctOptimal: a.max > 0 ? (a.actual / a.max) * 100 : 100,
        maxPoints: a.max,
        actualPoints: a.actual,
        pointsLeft,
        avgPerWeek: a.weeks ? pointsLeft / a.weeks : 0,
        weeks: a.weeks,
      };
    })
    .sort((a, b) => a.pctOptimal - b.pctOptimal);

  return { fraud, club200, subClub, mismanage };
}

export type PerfPoint = {
  week: number;
  score: number;
  opponentName: string | null;
  opponentScore: number;
  won: boolean;
  isPlayoff: boolean;
};

export type PerfSeries = {
  team: Team;
  color: string;
  points: PerfPoint[]; // week-ordered, only weeks this team played
};

export type YearPerformance = {
  year: number;
  weeks: number[]; // sorted unique played weeks
  playoffStartWeek: number;
  series: PerfSeries[];
};

/** Every team's weekly score across a full season (regular season + playoffs). */
export const getYearPerformance = cached(
  getYearPerformanceImpl,
  "getYearPerformance",
);
async function getYearPerformanceImpl(
  year: number,
): Promise<YearPerformance> {
  const [teams, matchups] = await Promise.all([
    getTeams(year),
    getMatchups(year),
  ]);
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));

  const byTeam = new Map<number, PerfPoint[]>();
  const weeks = new Set<number>();
  const push = (
    tid: number,
    week: number,
    score: number,
    opp: Team | null,
    oppScore: number,
  ) => {
    const arr = byTeam.get(tid) ?? [];
    arr.push({
      week,
      score,
      opponentName: opp ? opp.name.trim() : null,
      opponentScore: oppScore,
      won: score > oppScore,
      isPlayoff: isPlayoffWeek(year, week),
    });
    byTeam.set(tid, arr);
  };

  for (const m of matchups) {
    if (!isPlayed(m)) continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const home = teamById.get(m.home_team_id) ?? null;
    const away = teamById.get(m.away_team_id) ?? null;
    push(m.home_team_id, m.week, hs, away, as);
    push(m.away_team_id, m.week, as, home, hs);
    weeks.add(m.week);
  }

  const series: PerfSeries[] = [...byTeam.entries()]
    .map(([tid, points]) => {
      const team = teamById.get(tid)!;
      return {
        team,
        color: teamColor(team.espn_id),
        points: points.sort((a, b) => a.week - b.week),
      };
    })
    .filter((s) => s.team)
    .sort((a, b) => a.team.name.trim().localeCompare(b.team.name.trim()));

  return {
    year,
    weeks: [...weeks].sort((a, b) => a - b),
    playoffStartWeek: playoffStartWeek(year),
    series,
  };
}

export type PlayerCompRow = {
  name: string;
  fantasyTeam: { name: string; espnId: number } | null;
  nflTeam: string;
  games: number;
  totalPts: number;
  avgPts: number;
  variance: number; // over weeks played
  sd: number;
  cv: number | null;
  consistency: number | null; // 0-100, higher = steadier
  floor: number | null; // 20th-pctile week
  ceiling: number | null; // 80th-pctile week
  bustPct: number | null;
  boomPct: number | null;
  s: Record<string, number>; // summed raw NFL stats
};

const COMP_STAT_KEYS = [
  "receivingTargets",
  "receivingReceptions",
  "receivingYards",
  "receivingTouchdowns",
  "rushingAttempts",
  "rushingYards",
  "rushingTouchdowns",
  "passingYards",
  "passingTouchdowns",
  "passingInterceptions",
  "passingCompletions",
  "passingAttempts",
  "lostFumbles",
  "madeFieldGoals",
  "attemptedFieldGoals",
  "madeExtraPoints",
  "defensiveSacks",
  "defensiveInterceptions",
  "defensiveTouchdowns",
  "defensivePointsAllowed",
];

/** Per-player season aggregates for one position, ranked by total fantasy points. */
export const getPlayerComparison = cached(
  getPlayerComparisonImpl,
  "getPlayerComparison",
);
async function getPlayerComparisonImpl(
  year: number,
  position: string,
): Promise<PlayerCompRow[]> {
  const [matchups, teams] = await Promise.all([
    getMatchups(year),
    getTeams(year),
  ]);
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));
  const sideOf = new Map<number, { home: number; away: number }>();
  for (const m of matchups)
    sideOf.set(m.id, { home: m.home_team_id, away: m.away_team_id });
  const ids = matchups.map((m) => m.id);
  if (ids.length === 0) return [];

  type Raw = {
    player_name: string;
    pro_team: string | null;
    points: number | null;
    game_played: number | null;
    is_bench: boolean | null;
    team_side: "home" | "away";
    matchup_id: number;
    stats: Record<string, number> | null;
  };

  const rows: Raw[] = [];
  const CHUNK = 20;
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  // player_slots (per-week) and player_season (season totals) are independent —
  // fetch them together so a cold render doesn't pay for them back to back.
  const [chunkResults, psRes] = await Promise.all([
    Promise.all(
      chunks.map((chunk) =>
        supabase
          .from("player_slots")
          .select(
            "player_name, pro_team, points, game_played, is_bench, team_side, matchup_id, stats",
          )
          .eq("position", position)
          .in("matchup_id", chunk),
      ),
    ),
    supabase
      .from("player_season")
      .select("player_name, pro_team, total_points, games, stats")
      .eq("year", year)
      .eq("position", position),
  ]);
  for (const { data } of chunkResults) {
    if (data) rows.push(...(data as Raw[]));
  }

  type Agg = {
    name: string;
    pts: number;
    weekly: number[];
    played: number[]; // points in weeks the player actually played (game_played>0)
    games: number;
    s: Record<string, number>;
    teamCounts: Map<number, number>;
    proCounts: Map<string, number>;
  };
  const byPlayer = new Map<string, Agg>();

  for (const r of rows) {
    let a = byPlayer.get(r.player_name);
    if (!a) {
      a = {
        name: r.player_name,
        pts: 0,
        weekly: [],
        played: [],
        games: 0,
        s: {},
        teamCounts: new Map(),
        proCounts: new Map(),
      };
      byPlayer.set(r.player_name, a);
    }
    const pts = Number(r.points ?? 0);
    a.pts += pts;
    a.weekly.push(pts);
    if ((r.game_played ?? 0) > 0) {
      a.games += 1;
      a.played.push(pts);
    }
    const st = r.stats ?? {};
    for (const k of COMP_STAT_KEYS) {
      const v = Number(st[k] ?? 0);
      if (v) a.s[k] = (a.s[k] ?? 0) + v;
    }
    const sides = sideOf.get(r.matchup_id);
    if (sides) {
      const tid = r.team_side === "home" ? sides.home : sides.away;
      a.teamCounts.set(tid, (a.teamCounts.get(tid) ?? 0) + 1);
    }
    if (r.pro_team)
      a.proCounts.set(r.pro_team, (a.proCounts.get(r.pro_team) ?? 0) + 1);
  }

  const mode = <T,>(m: Map<T, number>): T | null => {
    let best: T | null = null;
    let n = -1;
    for (const [k, c] of m)
      if (c > n) {
        n = c;
        best = k;
      }
    return best;
  };

  // Full-season totals + stats for everyone (rostered + free agents).
  const ps = (psRes.data ?? []) as {
    player_name: string;
    pro_team: string;
    total_points: number;
    games: number;
    stats: Record<string, number> | null;
  }[];

  // Weeks a player scored while NOT on a fantasy roster (waiver wire). Merged
  // with roster weeks so volatility reflects the player's full weekly game log,
  // not just the weeks they happened to be rostered.
  const psNames = ps.map((r) => r.player_name);
  const faByPlayer = new Map<string, number[]>();
  if (psNames.length > 0) {
    const NCHUNK = 200;
    const nameChunks: string[][] = [];
    for (let i = 0; i < psNames.length; i += NCHUNK)
      nameChunks.push(psNames.slice(i, i + NCHUNK));
    const faResults = await Promise.all(
      nameChunks.map((names) =>
        supabase
          .from("free_agent_week")
          .select("player_name, points")
          .eq("year", year)
          .in("player_name", names),
      ),
    );
    for (const { data } of faResults) {
      for (const r of (data ?? []) as {
        player_name: string;
        points: number | null;
      }[]) {
        const arr = faByPlayer.get(r.player_name) ?? [];
        arr.push(Number(r.points ?? 0));
        faByPlayer.set(r.player_name, arr);
      }
    }
  }

  const out: PlayerCompRow[] = ps.map((r) => {
    const a = byPlayer.get(r.player_name);
    let fantasyTeam: { name: string; espnId: number } | null = null;
    if (a) {
      const tid = mode(a.teamCounts);
      const team = tid != null ? teamById.get(tid) : null;
      if (team) fantasyTeam = { name: team.name.trim(), espnId: team.espn_id };
    }
    const playedAll = [
      ...(a?.played ?? []),
      ...(faByPlayer.get(r.player_name) ?? []),
    ];
    const vol = volatility(playedAll, position);
    const games = r.games || 0;
    const totalPts = Number(r.total_points);
    return {
      name: r.player_name,
      fantasyTeam,
      nflTeam: r.pro_team,
      games,
      totalPts,
      avgPts: games ? totalPts / games : 0,
      variance: vol.variance,
      sd: vol.sd,
      cv: vol.cv,
      consistency: vol.consistency,
      floor: vol.floor,
      ceiling: vol.ceiling,
      bustPct: vol.bustPct,
      boomPct: vol.boomPct,
      s: r.stats ?? {},
    };
  });

  return out.sort((x, y) => y.totalPts - x.totalPts);
}

export type PlayerWeekPoint = {
  week: number;
  points: number;
  dnp: boolean; // no game that week (inactive / not on a roster or wire)
  freeAgent: boolean; // was on the waiver wire that week
  bye: boolean; // the player's NFL team was on bye
  injury: string | null; // injury tag for the week (live season only), else null
};

export type PlayerSeasonLine = {
  year: number;
  position: string;
  nflTeam: string;
  games: number;
  totalPts: number;
  avgPts: number;
  s: Record<string, number>; // summed raw NFL stats
};

export type NflMate = {
  name: string;
  targets: number;
  points: number;
  isSelf: boolean;
};

export type PlayerDetail = {
  name: string;
  position: string;
  nflTeam: string;
  fantasyTeam: { name: string; espnId: number } | null;
  year: number; // season the weekly chart covers
  weekly: PlayerWeekPoint[]; // week 1..maxWeek
  avg: number; // this player's average over weeks played
  bestWeek: PlayerWeekPoint | null;
  seasons: PlayerSeasonLine[]; // newest first, every season on record
  nflShare: { nflTeam: string; mates: NflMate[] } | null; // teammates' target/points split
};

export type PlayerName = { name: string; position: string };

/** Every distinct player on record (for the compare picker), with their most
 *  recent position. Sorted by name. */
export const getAllPlayerNames = cached(async function getAllPlayerNames(): Promise<
  PlayerName[]
> {
  const { data } = await supabase
    .from("player_season")
    .select("player_name, position, year")
    .order("year", { ascending: false });
  const seen = new Map<string, string>();
  for (const r of (data ?? []) as {
    player_name: string;
    position: string | null;
    year: number;
  }[]) {
    if (r.player_name && !seen.has(r.player_name))
      seen.set(r.player_name, r.position ?? "");
  }
  return [...seen.entries()]
    .map(([name, position]) => ({ name, position }))
    .sort((a, b) => a.name.localeCompare(b.name));
}, "getAllPlayerNames");

/** Short weekly injury tag, or null when healthy / unknown. */
function injuryTag(status: string | null | undefined): string | null {
  const s = (status ?? "").toUpperCase();
  if (!s || s === "ACTIVE" || s === "NORMAL") return null;
  const map: Record<string, string> = {
    QUESTIONABLE: "Q",
    DOUBTFUL: "D",
    OUT: "OUT",
    INJURY_RESERVE: "IR",
    SUSPENSION: "SUS",
    DAY_TO_DAY: "DTD",
  };
  return map[s] ?? s.slice(0, 3);
}

/** Everything for one player's detail window: header, weekly scoring for the
 *  season, season-by-season stat lines, and their share of the NFL team. */
export const getPlayerDetail = cached(getPlayerDetailImpl, "getPlayerDetail");
async function getPlayerDetailImpl(
  name: string,
  year: number,
): Promise<PlayerDetail | null> {
  const [matchups, teams, allSeasons, { data: psRaw }] = await Promise.all([
    getMatchups(year),
    getTeams(year),
    getSeasons(),
    supabase
      .from("player_season")
      .select("year, position, pro_team, total_points, games, stats")
      .eq("player_name", name)
      .order("year", { ascending: false }),
  ]);
  // Injury status is only per-week accurate for the live (in-progress) season;
  // past seasons carry a single end-of-year snapshot, so we suppress it there.
  const injuryLive = allSeasons.find((s) => s.year === year)?.is_active ?? false;

  const seasons: PlayerSeasonLine[] = (
    (psRaw ?? []) as {
      year: number;
      position: string | null;
      pro_team: string | null;
      total_points: number | null;
      games: number | null;
      stats: Record<string, number> | null;
    }[]
  ).map((r) => {
    const games = Number(r.games ?? 0);
    const totalPts = Number(r.total_points ?? 0);
    return {
      year: Number(r.year),
      position: r.position ?? "",
      nflTeam: r.pro_team ?? "",
      games,
      totalPts,
      avgPts: games ? totalPts / games : 0,
      s: r.stats ?? {},
    };
  });

  const thisSeason = seasons.find((s) => s.year === year) ?? seasons[0] ?? null;
  const position = thisSeason?.position ?? "";
  const nflTeam = thisSeason?.nflTeam ?? "";

  const weekByMatchup = new Map<number, number>(
    matchups.map((m) => [m.id, m.week]),
  );
  const sideTeam = new Map<number, { home: number; away: number }>();
  for (const m of matchups)
    sideTeam.set(m.id, { home: m.home_team_id, away: m.away_team_id });
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));
  const ids = matchups.map((m) => m.id);

  const wk = new Map<
    number,
    { points: number; freeAgent: boolean; bye: boolean; injury: string | null }
  >();
  const teamCount = new Map<number, number>();
  const CHUNK = 20;
  const slotChunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK)
    slotChunks.push(ids.slice(i, i + CHUNK));
  // Every independent per-player read runs concurrently (including the heavier
  // NFL-share comparison) so a cold render is one round-trip deep, not five.
  const [slotResults, faRes, byeResults, comp] = await Promise.all([
    Promise.all(
      slotChunks.map((chunk) =>
        supabase
          .from("player_slots")
          .select("matchup_id, team_side, points, is_bye, injury_status")
          .eq("player_name", name)
          .in("matchup_id", chunk),
      ),
    ),
    supabase
      .from("free_agent_week")
      .select("week, points")
      .eq("year", year)
      .eq("player_name", name),
    nflTeam
      ? Promise.all(
          slotChunks.map((chunk) =>
            supabase
              .from("player_slots")
              .select("matchup_id")
              .eq("pro_team", nflTeam)
              .eq("is_bye", true)
              .in("matchup_id", chunk),
          ),
        )
      : Promise.resolve(
          [] as { data: { matchup_id: number }[] | null }[],
        ),
    ["WR", "RB", "TE"].includes(position) && nflTeam
      ? getPlayerComparison(year, position)
      : Promise.resolve(null),
  ]);

  for (const { data } of slotResults) {
    for (const r of (data ?? []) as {
      matchup_id: number;
      team_side: "home" | "away";
      points: number | null;
      is_bye: boolean | null;
      injury_status: string | null;
    }[]) {
      const week = weekByMatchup.get(r.matchup_id);
      if (week == null) continue;
      wk.set(week, {
        points: Number(r.points ?? 0),
        freeAgent: false,
        bye: !!r.is_bye,
        injury: injuryLive ? injuryTag(r.injury_status) : null,
      });
      const sides = sideTeam.get(r.matchup_id);
      const tid = sides
        ? r.team_side === "home"
          ? sides.home
          : sides.away
        : null;
      if (tid != null) teamCount.set(tid, (teamCount.get(tid) ?? 0) + 1);
    }
  }

  for (const r of (faRes.data ?? []) as {
    week: number;
    points: number | null;
  }[]) {
    const week = Number(r.week);
    if (!wk.has(week))
      wk.set(week, {
        points: Number(r.points ?? 0),
        freeAgent: true,
        bye: false,
        injury: null,
      });
  }

  // The player's NFL team bye week(s), from any rostered player of that team —
  // so a bye is labeled even in weeks this player wasn't rostered.
  const teamByeWeeks = new Set<number>();
  for (const { data } of byeResults)
    for (const r of (data ?? []) as { matchup_id: number }[]) {
      const w = weekByMatchup.get(r.matchup_id);
      if (w != null) teamByeWeeks.add(w);
    }

  // Most-frequent fantasy team that rostered them this season → header label.
  let fantasyTeam: { name: string; espnId: number } | null = null;
  let bestTid: number | null = null;
  let bestN = -1;
  for (const [tid, cnt] of teamCount)
    if (cnt > bestN) {
      bestN = cnt;
      bestTid = tid;
    }
  if (bestTid != null) {
    const t = teamById.get(bestTid);
    if (t) fantasyTeam = { name: t.name.trim(), espnId: t.espn_id };
  }

  const maxWeek = matchups.reduce((a, m) => Math.max(a, m.week), 0);
  const weekly: PlayerWeekPoint[] = [];
  for (let w = 1; w <= maxWeek; w++) {
    const e = wk.get(w);
    weekly.push({
      week: w,
      points: e ? e.points : 0,
      dnp: !e,
      freeAgent: e?.freeAgent ?? false,
      bye: (e?.bye ?? false) || teamByeWeeks.has(w),
      injury: e?.injury ?? null,
    });
  }
  // Bye weeks are not "did not play" volatility — exclude them from the metrics.
  const played = weekly.filter((x) => !x.dnp && !x.bye);
  if (seasons.length === 0 && played.length === 0) return null;

  const avg = played.length
    ? played.reduce((a, x) => a + x.points, 0) / played.length
    : 0;
  const bestWeek = played.length
    ? played.reduce((a, x) => (x.points > a.points ? x : a))
    : null;

  // Share of the NFL team's targets/points among fantasy-relevant teammates.
  let nflShare: PlayerDetail["nflShare"] = null;
  if (comp && nflTeam) {
    const mates = comp
      .filter((c) => c.nflTeam === nflTeam)
      .map((c) => ({
        name: c.name,
        targets: c.s.receivingTargets || 0,
        points: c.totalPts,
        isSelf: c.name === name,
      }))
      .sort((a, b) => b.points - a.points);
    if (mates.length) nflShare = { nflTeam, mates };
  }

  return {
    name,
    position,
    nflTeam,
    fantasyTeam,
    year,
    weekly,
    avg,
    bestWeek,
    seasons,
    nflShare,
  };
}

export type DraftValueRow = {
  name: string;
  position: string;
  fantasyTeam: { name: string; espnId: number } | null;
  originalDrafter: { name: string; espnId: number } | null;
  nflTeam: string;
  totalPts: number;
  round: number;
  pick: number;
  overall: number;
  value: number;
};

/** Draft Pick Value for TE/RB/WR: value = (total points)^2 * sqrt(draft position). */
export const getDraftValue = cached(getDraftValueImpl, "getDraftValue");
async function getDraftValueImpl(year: number): Promise<DraftValueRow[]> {
  const yearTeams = await getTeams(year);
  const teamCount = yearTeams.length || 8;
  const nameByEspn = new Map<number, string>(
    yearTeams.map((t) => [t.espn_id, t.name.trim()]),
  );

  const positions = ["WR", "RB", "TE"];
  const compByPos = await Promise.all(
    positions.map((p) => getPlayerComparison(year, p)),
  );
  const players = new Map<
    string,
    { pos: string; row: PlayerCompRow }
  >();
  compByPos.forEach((rows, idx) => {
    for (const r of rows) {
      if (!players.has(r.name)) players.set(r.name, { pos: positions[idx], row: r });
    }
  });

  const { data: draftRaw } = await supabase
    .from("draft_picks")
    .select("player_name, round, pick, drafted_by")
    .eq("year", year);
  const draft = (draftRaw ?? []) as {
    player_name: string;
    round: number;
    pick: number;
    drafted_by: number | null;
  }[];

  const out: DraftValueRow[] = [];
  for (const d of draft) {
    const p = players.get(d.player_name);
    if (!p) continue; // not a TE/RB/WR who appeared
    const overall = (d.round - 1) * teamCount + d.pick;
    const value = (Math.pow(p.row.totalPts, 2) * Math.sqrt(overall)) / 1000;
    const drafter =
      d.drafted_by != null && nameByEspn.has(d.drafted_by)
        ? { name: nameByEspn.get(d.drafted_by)!, espnId: d.drafted_by }
        : null;
    out.push({
      name: d.player_name,
      position: p.pos,
      fantasyTeam: p.row.fantasyTeam,
      originalDrafter: drafter,
      nflTeam: p.row.nflTeam,
      totalPts: p.row.totalPts,
      round: d.round,
      pick: d.pick,
      overall,
      value,
    });
  }
  return out.sort((a, b) => b.value - a.value);
}

export type SlotRow = {
  slot: string;
  playerName: string;
  proTeam: string | null;
  opponent: string | null;
  points: number;
  projected: number | null;
  isBench: boolean;
  side: "home" | "away";
};

export type MatchupDetail = {
  id: number;
  year: number;
  week: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number;
  awayScore: number;
  homeProjected: number | null;
  awayProjected: number | null;
  away: { starters: SlotRow[]; bench: SlotRow[] };
  home: { starters: SlotRow[]; bench: SlotRow[] };
};

export const getMatchupDetail = cached(getMatchupDetailImpl, "getMatchupDetail");
async function getMatchupDetailImpl(
  matchupId: number,
): Promise<MatchupDetail | null> {
  const { data: mRaw } = await supabase
    .from("matchups")
    .select(
      "id, year, week, home_team_id, away_team_id, home_score, away_score, home_projected, away_projected",
    )
    .eq("id", matchupId)
    .maybeSingle();
  if (!mRaw) return null;
  const m = mRaw as {
    id: number;
    year: number;
    week: number;
    home_team_id: number;
    away_team_id: number;
    home_score: number | null;
    away_score: number | null;
    home_projected: number | null;
    away_projected: number | null;
  };

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, espn_id, year, name, owner")
    .in("id", [m.home_team_id, m.away_team_id]);
  const teams = (teamRows as Team[]) ?? [];
  const homeTeam = teams.find((t) => t.id === m.home_team_id) ?? null;
  const awayTeam = teams.find((t) => t.id === m.away_team_id) ?? null;

  const { data: slotRaw } = await supabase
    .from("player_slots")
    .select(
      "team_side, slot, player_name, pro_team, opponent, points, projected, is_bench, sort_idx",
    )
    .eq("matchup_id", matchupId)
    .order("sort_idx", { ascending: true });

  const rows = (slotRaw ?? []) as {
    team_side: "home" | "away";
    slot: string;
    player_name: string;
    pro_team: string | null;
    opponent: string | null;
    points: number | null;
    projected: number | null;
    is_bench: boolean | null;
  }[];

  const make = (side: "home" | "away") => {
    const all = rows
      .filter((r) => r.team_side === side)
      .map<SlotRow>((r) => ({
        slot: r.slot,
        playerName: r.player_name,
        proTeam: r.pro_team,
        opponent: r.opponent,
        points: Number(r.points ?? 0),
        projected: r.projected == null ? null : Number(r.projected),
        isBench: !!r.is_bench,
        side,
      }));
    return {
      starters: all.filter((r) => !r.isBench),
      bench: all.filter((r) => r.isBench),
    };
  };

  return {
    id: m.id,
    year: m.year,
    week: m.week,
    homeTeam,
    awayTeam,
    homeScore: Number(m.home_score ?? 0),
    awayScore: Number(m.away_score ?? 0),
    homeProjected: m.home_projected == null ? null : Number(m.home_projected),
    awayProjected: m.away_projected == null ? null : Number(m.away_projected),
    away: make("away"),
    home: make("home"),
  };
}

export type OptimalRosterPlayer = {
  slot: string;
  playerName: string;
  position: string;
  proTeam: string | null;
  points: number;
  teamName: string | null; // owning fantasy team; null = free agent
  teamEspnId: number | null; // for the team color dot; null = free agent
};

export type WeekOptimalRoster = {
  year: number;
  week: number;
  slots: OptimalRosterPlayer[]; // canonical slot order
  total: number;
  fromFreeAgents: number; // how many starters came off the waiver wire
  freeAgentPoints: number; // points those free agents contributed
};

// Canonical display/sort order for starting slots.
const SLOT_ORDER = ["QB", "RB", "WR", "TE", "RB/WR", "RB/WR/TE", "OP", "D/ST", "K"];
// Fallback eligibility by position, if a row is missing eligible_slots.
const POS_ELIGIBLE: Record<string, string[]> = {
  QB: ["QB", "OP"],
  RB: ["RB", "RB/WR", "RB/WR/TE", "OP"],
  WR: ["WR", "RB/WR", "WR/TE", "RB/WR/TE", "OP"],
  TE: ["TE", "WR/TE", "RB/WR/TE", "OP"],
  K: ["K"],
  "D/ST": ["D/ST"],
};

type PoolCand = {
  name: string;
  position: string;
  proTeam: string | null;
  points: number;
  eligible: string[];
  teamId: number | null; // null = free agent
};

/**
 * The single best possible starting lineup for one week, drawn from EVERY
 * player in the league that week — all teams' rosters (starters + bench, IR
 * excluded) plus free agents on the waiver wire. Greedy by points, assigning
 * each player to the narrowest eligible open slot.
 */
export const getWeekOptimalRoster = cached(
  getWeekOptimalRosterImpl,
  "getWeekOptimalRoster",
);
async function getWeekOptimalRosterImpl(
  year: number,
  week: number,
): Promise<WeekOptimalRoster | null> {
  const [teams, matchups] = await Promise.all([
    getTeams(year),
    getMatchups(year),
  ]);
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));
  const weekMatchups = matchups.filter((m) => m.week === week);
  if (weekMatchups.length === 0) return null;

  const sideTeam = new Map<number, { home: number; away: number }>();
  for (const m of weekMatchups)
    sideTeam.set(m.id, { home: m.home_team_id, away: m.away_team_id });
  const ids = weekMatchups.map((m) => m.id);

  type SlotQ = {
    matchup_id: number;
    team_side: "home" | "away";
    slot: string;
    player_name: string;
    pro_team: string | null;
    position: string | null;
    points: number | null;
    is_bench: boolean | null;
    eligible_slots: string[] | null;
  };
  const rows: SlotQ[] = [];
  const CHUNK = 20;
  const orChunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK)
    orChunks.push(ids.slice(i, i + CHUNK));
  const orResults = await Promise.all(
    orChunks.map((chunk) =>
      supabase
        .from("player_slots")
        .select(
          "matchup_id, team_side, slot, player_name, pro_team, position, points, is_bench, eligible_slots",
        )
        .in("matchup_id", chunk),
    ),
  );
  for (const { data } of orResults) if (data) rows.push(...(data as SlotQ[]));

  const eligibleOf = (elig: string[] | null, position: string | null) =>
    Array.isArray(elig) && elig.length > 0
      ? elig
      : POS_ELIGIBLE[position ?? ""] ?? [];

  // Build the starting-slot template from the actual lineups (all teams share
  // settings; take the longest starting lineup seen in case one left a hole).
  const startersByEntity = new Map<string, string[]>();
  const byName = new Map<string, PoolCand>();
  for (const r of rows) {
    if (r.slot !== "IR") {
      // rostered candidate (starters + bench, never injured reserve)
      const sides = sideTeam.get(r.matchup_id);
      const teamId = sides
        ? r.team_side === "home"
          ? sides.home
          : sides.away
        : null;
      const cand: PoolCand = {
        name: r.player_name,
        position: r.position ?? "",
        proTeam: r.pro_team,
        points: Number(r.points ?? 0),
        eligible: eligibleOf(r.eligible_slots, r.position),
        teamId,
      };
      const prev = byName.get(r.player_name);
      if (!prev || cand.points > prev.points) byName.set(r.player_name, cand);
    }
    if (!r.is_bench && r.slot !== "IR") {
      const key = `${r.matchup_id}:${r.team_side}`;
      const arr = startersByEntity.get(key) ?? [];
      arr.push(r.slot);
      startersByEntity.set(key, arr);
    }
  }

  let template: string[] = [];
  for (const arr of startersByEntity.values())
    if (arr.length > template.length) template = arr;
  if (template.length === 0) return null;

  // Free agents that week (waiver wire) — only if not already rostered.
  const { data: faRaw } = await supabase
    .from("free_agent_week")
    .select("player_name, position, pro_team, points, eligible_slots")
    .eq("year", year)
    .eq("week", week);
  for (const f of (faRaw ?? []) as {
    player_name: string;
    position: string | null;
    pro_team: string | null;
    points: number | null;
    eligible_slots: string[] | null;
  }[]) {
    if (byName.has(f.player_name)) continue;
    byName.set(f.player_name, {
      name: f.player_name,
      position: f.position ?? "",
      proTeam: f.pro_team,
      points: Number(f.points ?? 0),
      eligible: eligibleOf(f.eligible_slots, f.position),
      teamId: null,
    });
  }

  // Greedy assignment: highest scorers first, into the narrowest eligible slot.
  const width = (s: string) => s.split("/").length;
  const slotDefs = template.map((slot) => ({
    slot,
    w: width(slot),
    filled: null as PoolCand | null,
  }));
  const cands = [...byName.values()].sort((a, b) => b.points - a.points);
  for (const p of cands) {
    let best: (typeof slotDefs)[number] | null = null;
    for (const s of slotDefs) {
      if (s.filled) continue;
      if (p.eligible.includes(s.slot) && (!best || s.w < best.w)) best = s;
    }
    if (best) best.filled = p;
  }

  const orderIdx = (slot: string) => {
    const i = SLOT_ORDER.indexOf(slot);
    return i === -1 ? SLOT_ORDER.length : i;
  };
  const ordered = slotDefs
    .filter((s) => s.filled)
    .sort((a, b) => orderIdx(a.slot) - orderIdx(b.slot));

  const slots: OptimalRosterPlayer[] = ordered.map((s) => {
    const p = s.filled!;
    const team = p.teamId != null ? teamById.get(p.teamId) : null;
    return {
      slot: s.slot,
      playerName: p.name,
      position: p.position,
      proTeam: p.proTeam,
      points: p.points,
      teamName: team ? team.name.trim() : null,
      teamEspnId: team ? team.espn_id : null,
    };
  });

  return {
    year,
    week,
    slots,
    total: slots.reduce((a, s) => a + s.points, 0),
    fromFreeAgents: slots.filter((s) => s.teamEspnId == null).length,
    freeAgentPoints: slots
      .filter((s) => s.teamEspnId == null)
      .reduce((a, s) => a + s.points, 0),
  };
}

export type PowerRow = {
  rank: number;
  team: Team;
  change: number | null; // rank change vs previous week (+ = moved up); null = new
};

export type PositionStrengthPlayer = { name: string; value: number };
export type PositionStrengthRow = {
  rank: number;
  team: Team;
  score: number;
  players: PositionStrengthPlayer[]; // the top-N that were counted
};
export type PositionGroup = {
  key: string;
  label: string;
  pos: string;
  count: number;
  rows: PositionStrengthRow[]; // ranked best → worst
};
export type PositionStrength = {
  year: number;
  preseason: boolean; // true = ranked by projected points, not points scored
  groups: PositionGroup[];
};

// How many of each position count toward a team's positional strength.
export const POSITION_STRENGTH_DEFS = [
  { key: "QB", pos: "QB", label: "QB", count: 1 },
  { key: "RB", pos: "RB", label: "RB", count: 3 },
  { key: "WR", pos: "WR", label: "WR", count: 3 },
  { key: "TE", pos: "TE", label: "TE", count: 1 },
  { key: "K", pos: "K", label: "K", count: 1 },
  { key: "DST", pos: "D/ST", label: "D/ST", count: 1 },
] as const;

/**
 * Ranks every team by positional depth: for each position, sum each team's best
 * N players at that spot (N per POSITION_STRENGTH_DEFS). Uses total points once
 * games are played; before then (preseason) uses projected points.
 */
export const getPositionStrength = cached(
  getPositionStrengthImpl,
  "getPositionStrength-v2",
);
async function getPositionStrengthImpl(
  year: number,
): Promise<PositionStrength> {
  const [teams, matchups] = await Promise.all([
    getTeams(year),
    getMatchups(year),
  ]);
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));
  const sideOf = new Map<number, { home: number; away: number }>();
  for (const m of matchups)
    sideOf.set(m.id, { home: m.home_team_id, away: m.away_team_id });
  const ids = matchups.map((m) => m.id);
  const weekOf = new Map<number, number>(matchups.map((m) => [m.id, m.week]));

  type SlotQ = {
    matchup_id: number;
    team_side: "home" | "away";
    player_name: string;
    position: string | null;
    points: number | null;
    projected: number | null;
    is_bench: boolean | null;
  };
  const rows: SlotQ[] = [];
  const CHUNK = 20;
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("player_slots")
        .select(
          "matchup_id, team_side, player_name, position, points, projected, is_bench",
        )
        .in("matchup_id", chunk),
    ),
  );
  for (const { data } of results) if (data) rows.push(...(data as SlotQ[]));

  // Whole-year fantasy points per player. player_season is the true full-season
  // total (all NFL weeks, any fantasy team); but it's occasionally missing a
  // player (e.g. Lamar Jackson), so we fall back to a box-score sum (every
  // team's slots + waiver weeks) when it's absent/zero.
  const boxPts = new Map<string, number>();
  for (const r of rows)
    boxPts.set(
      r.player_name,
      (boxPts.get(r.player_name) ?? 0) + Number(r.points ?? 0),
    );
  const { data: faRaw } = await supabase
    .from("free_agent_week")
    .select("player_name, points")
    .eq("year", year);
  for (const r of (faRaw ?? []) as {
    player_name: string;
    points: number | null;
  }[])
    boxPts.set(
      r.player_name,
      (boxPts.get(r.player_name) ?? 0) + Number(r.points ?? 0),
    );
  const { data: psRaw } = await supabase
    .from("player_season")
    .select("player_name, total_points")
    .eq("year", year);
  const psPts = new Map<string, number>(
    (
      (psRaw ?? []) as { player_name: string; total_points: number | null }[]
    ).map((r) => [r.player_name, Number(r.total_points ?? 0)]),
  );
  const fullYear = (name: string) => {
    const p = psPts.get(name) ?? 0;
    return p > 0 ? p : (boxPts.get(name) ?? 0);
  };
  const preseason = ![...boxPts.values()].some((v) => v > 0);

  // Latest week with a lineup per team → its "current roster".
  const latestWeek = new Map<number, number>();
  for (const r of rows) {
    const sides = sideOf.get(r.matchup_id);
    if (!sides) continue;
    const tid = r.team_side === "home" ? sides.home : sides.away;
    const wk = weekOf.get(r.matchup_id) ?? 0;
    if (wk > (latestWeek.get(tid) ?? 0)) latestWeek.set(tid, wk);
  }

  // currentRoster: tid -> name -> {pos, projected}  (latest-week lineup)
  // startedFor:    tid -> name -> pos  (players who STARTED ≥1 for the team)
  const currentRoster = new Map<
    number,
    Map<string, { pos: string; projected: number }>
  >();
  const startedFor = new Map<number, Map<string, string>>();
  for (const r of rows) {
    const sides = sideOf.get(r.matchup_id);
    if (!sides) continue;
    const tid = r.team_side === "home" ? sides.home : sides.away;
    if ((weekOf.get(r.matchup_id) ?? 0) === latestWeek.get(tid)) {
      let pm = currentRoster.get(tid);
      if (!pm) {
        pm = new Map();
        currentRoster.set(tid, pm);
      }
      pm.set(r.player_name, {
        pos: r.position ?? "",
        projected: Number(r.projected ?? 0),
      });
    }
    if (!r.is_bench) {
      let sm = startedFor.get(tid);
      if (!sm) {
        sm = new Map();
        startedFor.set(tid, sm);
      }
      if (!sm.has(r.player_name)) sm.set(r.player_name, r.position ?? "");
    }
  }

  const teamIds = new Set<number>([
    ...currentRoster.keys(),
    ...startedFor.keys(),
  ]);
  // For skill positions in a played season, a player counts for a team only if
  // they actually started for it at least once (not just current-roster
  // depth). QB/K/D-ST and the preseason use the current roster.
  const SKILL = new Set(["WR", "RB", "TE"]);

  const groups: PositionGroup[] = POSITION_STRENGTH_DEFS.map((def) => {
    const useStarted = !preseason && SKILL.has(def.pos);
    const posRows: PositionStrengthRow[] = [];
    for (const tid of teamIds) {
      const team = teamById.get(tid);
      if (!team) continue;
      let candidates: { name: string; value: number }[];
      if (useStarted) {
        candidates = [...(startedFor.get(tid) ?? new Map()).entries()]
          .filter(([, pos]) => pos === def.pos)
          .map(([name]) => ({ name, value: fullYear(name) }));
      } else {
        candidates = [...(currentRoster.get(tid) ?? new Map()).entries()]
          .filter(([, v]) => v.pos === def.pos)
          .map(([name, v]) => ({
            name,
            value: preseason ? v.projected : fullYear(name),
          }));
      }
      const players = candidates
        .sort((a, b) => b.value - a.value)
        .slice(0, def.count);
      posRows.push({
        rank: 0,
        team,
        score: players.reduce((a, p) => a + p.value, 0),
        players,
      });
    }
    posRows.sort((a, b) => b.score - a.score);
    posRows.forEach((r, i) => (r.rank = i + 1));
    return {
      key: def.key,
      label: def.label,
      pos: def.pos,
      count: def.count,
      rows: posRows,
    };
  });

  return { year, preseason, groups };
}

/**
 * Power rankings: sum of a team's 3 most recent game scores, plus half of the
 * 4th and 5th most recent. Uses all played games (regular season + playoffs).
 * `change` compares the current ranking to the ranking as of the prior week.
 */
export const getPowerRankings = cached(getPowerRankingsImpl, "getPowerRankings");
async function getPowerRankingsImpl(year: number): Promise<PowerRow[]> {
  const [teams, matchups] = await Promise.all([getTeams(year), getMatchups(year)]);
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));

  const byTeam = new Map<number, { week: number; score: number }[]>();
  const push = (tid: number, week: number, score: number) => {
    const arr = byTeam.get(tid) ?? [];
    arr.push({ week, score });
    byTeam.set(tid, arr);
  };
  let maxWeek = 0;
  for (const m of matchups) {
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    if (hs === 0 && as === 0) continue; // unplayed
    push(m.home_team_id, m.week, hs);
    push(m.away_team_id, m.week, as);
    if (m.week > maxWeek) maxWeek = m.week;
  }

  const WEIGHTS = [1, 1, 1, 0.5, 0.5];
  // Ordered team ids by power, considering only games up to `cutoff`.
  const orderAt = (cutoff: number): number[] =>
    [...byTeam.entries()]
      .map(([tid, list]) => {
        const recent = list
          .filter((g) => g.week <= cutoff)
          .sort((a, b) => b.week - a.week)
          .slice(0, 5);
        const power = recent.reduce(
          (sum, g, i) => sum + g.score * (WEIGHTS[i] ?? 0),
          0,
        );
        return { tid, power, played: recent.length };
      })
      .filter((r) => r.played > 0)
      .sort((a, b) => b.power - a.power)
      .map((r) => r.tid);

  const current = orderAt(maxWeek);
  const prev = orderAt(maxWeek - 1);
  const prevRank = new Map<number, number>(prev.map((tid, i) => [tid, i + 1]));

  return current
    .map((tid, i) => {
      const rank = i + 1;
      const pr = prevRank.get(tid);
      return {
        rank,
        team: teamById.get(tid)!,
        change: pr == null ? null : pr - rank,
      };
    })
    .filter((r) => r.team);
}

export type DivisionStandings = { name: string; standings: Standing[] };

/** Regular-season standings for a year, split into the league's divisions
 *  (from league-config), each re-ranked within its division. */
export const getDivisionStandings = cached(
  getDivisionStandingsImpl,
  "getDivisionStandings",
);
async function getDivisionStandingsImpl(
  year: number,
): Promise<DivisionStandings[]> {
  const divs = divisionsFor(year);
  if (divs.length === 0) return [];
  const [teams, matchups] = await Promise.all([
    getTeams(year),
    getMatchups(year),
  ]);
  const all = buildStandings(teams, matchups); // overall, sorted
  return divs.map((d) => ({
    name: d.name,
    standings: all
      .filter((s) => d.espnIds.includes(s.team.espn_id))
      .map((s, i) => ({ ...s, rank: i + 1 })),
  }));
}

/** Manual preseason power rankings for a year, built from the hand-entered
 *  espn_id order in league-config. Empty if none configured. */
export const getPreseasonPowerRankings = cached(
  getPreseasonPowerRankingsImpl,
  "getPreseasonPowerRankings",
);
async function getPreseasonPowerRankingsImpl(
  year: number,
): Promise<PowerRow[]> {
  const order = preseasonPowerRankings(year);
  if (order.length === 0) return [];
  const teams = await getTeams(year);
  const byEspn = new Map<number, Team>(teams.map((t) => [t.espn_id, t]));
  const rows: PowerRow[] = [];
  order.forEach((espnId, i) => {
    const team = byEspn.get(espnId);
    if (team) rows.push({ rank: i + 1, team, change: null });
  });
  return rows;
}

/**
 * Power rankings for the homepage. Uses the most recent season that has played
 * games; if the newest season hasn't started, it uses the hand-entered
 * preseason rankings for that season (league-config) before falling back to the
 * latest completed season.
 */
export const getLatestPowerRankings = cached(
  getLatestPowerRankingsImpl,
  "getLatestPowerRankings",
);
async function getLatestPowerRankingsImpl(): Promise<{
  year: number;
  rows: PowerRow[];
  preseason: boolean;
}> {
  const seasons = await getSeasons(); // newest first
  for (const s of seasons) {
    const rows = await getPowerRankings(s.year);
    if (rows.length > 0) return { year: s.year, rows, preseason: false };
    const manual = await getPreseasonPowerRankings(s.year);
    if (manual.length > 0) return { year: s.year, rows: manual, preseason: true };
  }
  return { year: seasons[0]?.year ?? 0, rows: [], preseason: false };
}

export type FranchiseSeason = {
  year: number;
  name: string;
  owner: string;
  teamId: number;
  rank: number;
  teamCount: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  isChampion: boolean;
};

export type Franchise = {
  espnId: number;
  latestName: string;
  owner: string;
  seasons: FranchiseSeason[]; // newest first
};

/** All teams from the most recent season — the franchise roster shown on /teams. */
export const getCurrentFranchises = cached(
  getCurrentFranchisesImpl,
  "getCurrentFranchises",
);
async function getCurrentFranchisesImpl(): Promise<Team[]> {
  const seasons = await getSeasons();
  if (seasons.length === 0) return [];
  const teams = await getTeams(seasons[0].year);
  return [...teams].sort((a, b) => a.espn_id - b.espn_id);
}

export type FranchiseSummary = {
  espnId: number;
  latestName: string;
  owner: string;
  seasonsPlayed: number;
  titles: number;
  latest: {
    year: number;
    record: string;
    rank: number;
    teamCount: number;
    pointsFor: number;
  } | null;
};

/**
 * Light per-franchise stats for everyone in the most recent season, computed in
 * a single pass over all seasons (one teams + one matchups query per year).
 */
export const getFranchiseSummaries = cached(
  getFranchiseSummariesImpl,
  "getFranchiseSummaries",
);
async function getFranchiseSummariesImpl(): Promise<FranchiseSummary[]> {
  const seasons = await getSeasons();
  if (seasons.length === 0) return [];

  const perYear = await Promise.all(
    seasons.map(async (s) => {
      const [teams, matchups] = await Promise.all([
        getTeams(s.year),
        getMatchups(s.year),
      ]);
      return { year: s.year, standings: buildStandings(teams, matchups) };
    }),
  );

  const latestYear = Math.max(...seasons.map((s) => s.year));
  const byEspn = new Map<number, FranchiseSummary>();

  for (const { year, standings } of perYear) {
    for (const st of standings) {
      const espnId = st.team.espn_id;
      let f = byEspn.get(espnId);
      if (!f) {
        f = {
          espnId,
          latestName: st.team.name,
          owner: st.team.owner,
          seasonsPlayed: 0,
          titles: 0,
          latest: null,
        };
        byEspn.set(espnId, f);
      }
      f.seasonsPlayed++;
      if (year === latestYear) {
        f.latestName = st.team.name;
        f.owner = st.team.owner;
        f.latest = {
          year,
          record: `${st.wins}-${st.losses}${st.ties ? `-${st.ties}` : ""}`,
          rank: finalPlacement(st.team.espn_id, year) ?? st.rank,
          teamCount: standings.length,
          pointsFor: st.pointsFor,
        };
      }
    }
  }

  for (const f of byEspn.values()) {
    f.titles = championshipsFor(f.espnId);
  }

  return [...byEspn.values()].sort((a, b) => a.espnId - b.espnId);
}

/** One franchise (by espn_id) with its per-season record across all years. */
export const getFranchise = cached(getFranchiseImpl, "getFranchise");
async function getFranchiseImpl(espnId: number): Promise<Franchise | null> {
  const { data: rows } = await supabase
    .from("teams")
    .select("id, espn_id, year, name, owner")
    .eq("espn_id", espnId)
    .order("year", { ascending: false });

  const teamRows = (rows as Team[]) ?? [];
  if (teamRows.length === 0) return null;

  const seasons: FranchiseSeason[] = [];
  for (const row of teamRows) {
    const [yearTeams, matchups] = await Promise.all([
      getTeams(row.year),
      getMatchups(row.year),
    ]);
    const standings = buildStandings(yearTeams, matchups);
    const mine = standings.find((s) => s.team.id === row.id);
    seasons.push({
      year: row.year,
      name: row.name,
      owner: row.owner,
      teamId: row.id,
      rank: finalPlacement(espnId, row.year) ?? mine?.rank ?? 0,
      teamCount: standings.length,
      wins: mine?.wins ?? 0,
      losses: mine?.losses ?? 0,
      ties: mine?.ties ?? 0,
      pointsFor: mine?.pointsFor ?? 0,
      pointsAgainst: mine?.pointsAgainst ?? 0,
      isChampion: isChampion(espnId, row.year),
    });
  }

  return {
    espnId,
    latestName: teamRows[0].name,
    owner: teamRows[0].owner,
    seasons,
  };
}

export type HeadToHeadRow = {
  opponentEspnId: number;
  opponentName: string; // most recent name
  wins: number;
  losses: number;
  ties: number;
  games: number;
  winPct: number; // 0-1
};

export type FranchiseHeadToHead = {
  overall: { wins: number; losses: number; ties: number };
  opponents: HeadToHeadRow[]; // best win% first
};

/**
 * Lifetime head-to-head record for a franchise vs every other franchise, keyed
 * by espn_id so it follows a team across name changes. Counts EVERY played game
 * (regular season + playoffs), so this is a true lifetime series record and will
 * run ahead of the regular-season-only "Overall record" in Career totals.
 */
export const getFranchiseHeadToHead = cached(
  getFranchiseHeadToHeadImpl,
  "getFranchiseHeadToHead",
);
async function getFranchiseHeadToHeadImpl(
  espnId: number,
): Promise<FranchiseHeadToHead> {
  const seasons = await getSeasons(); // newest first
  if (seasons.length === 0) {
    return { overall: { wins: 0, losses: 0, ties: 0 }, opponents: [] };
  }

  const perYear = await Promise.all(
    seasons.map(async (s) => {
      const [teams, matchups] = await Promise.all([
        getTeams(s.year),
        getMatchups(s.year),
      ]);
      return { teams, matchups };
    }),
  );

  // opponent espn_id -> record; and the most recent name we've seen per franchise
  const h2h = new Map<number, { wins: number; losses: number; ties: number }>();
  const latestName = new Map<number, string>();

  for (const { teams, matchups } of perYear) {
    const espnByTeamId = new Map<number, number>(
      teams.map((t) => [t.id, t.espn_id]),
    );
    // perYear is newest-first, so the first name seen for a franchise is latest.
    for (const t of teams) {
      if (!latestName.has(t.espn_id)) latestName.set(t.espn_id, t.name.trim());
    }

    for (const m of matchups) {
      if (!isPlayed(m)) continue; // lifetime: regular season + playoffs
      const homeEspn = espnByTeamId.get(m.home_team_id);
      const awayEspn = espnByTeamId.get(m.away_team_id);
      if (homeEspn == null || awayEspn == null) continue;

      let side: "home" | "away" | null = null;
      if (homeEspn === espnId) side = "home";
      else if (awayEspn === espnId) side = "away";
      if (!side) continue;

      const oppEspn = side === "home" ? awayEspn : homeEspn;
      const myScore = side === "home" ? m.home_score ?? 0 : m.away_score ?? 0;
      const oppScore = side === "home" ? m.away_score ?? 0 : m.home_score ?? 0;

      let rec = h2h.get(oppEspn);
      if (!rec) {
        rec = { wins: 0, losses: 0, ties: 0 };
        h2h.set(oppEspn, rec);
      }
      if (myScore > oppScore) rec.wins++;
      else if (myScore < oppScore) rec.losses++;
      else rec.ties++;
    }
  }

  const overall = { wins: 0, losses: 0, ties: 0 };
  const opponents: HeadToHeadRow[] = [...h2h.entries()].map(([oppEspn, rec]) => {
    overall.wins += rec.wins;
    overall.losses += rec.losses;
    overall.ties += rec.ties;
    const games = rec.wins + rec.losses + rec.ties;
    return {
      opponentEspnId: oppEspn,
      opponentName: latestName.get(oppEspn) ?? `Team ${oppEspn}`,
      wins: rec.wins,
      losses: rec.losses,
      ties: rec.ties,
      games,
      winPct: games ? (rec.wins + rec.ties * 0.5) / games : 0,
    };
  });

  opponents.sort(
    (a, b) => b.winPct - a.winPct || b.games - a.games || b.wins - a.wins,
  );

  return { overall, opponents };
}

export type RosterPlayer = {
  name: string;
  position: string;
  points: number;
  weeks: number;
  endedOnTeam: boolean; // on the roster in the season's final week
};

export type FranchiseRoster = {
  byYear: { year: number; players: RosterPlayer[] }[]; // newest first
  topScorers: { name: string; points: number }[]; // top 3 across all years
};

/**
 * Roster + scoring for a franchise. player_slots link to matchups by
 * (matchup_id, team_side), so we map each of the team's matchups to the side it
 * played, keep only those slots, and aggregate points per player.
 */
export const getFranchiseRoster = cached(
  getFranchiseRosterImpl,
  "getFranchiseRoster",
);
async function getFranchiseRosterImpl(
  espnId: number,
): Promise<FranchiseRoster> {
  const { data: teamRowsRaw } = await supabase
    .from("teams")
    .select("id, year")
    .eq("espn_id", espnId);
  const teamRows = (teamRowsRaw as { id: number; year: number }[]) ?? [];
  if (teamRows.length === 0) return { byYear: [], topScorers: [] };

  const teamIds = teamRows.map((t) => t.id);
  const idList = teamIds.join(",");

  const { data: msRaw } = await supabase
    .from("matchups")
    .select("id, year, week, home_team_id, away_team_id")
    .or(`home_team_id.in.(${idList}),away_team_id.in.(${idList})`);
  const matchups = (msRaw as Matchup[]) ?? [];
  if (matchups.length === 0) return { byYear: [], topScorers: [] };

  const idSet = new Set(teamIds);
  const matchupInfo = new Map<
    number,
    { year: number; week: number; side: "home" | "away" }
  >();
  for (const m of matchups) {
    const side = idSet.has(m.home_team_id) ? "home" : "away";
    matchupInfo.set(m.id, { year: m.year, week: m.week, side });
  }
  // names on the roster in each year's final week (any slot, incl. bench)
  const finalRoster = new Map<number, Set<string>>();

  type SlotQ = {
    matchup_id: number;
    team_side: "home" | "away";
    player_name: string;
    points: number | null;
    position: string | null;
    is_bench: boolean | null;
  };
  // Chunk by matchup id to stay under the 1000-row response cap.
  const slots: SlotQ[] = [];
  const mIds = [...matchupInfo.keys()];
  const mIdChunks: number[][] = [];
  for (let i = 0; i < mIds.length; i += 20)
    mIdChunks.push(mIds.slice(i, i + 20));
  const mIdResults = await Promise.all(
    mIdChunks.map((chunk) =>
      supabase
        .from("player_slots")
        .select("matchup_id, team_side, player_name, points, position, is_bench")
        .in("matchup_id", chunk),
    ),
  );
  for (const { data } of mIdResults) if (data) slots.push(...(data as SlotQ[]));

  // Only our team's slots, and the latest week that actually has a lineup per
  // year (schedule-only future weeks have no player_slots, so they don't count).
  const ourSlots = slots.filter((s) => {
    const info = matchupInfo.get(s.matchup_id);
    return info && s.team_side === info.side;
  });
  const maxLineupWeek = new Map<number, number>();
  for (const s of ourSlots) {
    const info = matchupInfo.get(s.matchup_id)!;
    maxLineupWeek.set(
      info.year,
      Math.max(maxLineupWeek.get(info.year) ?? 0, info.week),
    );
  }

  // year -> player -> aggregate. `rostered` counts any appearance (incl. bench)
  // so the whole roster shows; `points`/`weeks` count only started games.
  const byYearMap = new Map<
    number,
    Map<
      string,
      { points: number; weeks: number; rostered: number; posCounts: Map<string, number> }
    >
  >();
  const totalByPlayer = new Map<string, number>();

  for (const s of ourSlots) {
    const info = matchupInfo.get(s.matchup_id)!;

    // final-week roster membership (any slot)
    if (info.week === maxLineupWeek.get(info.year)) {
      let set = finalRoster.get(info.year);
      if (!set) {
        set = new Set();
        finalRoster.set(info.year, set);
      }
      set.add(s.player_name);
    }

    let yearMap = byYearMap.get(info.year);
    if (!yearMap) {
      yearMap = new Map();
      byYearMap.set(info.year, yearMap);
    }
    let p = yearMap.get(s.player_name);
    if (!p) {
      p = { points: 0, weeks: 0, rostered: 0, posCounts: new Map() };
      yearMap.set(s.player_name, p);
    }
    p.rostered += 1;
    if (s.position) p.posCounts.set(s.position, (p.posCounts.get(s.position) ?? 0) + 1);
    if (!s.is_bench) {
      const pts = Number(s.points ?? 0); // benched points didn't score for the team
      p.points += pts;
      p.weeks += 1;
      totalByPlayer.set(
        s.player_name,
        (totalByPlayer.get(s.player_name) ?? 0) + pts,
      );
    }
  }

  const byYear = [...byYearMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, players]) => ({
      year,
      players: [...players.entries()]
        .map(([name, agg]) => {
          let position = "";
          let best = 0;
          for (const [pos, count] of agg.posCounts) {
            if (count > best) {
              best = count;
              position = pos;
            }
          }
          return {
            name,
            position,
            points: agg.points,
            weeks: agg.weeks,
            endedOnTeam: finalRoster.get(year)?.has(name) ?? false,
          };
        })
        // Show the whole roster (everyone who appeared), scorers first.
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
    }));

  const topScorers = [...totalByPlayer.entries()]
    .map(([name, points]) => ({ name, points }))
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return { byYear, topScorers };
}

export type UpcomingMatch = {
  matchupId: number;
  week: number;
  isHome: boolean;
  opponent: Team | null;
  played: boolean;
  teamScore: number;
  oppScore: number;
  teamProjected: number | null;
  oppProjected: number | null;
};

export type TeamHome = {
  year: number;
  team: Team;
  record: string;
  rank: number | null;
  teamCount: number;
  upcoming: UpcomingMatch[]; // next unplayed matchups (chronological)
  lastResult: UpcomingMatch | null; // most recent played matchup
};

/**
 * Personalized homepage data for one franchise in the current (active) season:
 * their record, upcoming matchups, and last result.
 */
export const getTeamHome = cached(getTeamHomeImpl, "getTeamHome");
async function getTeamHomeImpl(espnId: number): Promise<TeamHome | null> {
  const seasons = await getSeasons(); // newest first
  const active = seasons.find((s) => s.is_active) ?? seasons[0];
  if (!active) return null;
  const year = active.year;

  const [teams, mRes] = await Promise.all([
    getTeams(year),
    supabase
      .from("matchups")
      .select(
        "id, year, week, home_team_id, away_team_id, home_score, away_score, home_projected, away_projected",
      )
      .eq("year", year)
      .order("week", { ascending: true }),
  ]);
  const team = teams.find((t) => t.espn_id === espnId);
  if (!team) return null;
  const teamById = new Map<number, Team>(teams.map((t) => [t.id, t]));

  type MRow = {
    id: number;
    year: number;
    week: number;
    home_team_id: number;
    away_team_id: number;
    home_score: number | null;
    away_score: number | null;
    home_projected: number | null;
    away_projected: number | null;
  };
  const rows = (mRes.data ?? []) as MRow[];

  const st = buildStandings(teams, rows as unknown as Matchup[]);
  const mine = st.find((s) => s.team.id === team.id) ?? null;
  const record = mine
    ? `${mine.wins}-${mine.losses}${mine.ties ? `-${mine.ties}` : ""}`
    : "0-0";

  const toUM = (m: MRow): UpcomingMatch => {
    const isHome = m.home_team_id === team.id;
    const oppId = isHome ? m.away_team_id : m.home_team_id;
    const hs = Number(m.home_score ?? 0);
    const as = Number(m.away_score ?? 0);
    return {
      matchupId: m.id,
      week: m.week,
      isHome,
      opponent: teamById.get(oppId) ?? null,
      played: hs !== 0 || as !== 0,
      teamScore: isHome ? hs : as,
      oppScore: isHome ? as : hs,
      teamProjected:
        (isHome ? m.home_projected : m.away_projected) == null
          ? null
          : Number(isHome ? m.home_projected : m.away_projected),
      oppProjected:
        (isHome ? m.away_projected : m.home_projected) == null
          ? null
          : Number(isHome ? m.away_projected : m.home_projected),
    };
  };

  const myMatchups = rows
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .map(toUM);
  const upcoming = myMatchups.filter((m) => !m.played).slice(0, 3);
  const played = myMatchups.filter((m) => m.played);
  const lastResult = played.length ? played[played.length - 1] : null;

  return {
    year,
    team,
    record,
    rank: mine?.rank ?? null,
    teamCount: teams.length,
    upcoming,
    lastResult,
  };
}
