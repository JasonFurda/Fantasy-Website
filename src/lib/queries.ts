import { supabase } from "@/lib/supabase";

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
  isChampionByRecord: boolean;
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
      rank: mine?.rank ?? 0,
      teamCount: standings.length,
      wins: mine?.wins ?? 0,
      losses: mine?.losses ?? 0,
      ties: mine?.ties ?? 0,
      pointsFor: mine?.pointsFor ?? 0,
      pointsAgainst: mine?.pointsAgainst ?? 0,
      isChampionByRecord: mine?.rank === 1,
    });
  }

  return {
    espnId,
    latestName: teamRows[0].name,
    owner: teamRows[0].owner,
    seasons,
  };
}
