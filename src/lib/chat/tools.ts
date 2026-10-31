import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { championshipsFor } from "@/lib/league-config";
import { PLAYER_NICKNAMES } from "@/lib/chat/personality";
import {
  buildStandings,
  getAllPlayerNames,
  getAllTimeStats,
  getDraftRecap,
  getFranchise,
  getFranchiseHeadToHead,
  getFranchiseRoster,
  getLatestPowerRankings,
  getMatchups,
  getPlayerDetail,
  getSeasons,
  getTeamHome,
  getTeamOutlook,
  getTeams,
  getTrades,
  getWeeklyRecap,
  getWeeklyRecapFor,
  getYearStats,
  type Team,
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
    "A season's regular-season standings: rank, record, points for and against, fraud score, and fraud rank (1 = biggest fraud).",
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
    "One player's fantasy team, weekly points, season average, best week, and past seasons. Accepts a real name, part of a name, or a league nickname.",
    {
      name: { type: "string", description: "The player's name or nickname." },
      year: YEAR,
    },
    ["name"],
  ),
  tool(
    "get_trades",
    "A season's trades and the scoreboard of who gained the most from them.",
    { year: YEAR },
  ),
  tool(
    "get_draft_recap",
    "A season's draft board and the best-value picks.",
    { year: YEAR },
  ),
];

/** Which team has each nicknamed player, from every team's latest lineup. A
 *  player's season stats name whoever rostered him most, which goes stale after
 *  a trade or drop, so that's only the fallback for a player on a bye: lineups
 *  leave him out that week. Players on no roster are left out. */
export async function nicknameRosters(
  franchises: Team[],
): Promise<{ nickname: string; teamName: string }[]> {
  const outlooks = await Promise.all(
    franchises.map((t) => getTeamOutlook(t.espn_id)),
  );
  const current = outlooks.find((o) => o != null);
  const rosters = await Promise.all(
    PLAYER_NICKNAMES.map(async ({ name, nickname }) => {
      const outlook = outlooks.find((o) =>
        [...(o?.starters ?? []), ...(o?.bench ?? [])].some(
          (p) => p.playerName === name,
        ),
      );
      if (outlook) return { nickname, teamName: outlook.team.name.trim() };
      if (!current) return null;

      const detail = await getPlayerDetail(name, current.year);
      const thisWeek = detail?.weekly.find((w) => w.week === current.week);
      const lastWeek = detail?.weekly.find((w) => w.week === current.week - 1);
      return thisWeek?.bye && lastWeek && !lastWeek.freeAgent && detail?.fantasyTeam
        ? { nickname, teamName: detail.fantasyTeam.name }
        : null;
    }),
  );
  return rosters.filter((r) => r != null);
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
    return {
      year,
      standings: buildStandings(teams, matchups).map((s) => ({
        ...s,
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
      current: home,
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
    const detail = await getPlayerDetail(matches[0], await resolveYear(input));
    return detail ?? { note: "No stats for that player." };
  },

  async get_trades(input) {
    const year = await resolveYear(input);
    return { year, ...(await getTrades(year)) };
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
