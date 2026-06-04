import { supabase } from "@/lib/supabase";
import { isPlayoffWeek, isChampion, championshipsFor } from "@/lib/league-config";

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
          rank: st.rank,
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
      rank: mine?.rank ?? 0,
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
