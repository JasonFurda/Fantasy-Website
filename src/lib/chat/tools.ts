import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { championshipsFor, isPlayoffWeek } from "@/lib/league-config";
import { PLAYER_NICKNAMES, type NicknameStatus } from "@/lib/chat/personality";
import { getPlayoffOdds } from "@/lib/playoff-odds";
import { getArticleBySlug, getArticles } from "@/lib/articles";
import { getManualPowerRankings, getManualRankingHistory } from "@/lib/rankings";
import { evaluateTrade } from "@/lib/trade-calc";
import {
  buildStandings,
  firstUnfinishedWeek,
  getAllPlayerNames,
  getAllTimeProjectedDiff,
  getAllTimeStandings,
  getAllTimeStats,
  getDefenseStats,
  getDivisionStandings,
  getDraftRecap,
  getFranchise,
  getFranchiseHeadToHead,
  getFranchiseRoster,
  getLatestPowerRankings,
  getMatchupDetail,
  getMatchupProjections,
  getMatchups,
  getPlayerComparison,
  getPlayerDetail,
  getPlayerRosterStatus,
  getPositionStrength,
  getPowerRankings,
  getPreseasonPowerRankings,
  getProjectedDiff,
  getProTeamByes,
  getSeasons,
  getTeamHome,
  getTeamOutlook,
  getTeams,
  getTradeBlock,
  getTradeCalcData,
  getTrades,
  getWeeklyRecap,
  getWeeklyRecapFor,
  getWeekOptimalRoster,
  getYearPerformance,
  getYearStats,
  type CalcTeam,
  type Matchup,
  type PlayerDetail,
  type PlayerRosterStatus,
  type PowerRow,
  type SlotRow,
  type UpcomingMatch,
} from "@/lib/queries";

// The bot's only view of the league: read-only lookups over the same cached
// queries the pages use. Every handler only reads (the article and rankings
// modules also hold the site's write paths, but nothing here calls them), and
// queries.ts reads with the anon key, so model output can't change data.

/** Keeps one oversized result from running up the bill. */
const MAX_RESULT_CHARS = 30_000;

const YEAR = {
  type: "integer",
  description: "Season year. Omit for the current season.",
};
const ESPN_ID = {
  type: "integer",
  description: "The franchise's espn_id.",
};
const WEEK = {
  type: "integer",
  description: "Week number. Omit for the current week.",
};
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "D/ST"];
const POSITION = { type: "string", enum: POSITIONS };

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): Anthropic.Tool {
  return {
    name,
    description,
    input_schema: { type: "object", properties, required },
  };
}

export const CHAT_TOOLS: Anthropic.Tool[] = [
  tool(
    "get_standings",
    "A season's regular-season standings: rank, record, points for and against with where they rank in the league (pointsForRank 1 = scored the most, pointsAgainstRank 1 = gave up the most), fraud score, fraud rank (1 = biggest fraud), and each team's division and place in it. With all_time, every franchise's combined regular-season record across all seasons instead.",
    {
      year: YEAR,
      all_time: {
        type: "boolean",
        description: "True for all seasons combined. Ignores year.",
      },
    },
  ),
  tool(
    "get_team",
    "One franchise's history: its name, record, finish, and fraud score each season, titles, its top scorers added up across every season (not this season's totals), its current record and rank, last result, and upcoming games. Use get_team_lineup or get_player for this season's players.",
    { espn_id: ESPN_ID },
    ["espn_id"],
  ),
  tool(
    "get_head_to_head",
    "A franchise's lifetime record against every other franchise, or against one opponent. Includes playoff games.",
    {
      espn_id: ESPN_ID,
      opponent_espn_id: { type: "integer", description: "Optional opponent." },
    },
    ["espn_id"],
  ),
  tool(
    "get_team_lineup",
    "A franchise's starters and bench for its next or most recent week, with each player's matchup rating.",
    { espn_id: ESPN_ID },
    ["espn_id"],
  ),
  tool(
    "get_weekly_recap",
    "One finished week: every team's score, opponent, projection, lineup efficiency, and the week's awards. Omit both inputs for the latest finished week.",
    { year: YEAR, week: { type: "integer", description: "Week number." } },
  ),
  tool(
    "get_leaderboards",
    "Season or all-time leaderboards: fraud scores, 200-point games, sub-100-point games, and lineup mismanagement.",
    {
      year: YEAR,
      all_time: {
        type: "boolean",
        description: "True for all seasons combined. Ignores year.",
      },
    },
  ),
  tool(
    "get_power_rankings",
    "The season's power rankings, the same ones the site shows: the latest weekly ranking with each team's movement (change: positive = moved up), plus every past week's ranking. They're hand-picked each week by a league member when submitted, otherwise computed from results. With position_groups, also ranks each team's depth at every position by its best players' season points.",
    {
      year: YEAR,
      position_groups: {
        type: "boolean",
        description: "True to add the position-by-position depth rankings.",
      },
    },
  ),
  tool(
    "get_player",
    "One player's season. weekly lists his fantasy points for each week played so far: fantasyTeam is who had him that week (this season only), freeAgent means nobody did, points is null when there's no record of him, and inProgress marks the week being played now, whose points are partial. seasons has a line for every season on record: NFL games played, fantasy points in total and per game, and NFL stats, which are season totals unless the name ends in PerGame. rosterStatus covers the current season: current is the team that has him now (null means nobody), and each stint says whether he arrived by trade. For a past season, teamAtSeasonEnd is who had him when it ended (null means nobody). Accepts a real name, part of a name, or a league nickname.",
    {
      name: { type: "string", description: "The player's name or nickname." },
      year: YEAR,
    },
    ["name"],
  ),
  tool(
    "get_trades",
    "A season's trades. For each player a team received: the finished weeks it has had him, his points for it (as a starter and in total), valueOverBackup (his starting points minus what that team's best healthy backup at the slot scored, the main measure), and costToGiver (what the team that gave him up lost, measured against its own backups). A side's net is gainedPts minus gavePts, and positive means the trade has helped it so far. scoreboard totals net trade points per team, best first.",
    { year: YEAR },
  ),
  tool(
    "get_draft_recap",
    "A season's draft board and the best-value picks.",
    { year: YEAR },
  ),
  tool(
    "get_playoff_odds",
    "The current season's playoff race, from thousands of simulations of the rest of the regular season. Includes the playoff format and tiebreaker, the record the last spot usually takes, and the games that swing the race most. For each team: playoff, bye, division and seed odds; record, points for (the tiebreaker) and its rank; and mathematically, when checked: clinched, eliminated, winsToClinch (wins in its remaining games that guarantee a spot whatever else happens, null if none do) and missesIfWinsAtMost. Also each remaining game with its win chance and the team's odds if it wins or loses, odds by final record, the other games to root for, projected weekly scores from its current roster with lineupNotes (byes and injuries), how hard its remaining schedule is, recent form, all-play record, and projected final points for. Pass espn_id to get every remaining game for one team and only a summary for the rest. Pass assume for a what-if.",
    {
      espn_id: {
        type: "integer",
        description: "Optional. The franchise to show in full.",
      },
      assume: {
        type: "array",
        description:
          "Optional what-if results for unplayed regular-season games. Every number comes back with these results locked in.",
        items: {
          type: "object",
          properties: {
            week: { type: "integer" },
            winner_espn_id: { type: "integer" },
          },
          required: ["week", "winner_espn_id"],
        },
      },
    },
  ),
  tool(
    "get_schedule",
    "Every matchup in one week, past, current, or future: status (final, in progress, or not started), scores once games start, ESPN's projections (pre-game for finished weeks, live for the week in progress), and which NFL teams are on bye.",
    { year: YEAR, week: WEEK },
  ),
  tool(
    "get_matchup",
    "One team's game in a week, with the score and both full box scores: every starter and bench player with his points, ESPN projection, NFL team, and NFL opponent.",
    { espn_id: ESPN_ID, week: WEEK, year: YEAR },
    ["espn_id"],
  ),
  tool(
    "get_team_games",
    "Every finished game a team played in one season: week, opponent, both scores, and the result, with its high and low scores. Playoff weeks are marked (consolation games look the same as playoff games).",
    { espn_id: ESPN_ID, year: YEAR },
    ["espn_id"],
  ),
  tool(
    "get_player_rankings",
    "A season leaderboard for one position. For each player: fantasy points in total and per game, games played, consistency (0-100, higher is steadier), floor and ceiling weeks, boom and bust rates, key NFL stats as season totals, and fantasyTeam (who has him now, or who had him at the end of a past season; null means a free agent). Can be narrowed to free agents or to one team's players.",
    {
      position: POSITION,
      year: YEAR,
      sort_by: {
        type: "string",
        enum: ["total", "per_game", "consistency", "ceiling", "floor"],
        description: "Default total.",
      },
      free_agents_only: { type: "boolean" },
      espn_id: {
        type: "integer",
        description: "Optional. Only this franchise's players.",
      },
      limit: { type: "integer", description: "How many players, 1-40. Default 15." },
    },
    ["position"],
  ),
  tool(
    "get_defense_vs_position",
    "How many fantasy points each NFL defense gives up per game to a position this season, against the league average. softestRank 1 gives up the most, so it's the easiest matchup. Omit position for every position.",
    { position: { type: "string", enum: ["QB", "RB", "WR", "TE", "K"] }, year: YEAR },
  ),
  tool(
    "get_projection_accuracy",
    "How each team has scored against ESPN's pre-game projections: total and per-week difference (positive = outscored its projection), weeks it beat its projection, and its best and worst weeks against projection. Includes playoff weeks. Season or all-time.",
    {
      year: YEAR,
      all_time: { type: "boolean", description: "True for all seasons combined." },
    },
  ),
  tool(
    "get_optimal_lineup",
    "The best possible starting lineup for one finished week, picked from every player in the league (every roster plus free agents), with who had each player.",
    { year: YEAR, week: { type: "integer", description: "Week number. Omit for the latest finished week." } },
  ),
  tool(
    "get_trading_block",
    "The players each team has put on ESPN's trading block or marked untouchable, with season points.",
  ),
  tool(
    "evaluate_trade",
    "Plays out a proposed trade over the rest of the regular season the way the site's trade calculator does: each team's best weekly lineup before and after (NFL byes, injuries, and the roster limit included), expected points per week, expected wins, and who it would have to drop. Player names can be partial or a league nickname.",
    {
      team_a_espn_id: ESPN_ID,
      team_a_gives: { type: "array", items: { type: "string" } },
      team_b_espn_id: ESPN_ID,
      team_b_gives: { type: "array", items: { type: "string" } },
    },
    ["team_a_espn_id", "team_a_gives", "team_b_espn_id", "team_b_gives"],
  ),
  tool(
    "get_articles",
    "Articles league members wrote for the site. Without slug, the list, newest first, with a short preview. With slug, one article's full text.",
    { slug: { type: "string", description: "Optional. The article to read." } },
  ),
];

/** Every nicknamed player's roster status, for the prompt. */
export async function nicknameStatuses(): Promise<NicknameStatus[]> {
  return Promise.all(
    PLAYER_NICKNAMES.map(async ({ name, nickname }) => ({
      nickname,
      status: await getPlayerRosterStatus(name),
    })),
  );
}

type Input = Record<string, unknown>;

class ToolInputError extends Error {}

function requireInt(input: Input, key: string): number {
  const v = input[key];
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new ToolInputError(`${key} must be an integer.`);
  }
  return v;
}

/** The requested season, or the active/newest one. Rejects seasons we don't have
 *  because the aggregations assume at least one team. */
async function resolveYear(input: Input): Promise<number> {
  const seasons = await getSeasons(); // newest first
  if (input.year == null) {
    const season = seasons.find((s) => s.is_active) ?? seasons[0];
    if (!season) throw new ToolInputError("No seasons on record.");
    return season.year;
  }
  const year = requireInt(input, "year");
  if (!seasons.some((s) => s.year === year)) {
    throw new ToolInputError(
      `No data for ${year}. Seasons on record: ${seasons.map((s) => s.year).join(", ")}.`,
    );
  }
  return year;
}

/** Real names for what was asked: nickname first, then exact, then partial. */
async function matchPlayers(query: string): Promise<string[]> {
  const q = query.trim().toLowerCase();
  const nick = PLAYER_NICKNAMES.find((p) => p.nickname.toLowerCase() === q);
  if (nick) return [nick.name];
  const names = (await getAllPlayerNames()).map((p) => p.name);
  const exact = names.find((n) => n.toLowerCase() === q);
  if (exact) return [exact];
  return names.filter((n) => n.toLowerCase().includes(q));
}

/** A schedule entry without the zeros an unplayed game carries, which the bot
 *  read as real scores and projections. */
function gameForBot(g: UpcomingMatch) {
  const { teamScore, oppScore, teamProjected, oppProjected } = g;
  return {
    week: g.week,
    isHome: g.isHome,
    opponent: g.opponent,
    played: g.played,
    live: g.live,
    ...(g.played || g.live ? { teamScore, oppScore } : {}),
    ...(teamProjected ? { teamProjected } : {}),
    ...(oppProjected ? { oppProjected } : {}),
  };
}

/** The NFL team's record and the player's real NFL points, which read like
 *  fantasy numbers. */
const MISLEADING_STATS = new Set(["teamWin", "teamLoss", "pointsScored"]);

/** A season stat line without unnamed ESPN stat ids or stats that read like
 *  something else. Yardage is already season totals (see seasonTotals in
 *  queries.ts), with `…PerGame` keys alongside. */
function seasonStats(
  stats: Record<string, number>,
  position: string,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(stats).filter(
      ([key]) =>
        !/^\d+$/.test(key) &&
        !MISLEADING_STATS.has(key) &&
        (position === "D/ST" || !key.startsWith("defensive")),
    ),
  );
}

/** PlayerDetail reshaped so it can't be misread. The page's weekly chart pads
 *  the rest of the season with zeros and counts the unplayed current week in
 *  its average, which had the bot reporting games that hadn't happened. */
function playerForBot(
  detail: PlayerDetail,
  roster: PlayerRosterStatus | null,
  liveWeek: number,
) {
  const stints = roster?.year === detail.year ? roster.stints : [];
  const teamIn = (week: number) =>
    stints.find((s) => week >= s.fromWeek && week <= s.toWeek)?.team.name;

  const weekly = detail.weekly
    // The week being played only counts once he has points in it.
    .filter((w) => w.week < liveWeek || (w.week === liveWeek && w.points !== 0))
    .map((w) => {
      const team = teamIn(w.week);
      return {
        week: w.week,
        points: w.dnp ? null : w.points,
        ...(w.freeAgent ? { freeAgent: true } : team ? { fantasyTeam: team } : {}),
        ...(w.bye && { nflBye: true }),
        ...(w.week >= liveWeek && { inProgress: true }),
        ...(w.injury && { injury: w.injury }),
      };
    });
  let bestWeek: { week: number; points: number } | null = null;
  for (const w of weekly) {
    if (w.points == null || w.nflBye || w.inProgress) continue;
    if (!bestWeek || w.points > bestWeek.points) {
      bestWeek = { week: w.week, points: w.points };
    }
  }

  return {
    name: detail.name,
    position: detail.position,
    nflTeam: detail.nflTeam,
    year: detail.year,
    weekly,
    bestWeek,
    seasons: detail.seasons.map((s) => ({
      year: s.year,
      position: s.position,
      nflTeam: s.nflTeam,
      gamesPlayed: s.games,
      fantasyPointsTotal: s.totalPts,
      fantasyPointsPerGame: s.avgPts,
      stats: seasonStats(s.s, s.position),
    })),
    nflTeamShare: detail.nflShare,
    // Who has him now is in rosterStatus; this only helps for a past season.
    ...(!detail.liveSeason && { teamAtSeasonEnd: detail.fantasyTeam }),
    rosterStatus: roster,
  };
}

/** The week asked for, or else the week being played (the last week, for a
 *  finished season). */
async function resolveWeek(input: Input, year: number, matchups: Matchup[]): Promise<number> {
  const weeks = [...new Set(matchups.map((m) => m.week))].sort((a, b) => a - b);
  if (weeks.length === 0) throw new ToolInputError(`No games on record for ${year}.`);
  if (input.week != null) {
    const week = requireInt(input, "week");
    if (!weeks.includes(week)) {
      throw new ToolInputError(
        `No week ${week} in ${year}. Weeks on record: ${weeks[0]}-${weeks[weeks.length - 1]}.`,
      );
    }
    return week;
  }
  const season = (await getSeasons()).find((s) => s.year === year);
  const live = firstUnfinishedWeek(season);
  return weeks.includes(live) ? live : weeks[weeks.length - 1];
}

/** A week that hasn't kicked off has 0-0 rows that read like real scores. */
function gameStatus(m: Matchup): "final" | "in progress" | "not started" {
  const started = (m.home_score ?? 0) !== 0 || (m.away_score ?? 0) !== 0;
  if (m.final) return "final";
  return started ? "in progress" : "not started";
}

const KEY_STATS: Record<string, string[]> = {
  QB: ["passingYards", "passingTouchdowns", "passingInterceptions", "rushingYards", "rushingTouchdowns"],
  RB: [
    "rushingAttempts",
    "rushingYards",
    "rushingTouchdowns",
    "receivingTargets",
    "receivingReceptions",
    "receivingYards",
    "receivingTouchdowns",
  ],
  WR: ["receivingTargets", "receivingReceptions", "receivingYards", "receivingTouchdowns"],
  TE: ["receivingTargets", "receivingReceptions", "receivingYards", "receivingTouchdowns"],
  K: ["madeFieldGoals", "attemptedFieldGoals", "madeFieldGoalsFrom50Plus", "madeExtraPoints"],
  "D/ST": [
    "defensiveSacks",
    "defensiveInterceptions",
    "defensiveFumbles",
    "defensivePlusSpecialTeamsTouchdowns",
    "defensivePointsAllowed",
  ],
};

const MAX_RANKED_PLAYERS = 40;
const ARTICLE_CHARS = 8000;

/** A player on one roster from a partial name or nickname. */
function rosterMatch(team: CalcTeam, query: string): string {
  const q = query.trim().toLowerCase();
  const names = team.players.map((p) => p.name);
  const nick = PLAYER_NICKNAMES.find((p) => p.nickname.toLowerCase() === q);
  if (nick && names.includes(nick.name)) return nick.name;
  const exact = names.find((n) => n.toLowerCase() === q);
  if (exact) return exact;
  const partial = names.filter((n) => n.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  throw new ToolInputError(
    partial.length
      ? `"${query}" matches more than one ${team.name} player: ${partial.join(", ")}.`
      : `${team.name} has no player matching "${query}". Its roster: ${names.join(", ")}.`,
  );
}

const HANDLERS: Record<string, (input: Input) => Promise<unknown>> = {
  async get_standings(input) {
    if (input.all_time === true) {
      return {
        scope: "Every season combined, regular season only.",
        standings: (await getAllTimeStandings()).map((s) => ({
          rank: s.rank,
          team: s.team,
          wins: s.wins,
          losses: s.losses,
          ties: s.ties,
          pointsFor: s.pointsFor,
          pointsAgainst: s.pointsAgainst,
        })),
      };
    }
    const year = await resolveYear(input);
    const [teams, matchups, stats, divisions] = await Promise.all([
      getTeams(year),
      getMatchups(year),
      getYearStats(year),
      getDivisionStandings(year),
    ]);
    const divisionOf = new Map(
      divisions.flatMap((d) =>
        d.standings.map((s) => [s.team.id, { division: d.name, divisionRank: s.rank }]),
      ),
    );
    // stats.fraud is sorted biggest fraud first.
    const fraudById = new Map(
      stats.fraud.map((f, i) => [
        f.team.id,
        { fraudScore: f.fraudScore, fraudRank: i + 1 },
      ]),
    );
    const standings = buildStandings(teams, matchups);
    // Ranked here because the bot got comparisons wrong working them out itself.
    const rankAmong = (value: number, all: number[]) =>
      1 + all.filter((v) => v > value).length;
    const pointsFor = standings.map((s) => s.pointsFor);
    const pointsAgainst = standings.map((s) => s.pointsAgainst);
    return {
      year,
      standings: standings.map((s) => ({
        ...s,
        pointsForRank: rankAmong(s.pointsFor, pointsFor),
        pointsAgainstRank: rankAmong(s.pointsAgainst, pointsAgainst),
        ...fraudById.get(s.team.id),
        ...divisionOf.get(s.team.id),
      })),
    };
  },

  async get_team(input) {
    const espnId = requireInt(input, "espn_id");
    const franchise = await getFranchise(espnId);
    if (!franchise) throw new ToolInputError(`No franchise ${espnId}.`);
    const [home, roster, yearStats] = await Promise.all([
      getTeamHome(espnId),
      getFranchiseRoster(espnId),
      Promise.all(franchise.seasons.map((s) => getYearStats(s.year))),
    ]);
    return {
      ...franchise,
      titles: championshipsFor(espnId),
      seasons: franchise.seasons.map((s, i) => ({
        ...s,
        fraudScore: yearStats[i].fraud.find((f) => f.team.id === s.teamId)
          ?.fraudScore,
      })),
      topScorersAcrossAllSeasons: roster.topScorers,
      current: home && {
        ...home,
        upcoming: home.upcoming.map(gameForBot),
        lastResult: home.lastResult && gameForBot(home.lastResult),
      },
    };
  },

  async get_head_to_head(input) {
    const espnId = requireInt(input, "espn_id");
    const h2h = await getFranchiseHeadToHead(espnId);
    if (input.opponent_espn_id == null) return h2h;
    const opponent = requireInt(input, "opponent_espn_id");
    return (
      h2h.opponents.find((o) => o.opponentEspnId === opponent) ?? {
        games: 0,
        note: "These franchises haven't played.",
      }
    );
  },

  async get_team_lineup(input) {
    const outlook = await getTeamOutlook(requireInt(input, "espn_id"));
    if (!outlook) return { note: "No lineup on record." };
    // Every player's rating is already attached; the full defense table isn't needed.
    return { ...outlook, ratings: undefined };
  },

  async get_weekly_recap(input) {
    if (input.year == null && input.week == null) {
      return (await getWeeklyRecap()) ?? { note: "No finished weeks yet." };
    }
    const year = await resolveYear(input);
    const week = input.week == null ? undefined : requireInt(input, "week");
    return (
      (await getWeeklyRecapFor(year, week)) ?? {
        note: "That week hasn't finished.",
      }
    );
  },

  async get_leaderboards(input) {
    if (input.all_time === true) return getAllTimeStats();
    const year = await resolveYear(input);
    return { year, ...(await getYearStats(year)) };
  },

  async get_power_rankings(input) {
    const year = input.year == null ? null : await resolveYear(input);
    const groups = async (y: number) =>
      input.position_groups === true
        ? {
            positionGroups: (await getPositionStrength(y)).groups.map((g) => ({
              position: g.label,
              bestPlayersCounted: g.count,
              rankings: g.rows.map((r) => ({
                rank: r.rank,
                team: r.team,
                seasonPoints: r.score,
                players: r.players.map((p) => p.name),
              })),
            })),
          }
        : {};
    const rows = (r: PowerRow[]) => r.map((x) => ({ rank: x.rank, team: x.team, change: x.change }));

    // The site shows the hand-picked weekly rankings whenever the season has any.
    const manualYear = year ?? (await resolveYear({}));
    const [manual, history] = await Promise.all([
      getManualPowerRankings(manualYear),
      getManualRankingHistory(manualYear),
    ]);
    if (manual) {
      return {
        year: manualYear,
        source: "Picked by hand each week by a league member.",
        latest: manual.label,
        rankings: rows(manual.rows),
        pastWeeks: history.weeks.map((w, i) => ({
          week: w.label,
          order: history.series
            .filter((s) => s.ranks[i] != null)
            .sort((a, b) => a.ranks[i]! - b.ranks[i]!)
            .map((s) => s.team.name.trim()),
        })),
        ...(await groups(manualYear)),
      };
    }
    if (year == null) {
      const latest = await getLatestPowerRankings();
      return {
        year: latest.year,
        source: latest.preseason
          ? "Preseason rankings, entered by hand before any games."
          : "Computed from results.",
        rankings: rows(latest.rows),
        ...(await groups(latest.year)),
      };
    }
    const computed = await getPowerRankings(year);
    const preseason = computed.length ? [] : await getPreseasonPowerRankings(year);
    return {
      year,
      source: computed.length
        ? "Computed from results."
        : preseason.length
          ? "Preseason rankings, entered by hand before any games."
          : "No rankings for this season.",
      rankings: rows(computed.length ? computed : preseason),
      ...(await groups(year)),
    };
  },

  async get_player(input) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new ToolInputError("name is required.");
    }
    const matches = await matchPlayers(input.name);
    if (matches.length === 0) return { note: "No player by that name." };
    if (matches.length > 1) {
      return { note: "More than one match.", matches: matches.slice(0, 10) };
    }
    const year = await resolveYear(input);
    const [detail, rosterStatus, seasons] = await Promise.all([
      getPlayerDetail(matches[0], year),
      getPlayerRosterStatus(matches[0]),
      getSeasons(),
    ]);
    if (!detail) return { note: "No stats for that player." };
    const liveWeek = firstUnfinishedWeek(seasons.find((s) => s.year === year));
    return playerForBot(detail, rosterStatus, liveWeek);
  },

  async get_trades(input) {
    const year = await resolveYear(input);
    const seasons = await getSeasons();
    const { trades, scoreboard } = await getTrades(year);
    if (trades.length === 0) {
      const current = seasons.find((s) => s.is_active)?.year === year;
      return {
        year,
        trades: [],
        note: current
          ? "No trades yet this season."
          : "Trades weren't recorded for this season, so this doesn't mean none happened.",
      };
    }
    // The page's week-by-week breakdowns roughly double the size, and a long
    // trade list would get cut off.
    return {
      year,
      trades: trades.map((t) => ({
        tradedOn: t.tradedAt.slice(0, 10),
        firstWeek: t.firstWeek,
        finishedWeeksSince: t.weeksSince,
        sides: t.sides.map((s) => ({
          team: s.team,
          received: s.receives.map((p) => ({
            name: p.name,
            position: p.position,
            fromEspnId: p.fromEspnId,
            weeksWithTeam: p.weeks,
            startedPts: p.startedPts,
            totalPts: p.totalPts,
            valueOverBackup: p.value,
            costToGiver: p.lost,
          })),
          gainedPts: s.gainedPts,
          gavePts: s.gavePts,
          net: s.net,
        })),
      })),
      scoreboard: scoreboard.map((s) => ({
        team: s.team,
        trades: s.trades,
        gainedPts: s.gainedPts,
        gavePts: s.gavePts,
        net: s.net,
      })),
    };
  },

  async get_draft_recap(input) {
    return getDraftRecap(await resolveYear(input));
  },

  async get_playoff_odds(input) {
    const raw = input.assume ?? [];
    if (!Array.isArray(raw)) throw new ToolInputError("assume must be a list.");
    const assume = raw.map((a) => {
      const item = (a ?? {}) as Input;
      return {
        week: requireInt(item, "week"),
        winnerEspnId: requireInt(item, "winner_espn_id"),
      };
    });
    const focus = input.espn_id == null ? null : requireInt(input, "espn_id");
    const result = await getPlayoffOdds(assume, focus);
    if (typeof result.error === "string") throw new ToolInputError(result.error);
    return result;
  },

  async get_schedule(input) {
    const year = await resolveYear(input);
    const [teams, matchups, byes] = await Promise.all([
      getTeams(year),
      getMatchups(year),
      getProTeamByes(year),
    ]);
    const week = await resolveWeek(input, year, matchups);
    const projections = await getMatchupProjections(year, week);
    const nameOf = new Map(teams.map((t) => [t.id, t.name.trim()]));
    return {
      year,
      week,
      ...(isPlayoffWeek(year, week) && {
        note: "A playoff week. Championship and consolation games look the same here.",
      }),
      games: matchups
        .filter((m) => m.week === week)
        .map((m) => {
          const status = gameStatus(m);
          const p = projections.find((x) => x.id === m.id);
          const hs = Number(m.home_score ?? 0);
          const as = Number(m.away_score ?? 0);
          const hp = Number(p?.home_projected ?? 0);
          const ap = Number(p?.away_projected ?? 0);
          return {
            home: nameOf.get(m.home_team_id),
            away: nameOf.get(m.away_team_id),
            status,
            ...(status !== "not started" && { homeScore: hs, awayScore: as }),
            ...(status === "final" && {
              winner: hs === as ? "tie" : nameOf.get(hs > as ? m.home_team_id : m.away_team_id),
            }),
            ...((hp > 0 || ap > 0) && { homeProjected: hp, awayProjected: ap }),
          };
        }),
      nflTeamsOnBye: byes
        .filter((b) => b.byeWeek === week)
        .map((b) => b.proTeam)
        .sort(),
    };
  },

  async get_matchup(input) {
    const espnId = requireInt(input, "espn_id");
    const year = await resolveYear(input);
    const [teams, matchups] = await Promise.all([getTeams(year), getMatchups(year)]);
    const week = await resolveWeek(input, year, matchups);
    const team = teams.find((t) => t.espn_id === espnId);
    if (!team) throw new ToolInputError(`No franchise ${espnId} in ${year}.`);
    const m = matchups.find(
      (x) => x.week === week && (x.home_team_id === team.id || x.away_team_id === team.id),
    );
    if (!m) {
      return {
        note: `${team.name.trim()} has no game in week ${week} of ${year}${isPlayoffWeek(year, week) ? " (a playoff bye, or knocked out)" : ""}.`,
      };
    }
    const status = gameStatus(m);
    const detail = await getMatchupDetail(m.id);
    const nameOf = (id: number) => teams.find((t) => t.id === id)?.name.trim();
    if (!detail || detail.home.starters.length + detail.away.starters.length === 0) {
      return {
        year,
        week,
        status,
        home: nameOf(m.home_team_id),
        away: nameOf(m.away_team_id),
        note: "Lineups for this week aren't available until it starts.",
      };
    }
    const played = status !== "not started";
    const row = (r: SlotRow) => ({
      slot: r.slot,
      player: r.playerName,
      nflTeam: r.proTeam,
      nflOpponent: r.opponent,
      ...(played && { points: r.points }),
      ...(r.projected ? { projected: r.projected } : {}),
    });
    const side = (
      name: string | undefined,
      score: number,
      projected: number | null,
      lineup: { starters: SlotRow[]; bench: SlotRow[] },
    ) => ({
      team: name,
      ...(played && { score }),
      ...(projected ? { projected } : {}),
      starters: lineup.starters.map(row),
      bench: lineup.bench.map(row),
    });
    return {
      year,
      week,
      status,
      ...(status === "in progress" && { note: "Still being played, so points are partial." }),
      home: side(detail.homeTeam?.name.trim(), detail.homeScore, detail.homeProjected, detail.home),
      away: side(detail.awayTeam?.name.trim(), detail.awayScore, detail.awayProjected, detail.away),
    };
  },

  async get_team_games(input) {
    const espnId = requireInt(input, "espn_id");
    const year = await resolveYear(input);
    const series = (await getYearPerformance(year)).series.find((s) => s.team.espn_id === espnId);
    if (!series || series.points.length === 0) {
      return { note: `That franchise has no finished games in ${year}.` };
    }
    const pts = series.points;
    const high = pts.reduce((a, b) => (b.score > a.score ? b : a));
    const low = pts.reduce((a, b) => (b.score < a.score ? b : a));
    return {
      year,
      team: series.team.name.trim(),
      games: pts.map((p) => ({
        week: p.week,
        opponent: p.opponentName,
        score: p.score,
        opponentScore: p.opponentScore,
        result: p.score === p.opponentScore ? "T" : p.won ? "W" : "L",
        ...(p.isPlayoff && { playoffWeek: true }),
      })),
      highScore: { week: high.week, score: high.score },
      lowScore: { week: low.week, score: low.score },
    };
  },

  async get_player_rankings(input) {
    const raw = typeof input.position === "string" ? input.position.trim().toUpperCase() : "";
    const position = ["DST", "DEF", "D"].includes(raw) ? "D/ST" : raw;
    if (!POSITIONS.includes(position)) {
      throw new ToolInputError(`position must be one of ${POSITIONS.join(", ")}.`);
    }
    const year = await resolveYear(input);
    const [all, seasons] = await Promise.all([getPlayerComparison(year, position), getSeasons()]);
    let rows = all;
    if (input.free_agents_only === true) rows = rows.filter((r) => !r.fantasyTeam);
    if (input.espn_id != null) {
      const id = requireInt(input, "espn_id");
      rows = rows.filter((r) => r.fantasyTeam?.espnId === id);
    }
    const sortBy = typeof input.sort_by === "string" ? input.sort_by : "total";
    const maxGames = Math.max(0, ...all.map((r) => r.games));
    const minGames = Math.min(4, Math.ceil(maxGames / 2));
    const keys: Record<string, (r: (typeof rows)[number]) => number | null> = {
      total: (r) => r.totalPts,
      per_game: (r) => (r.games >= minGames ? r.avgPts : null),
      consistency: (r) => r.consistency,
      ceiling: (r) => r.ceiling,
      floor: (r) => r.floor,
    };
    const key = keys[sortBy];
    if (!key) throw new ToolInputError(`sort_by must be one of ${Object.keys(keys).join(", ")}.`);
    const limit =
      input.limit == null ? 15 : Math.min(MAX_RANKED_PLAYERS, Math.max(1, requireInt(input, "limit")));
    const live = seasons.find((s) => s.year === year)?.is_active ?? false;
    return {
      year,
      position,
      sortedBy: sortBy,
      ...(sortBy === "per_game" && { note: `Players with fewer than ${minGames} games are left out.` }),
      ...(["consistency", "ceiling", "floor"].includes(sortBy) && {
        note: "Players with fewer than 6 games have no consistency, floor, or ceiling and are left out.",
      }),
      ...(!live && { fantasyTeamMeans: "who had him when that season ended" }),
      players: rows
        .filter((r) => key(r) != null)
        .sort((a, b) => key(b)! - key(a)!)
        .slice(0, limit)
        .map((r, i) => ({
          rank: i + 1,
          name: r.name,
          fantasyTeam: r.fantasyTeam?.name ?? null,
          nflTeam: r.nflTeam,
          games: r.games,
          totalPoints: r.totalPts,
          pointsPerGame: r.avgPts,
          consistency: r.consistency,
          floor: r.floor,
          ceiling: r.ceiling,
          boomPct: r.boomPct,
          bustPct: r.bustPct,
          stats: Object.fromEntries(
            KEY_STATS[position].filter((k) => r.s[k] != null).map((k) => [k, r.s[k]]),
          ),
        })),
    };
  },

  async get_defense_vs_position(input) {
    const year = await resolveYear(input);
    const d = await getDefenseStats(year);
    if (d.defenses.length === 0) return { note: "No finished games to measure yet." };
    const base = {
      year: d.year,
      weeksCounted: d.weeks,
      note: "Fantasy points allowed per game. softestRank 1 gives up the most, so it's the easiest matchup.",
    };
    if (input.position != null) {
      const pos = String(input.position).trim().toUpperCase();
      if (!d.positions.includes(pos)) {
        throw new ToolInputError(`position must be one of ${d.positions.join(", ")}.`);
      }
      return {
        ...base,
        position: pos,
        leagueAvgPerGame: d.leagueAvg[pos],
        defenses: d.defenses
          .filter((x) => x.cells[pos])
          .map((x) => ({
            defense: x.defense,
            pointsAllowedPerGame: x.cells[pos].perGame,
            vsLeagueAvg: x.cells[pos].perGame - d.leagueAvg[pos],
            softestRank: x.cells[pos].rank,
          }))
          .sort((a, b) => a.softestRank - b.softestRank),
      };
    }
    return {
      ...base,
      leagueAvgPerGame: d.leagueAvg,
      defenses: d.defenses.map((x) => ({
        defense: x.defense,
        ...Object.fromEntries(
          d.positions
            .filter((p) => x.cells[p])
            .map((p) => [p, { perGame: x.cells[p].perGame, softestRank: x.cells[p].rank }]),
        ),
      })),
    };
  },

  async get_projection_accuracy(input) {
    const allTime = input.all_time === true;
    const year = allTime ? null : await resolveYear(input);
    const d = year == null ? await getAllTimeProjectedDiff() : await getProjectedDiff(year);
    const week = (w: (typeof d.rows)[number]["best"]) =>
      w && { year: w.year, week: w.week, actual: w.actual, projected: w.projected, diff: w.diff };
    return {
      ...(year == null ? { scope: "Every season combined." } : { year }),
      note: "diff is actual minus ESPN's pre-game projection. A week still being played isn't counted.",
      teams: d.rows.map((r) => ({
        team: r.team,
        games: r.games,
        actual: r.actual,
        projected: r.projected,
        totalDiff: r.diff,
        avgDiffPerWeek: r.avgDiff,
        weeksBeatProjection: r.beat,
        bestWeek: week(r.best),
        worstWeek: week(r.worst),
      })),
    };
  },

  async get_optimal_lineup(input) {
    const year = await resolveYear(input);
    const matchups = await getMatchups(year);
    const finished = [
      ...new Set(matchups.filter((m) => gameStatus(m) === "final").map((m) => m.week)),
    ].sort((a, b) => a - b);
    if (finished.length === 0) return { note: "No finished weeks yet." };
    const week = input.week == null ? finished[finished.length - 1] : requireInt(input, "week");
    if (!finished.includes(week)) {
      throw new ToolInputError(
        `Week ${week} of ${year} isn't finished. Finished weeks: ${finished[0]}-${finished[finished.length - 1]}.`,
      );
    }
    const r = await getWeekOptimalRoster(year, week);
    if (!r) return { note: "No lineup data for that week." };
    return {
      year,
      week,
      totalPoints: r.total,
      startersFromFreeAgents: r.fromFreeAgents,
      freeAgentPoints: r.freeAgentPoints,
      lineup: r.slots.map((s) => ({
        slot: s.slot,
        player: s.playerName,
        position: s.position,
        nflTeam: s.proTeam,
        points: s.points,
        fantasyTeam: s.teamName ?? "free agent",
      })),
    };
  },

  async get_trading_block() {
    const block = await getTradeBlock();
    if (!block) return { note: "No trading block data." };
    const player = (p: (typeof block.teams)[number]["onBlock"][number]) => ({
      name: p.name,
      position: p.position,
      nflTeam: p.proTeam,
      seasonPoints: p.points,
      games: p.games,
    });
    const listed = block.teams.filter((t) => t.onBlock.length || t.untouchable.length);
    return {
      year: block.year,
      note: "As of the last daily sync from ESPN.",
      teams: listed.map((t) => ({
        team: t.name,
        onTheBlock: t.onBlock.map(player),
        untouchable: t.untouchable.map(player),
      })),
      teamsWithNothingListed: block.teams.filter((t) => !listed.includes(t)).map((t) => t.name),
    };
  },

  async evaluate_trade(input) {
    const a = requireInt(input, "team_a_espn_id");
    const b = requireInt(input, "team_b_espn_id");
    if (a === b) throw new ToolInputError("A trade needs two different teams.");
    const names = (key: string) => {
      const v = input[key];
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x.trim())) {
        throw new ToolInputError(`${key} must be a list of player names.`);
      }
      return v as string[];
    };
    const aNames = names("team_a_gives");
    const bNames = names("team_b_gives");
    if (aNames.length + bNames.length === 0) throw new ToolInputError("Name at least one player.");
    const data = await getTradeCalcData();
    if (!data) return { note: "There's no season in progress to trade in." };
    const teamA = data.teams.find((t) => t.espnId === a);
    const teamB = data.teams.find((t) => t.espnId === b);
    if (!teamA || !teamB) throw new ToolInputError("Both teams must be current franchises.");
    const result = evaluateTrade(data, {
      a,
      b,
      aGives: aNames.map((n) => rosterMatch(teamA, n)),
      bGives: bNames.map((n) => rosterMatch(teamB, n)),
    });
    if (!result) throw new ToolInputError("That trade couldn't be evaluated.");
    if (result.weeks.length === 0) return { note: "No regular-season weeks are left to play out." };
    const who = (p: { name: string; position: string }) => `${p.name} (${p.position})`;
    const lineup = (spots: (typeof result.teams)[number]["lineupBefore"]) =>
      spots.map((s) => ({ slot: s.slot, player: s.player?.name ?? "waiver pickup", points: s.pts }));
    return {
      weeksPlayedOut: result.weeks,
      note: "Points are expected starter points per week. Expected wins come from playing out each team's remaining schedule.",
      teams: result.teams.map((t) => ({
        team: t.name,
        gives: t.gives.map(who),
        gets: t.gets.map(who),
        mustDrop: t.drops.map(who),
        pointsPerWeekBefore: t.avgBefore,
        pointsPerWeekAfter: t.avgAfter,
        totalPointsChange: t.totalDelta,
        expectedWinsBefore: t.winsBefore,
        expectedWinsAfter: t.winsAfter,
        weekly: t.weekly,
        bestLineupBefore: lineup(t.lineupBefore),
        bestLineupAfter: lineup(t.lineupAfter),
      })),
    };
  },

  async get_articles(input) {
    if (typeof input.slug === "string" && input.slug.trim()) {
      const article = await getArticleBySlug(input.slug.trim());
      if (!article) return { note: "No published article with that slug." };
      const text =
        article.body.length > ARTICLE_CHARS
          ? `${article.body.slice(0, ARTICLE_CHARS)} [the rest is cut off]`
          : article.body;
      return {
        title: article.title,
        author: article.author,
        published: article.createdAt.slice(0, 10),
        text,
      };
    }
    const articles = await getArticles(25);
    return {
      articles: articles.map((x) => ({
        slug: x.slug,
        title: x.title,
        author: x.author,
        published: x.createdAt.slice(0, 10),
        preview: x.body.replace(/\s+/g, " ").slice(0, 160),
      })),
    };
  },
};

/** Shrinks a result before it reaches the model: rounds floats and reduces every
 *  team row to what the bot talks about. */
function slim(value: unknown): unknown {
  if (typeof value === "number") return Math.round(value * 100) / 100;
  if (Array.isArray(value)) return value.map(slim);
  if (value && typeof value === "object") {
    const obj = value as Input;
    if (typeof obj.espn_id === "number" && typeof obj.name === "string") {
      return { espnId: obj.espn_id, name: obj.name.trim() };
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, slim(v)]),
    );
  }
  return value;
}

export async function runChatTool(
  name: string,
  input: unknown,
): Promise<{ content: string; isError: boolean }> {
  const handler = Object.hasOwn(HANDLERS, name) ? HANDLERS[name] : undefined;
  if (!handler) return { content: `Unknown tool ${name}.`, isError: true };
  try {
    const result = await handler((input ?? {}) as Input);
    const json = JSON.stringify(slim(result));
    return {
      content:
        json.length > MAX_RESULT_CHARS
          ? `${json.slice(0, MAX_RESULT_CHARS)}... [truncated: result too long. Don't guess at what's missing.]`
          : json,
      isError: false,
    };
  } catch (err) {
    if (err instanceof ToolInputError) {
      return { content: err.message, isError: true };
    }
    console.error(`chat tool ${name} failed`, err);
    return { content: "That data couldn't be loaded.", isError: true };
  }
}
