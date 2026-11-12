import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { championshipsFor } from "@/lib/league-config";
import { PLAYER_NICKNAMES, type NicknameStatus } from "@/lib/chat/personality";
import {
  buildStandings,
  firstUnfinishedWeek,
  getAllPlayerNames,
  getAllTimeStats,
  getDraftRecap,
  getFranchise,
  getFranchiseHeadToHead,
  getFranchiseRoster,
  getLatestPowerRankings,
  getMatchups,
  getPlayerDetail,
  getPlayerRosterStatus,
  getSeasons,
  getTeamHome,
  getTeamOutlook,
  getTeams,
  getTrades,
  getWeeklyRecap,
  getWeeklyRecapFor,
  getYearStats,
  type PlayerDetail,
  type PlayerRosterStatus,
  type UpcomingMatch,
} from "@/lib/queries";

// The bot's only view of the league: read-only lookups over the same cached
// queries the pages use. Nothing here can write, and queries.ts reads with the
// anon key, so model output can't change data.

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
    "A season's regular-season standings: rank, record, points for and against with where they rank in the league (pointsForRank 1 = scored the most, pointsAgainstRank 1 = gave up the most), fraud score, and fraud rank (1 = biggest fraud).",
    { year: YEAR },
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
  tool("get_power_rankings", "The latest weekly power rankings."),
  tool(
    "get_player",
    "One player's season. weekly lists his fantasy points for each week played so far: fantasyTeam is who had him that week (this season only), freeAgent means nobody did, points is null when there's no record of him, and inProgress marks the week being played now, whose points are partial. seasons has a line for every season on record: NFL games played, fantasy points in total and per game, and NFL stats, which are season totals unless the name ends in PerGame. rosterStatus covers the current season: current is the team that has him now (null means nobody), and each stint says whether he arrived by trade. Accepts a real name, part of a name, or a league nickname.",
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

/** In player_season, ESPN's per-game yardage overwrites the season total under
 *  the same name (stats 22/40/61 share a name with 3/24/42 in espn_api), so
 *  these three hold per-game averages. */
const PER_GAME_YARDS = ["passingYards", "rushingYards", "receivingYards"];
/** The NFL team's record and the player's real NFL points, which read like
 *  fantasy numbers. */
const MISLEADING_STATS = new Set(["teamWin", "teamLoss", "pointsScored"]);

function seasonStats(
  stats: Record<string, number>,
  games: number,
  position: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(stats)) {
    // Numeric keys are ESPN stat ids nobody has named.
    if (/^\d+$/.test(key) || MISLEADING_STATS.has(key)) continue;
    if (position !== "D/ST" && key.startsWith("defensive")) continue;
    if (PER_GAME_YARDS.includes(key)) {
      out[`${key}PerGame`] = value;
      if (games > 0) out[key] = Math.round(value * games);
    } else {
      out[key] = value;
    }
  }
  return out;
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
      stats: seasonStats(s.s, s.games, s.position),
    })),
    nflTeamShare: detail.nflShare,
    // Who has him now is in rosterStatus; this only helps for a past season.
    ...(stints.length === 0 && { rosteredMostThatSeasonBy: detail.fantasyTeam }),
    rosterStatus: roster,
  };
}

const HANDLERS: Record<string, (input: Input) => Promise<unknown>> = {
  async get_standings(input) {
    const year = await resolveYear(input);
    const [teams, matchups, stats] = await Promise.all([
      getTeams(year),
      getMatchups(year),
      getYearStats(year),
    ]);
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

  async get_power_rankings() {
    return getLatestPowerRankings();
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
