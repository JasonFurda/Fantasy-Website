import { supabase } from "@/lib/supabase";
import {
  isPlayoffWeek,
  isChampion,
  championshipsFor,
  finalPlacement,
} from "@/lib/league-config";

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

export async function getSeasons(): Promise<Season[]> {
  const { data } = await supabase
    .from("seasons")
    .select("year, current_week, is_active")
    .order("year", { ascending: false });
  return (data as Season[]) ?? [];
}

export async function getTeams(year: number): Promise<Team[]> {
  const { data } = await supabase
    .from("teams")
    .select("id, espn_id, year, name, owner")
    .eq("year", year);
  return (data as Team[]) ?? [];
}

export async function getMatchups(year: number): Promise<Matchup[]> {
  const { data } = await supabase
    .from("matchups")
    .select("id, year, week, home_team_id, away_team_id, home_score, away_score")
    .eq("year", year)
    .order("week", { ascending: true });
  return (data as Matchup[]) ?? [];
}

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
export async function getAllTimeStandings(): Promise<Standing[]> {
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
  winPct: number; // 0-100
  pointsFor: number;
  pointsAgainst: number;
  pfPercentile: number;
  paPercentile: number;
  fraudScore: number;
};

export type GameRow = {
  team: Team;
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
export async function getYearStats(year: number): Promise<YearStats> {
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
      score: hs,
      week: m.week,
      opponent: away,
      opponentScore: as,
      won: hs > as,
      matchupId: m.id,
    });
    games.push({
      team: away!,
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
    for (let i = 0; i < playedIds.length; i += CHUNK) {
      const chunk = playedIds.slice(i, i + CHUNK);
      const { data } = await supabase
        .from("player_slots")
        .select("matchup_id, team_side, points, slot, is_bench, eligible_slots")
        .in("matchup_id", chunk);
      if (data) rows.push(...(data as SlotQueryRow[]));
    }

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
    });
  }
  mismanage.sort((a, b) => a.pctOptimal - b.pctOptimal); // worst first

  return { fraud, club200, subClub, mismanage };
}

export type PlayerCompRow = {
  name: string;
  fantasyTeam: { name: string; espnId: number } | null;
  nflTeam: string;
  games: number;
  totalPts: number;
  avgPts: number;
  variance: number;
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
export async function getPlayerComparison(
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
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await supabase
      .from("player_slots")
      .select(
        "player_name, pro_team, points, game_played, is_bench, team_side, matchup_id, stats",
      )
      .eq("position", position)
      .in("matchup_id", ids.slice(i, i + CHUNK));
    if (data) rows.push(...(data as Raw[]));
  }

  type Agg = {
    name: string;
    pts: number;
    weekly: number[];
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
    if ((r.game_played ?? 0) > 0) a.games += 1;
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

  const out: PlayerCompRow[] = [];
  for (const a of byPlayer.values()) {
    const games = a.games || a.weekly.length;
    const mean = a.weekly.length
      ? a.weekly.reduce((x, y) => x + y, 0) / a.weekly.length
      : 0;
    const variance = a.weekly.length
      ? a.weekly.reduce((x, y) => x + (y - mean) ** 2, 0) / a.weekly.length
      : 0;
    const tid = mode(a.teamCounts);
    const team = tid != null ? teamById.get(tid) : null;
    out.push({
      name: a.name,
      fantasyTeam: team ? { name: team.name.trim(), espnId: team.espn_id } : null,
      nflTeam: mode(a.proCounts) ?? "",
      games,
      totalPts: a.pts,
      avgPts: games ? a.pts / games : 0,
      variance,
      s: a.s,
    });
  }

  // Add free agents (never rostered) for this position.
  const rostered = new Set(out.map((r) => r.name));
  const { data: faRaw } = await supabase
    .from("free_agents")
    .select("player_name, pro_team, total_points, stats")
    .eq("year", year)
    .eq("position", position);
  for (const fa of (faRaw ?? []) as {
    player_name: string;
    pro_team: string;
    total_points: number;
    stats: Record<string, number> | null;
  }[]) {
    if (rostered.has(fa.player_name)) continue;
    out.push({
      name: fa.player_name,
      fantasyTeam: null, // free agent
      nflTeam: fa.pro_team,
      games: 0,
      totalPts: Number(fa.total_points),
      avgPts: 0,
      variance: 0,
      s: fa.stats ?? {},
    });
  }

  return out.sort((x, y) => y.totalPts - x.totalPts);
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
export async function getDraftValue(year: number): Promise<DraftValueRow[]> {
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

export async function getMatchupDetail(
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
export async function getCurrentFranchises(): Promise<Team[]> {
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
export async function getFranchiseSummaries(): Promise<FranchiseSummary[]> {
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
export async function getFranchise(espnId: number): Promise<Franchise | null> {
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

export type RosterPlayer = {
  name: string;
  position: string;
  points: number;
  weeks: number;
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
export async function getFranchiseRoster(
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
    .select("id, year, home_team_id, away_team_id")
    .or(`home_team_id.in.(${idList}),away_team_id.in.(${idList})`);
  const matchups = (msRaw as Matchup[]) ?? [];
  if (matchups.length === 0) return { byYear: [], topScorers: [] };

  const idSet = new Set(teamIds);
  const matchupInfo = new Map<number, { year: number; side: "home" | "away" }>();
  for (const m of matchups) {
    const side = idSet.has(m.home_team_id) ? "home" : "away";
    matchupInfo.set(m.id, { year: m.year, side });
  }

  const { data: slotsRaw } = await supabase
    .from("player_slots")
    .select("matchup_id, team_side, player_name, points, slot, is_bench")
    .in("matchup_id", [...matchupInfo.keys()]);
  const slots =
    (slotsRaw as {
      matchup_id: number;
      team_side: "home" | "away";
      player_name: string;
      points: number | null;
      slot: string;
      is_bench: boolean | null;
    }[]) ?? [];

  // year -> player -> aggregate
  const byYearMap = new Map<
    number,
    Map<string, { points: number; weeks: number; slotCounts: Map<string, number> }>
  >();
  const totalByPlayer = new Map<string, number>();

  for (const s of slots) {
    const info = matchupInfo.get(s.matchup_id);
    if (!info || s.team_side !== info.side) continue; // not our team's slot
    if (s.is_bench) continue; // benched points didn't score for the team
    const pts = Number(s.points ?? 0);

    let yearMap = byYearMap.get(info.year);
    if (!yearMap) {
      yearMap = new Map();
      byYearMap.set(info.year, yearMap);
    }
    let p = yearMap.get(s.player_name);
    if (!p) {
      p = { points: 0, weeks: 0, slotCounts: new Map() };
      yearMap.set(s.player_name, p);
    }
    p.points += pts;
    p.weeks += 1;
    p.slotCounts.set(s.slot, (p.slotCounts.get(s.slot) ?? 0) + 1);

    totalByPlayer.set(s.player_name, (totalByPlayer.get(s.player_name) ?? 0) + pts);
  }

  const byYear = [...byYearMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, players]) => ({
      year,
      players: [...players.entries()]
        .map(([name, agg]) => {
          let position = "BE";
          let best = 0;
          for (const [slot, count] of agg.slotCounts) {
            if (count > best) {
              best = count;
              position = slot;
            }
          }
          return {
            name,
            position,
            points: agg.points,
            weeks: agg.weeks,
          };
        })
        .filter((p) => p.points > 0)
        .sort((a, b) => b.points - a.points),
    }));

  const topScorers = [...totalByPlayer.entries()]
    .map(([name, points]) => ({ name, points }))
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return { byYear, topScorers };
}
