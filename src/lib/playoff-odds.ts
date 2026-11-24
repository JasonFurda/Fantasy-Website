import "server-only";
import {
  buildStandings,
  getMatchupProjections,
  getMatchups,
  getSeasons,
  getTeams,
  getTradeCalcData,
  type CalcPlayer,
  type Matchup,
  type TradeCalcData,
} from "@/lib/queries";
import { bestLineup } from "@/lib/trade-calc";
import {
  divisionsFor,
  isPlayoffWeek,
  playoffFormat,
  playoffStartWeek,
  type PlayoffFormat,
} from "@/lib/league-config";

// Playoff odds for the season in progress. The rest of the regular season is
// simulated many times. Each team's weekly score is drawn around a projection
// that blends its current roster (the trade calculator's best-lineup model,
// with byes and injuries) and its season scoring. Each finish is then seeded
// the way ESPN does it (league-config PLAYOFF_FORMAT_BY_YEAR): division
// winners first, the rest by record, ties broken by total points for.
//
// Late in the season every win/loss combination of the remaining games is
// also checked, so "clinched", "eliminated" and "wins that guarantee a spot"
// are exact, not simulated.

const SIMULATIONS = 20_000;
/** Share of a team's projection that comes from its current roster once it
 *  has played enough games. The rest is its season scoring average. */
const ROSTER_WEIGHT = 0.6;
/** Games before the season average gets its full weight. */
const FULL_WEIGHT_GAMES = 8;
/** How much of its gap to the league average a team's season average keeps.
 *  A dozen weekly scores are a noisy read of how good a team is. */
const PPG_KEEP = 0.55;
/** Spread of each team's true level around its projection, redrawn every
 *  simulation, because nobody's real strength is known exactly. */
const TEAM_UNCERTAINTY = 5;
/** Lowest weekly score a simulation will produce. */
const MIN_SCORE = 40;
/** Exact win/loss checks only run once few games are left (2^16 outcomes). */
const MAX_ENUMERATED_GAMES = 16;
/** Per-team game lists are trimmed to the next few when none is asked about,
 *  so a mid-season result stays a readable size. */
const GAMES_SHOWN = 4;

export type Assumption = { week: number; winnerEspnId: number };

type Game = {
  week: number;
  home: number; // team index
  away: number;
  live: boolean;
  homeMean: number;
  awayMean: number;
  homeSd: number;
  awaySd: number;
  /** Team index of an assumed winner. */
  forced: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number, d: number) => (d ? round1((100 * n) / d) : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const lineupPts = (players: CalcPlayer[], data: TradeCalcData, week: number | null) =>
  bestLineup(players, data, week).reduce((a, s) => a + s.pts, 0);

/** Small seeded generator so the same data always gives the same odds. */
function rng(seed: number) {
  let s = seed;
  const uniform = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  return () => {
    if (spare != null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    while (u === 0) u = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    const a = 2 * Math.PI * uniform();
    spare = r * Math.sin(a);
    return r * Math.cos(a);
  };
}

function recordLabel(wins: number, games: number): string {
  const w = Math.floor(wins);
  const ties = Math.round((wins - w) * 2);
  const l = games - w - ties;
  return ties ? `${w}-${l}-${ties}` : `${w}-${l}`;
}

/** Recent results reuse a few computed answers; a what-if or a sync changes the key. */
const memo = new Map<string, unknown>();

export async function getPlayoffOdds(
  assume: Assumption[] = [],
  focusEspnId: number | null = null,
): Promise<Record<string, unknown>> {
  const seasons = await getSeasons();
  const season = seasons.find((s) => s.is_active);
  if (!season) return { note: "No season is in progress, so there's no playoff race." };
  const year = season.year;
  const format = playoffFormat(year);
  if (!format) return { note: `The ${year} playoff format isn't set up.` };

  const [teams, matchups, data] = await Promise.all([
    getTeams(year),
    getMatchups(year),
    getTradeCalcData(),
  ]);
  if (!data || data.year !== year) {
    return { note: "This week's rosters aren't loaded yet, so the odds can't be run." };
  }

  const lastRegWeek = playoffStartWeek(year) - 1;
  const remaining = matchups.filter((m) => !m.final && m.week <= lastRegWeek);
  // The week being scored, once its games have started: the trade calculator's
  // weeks begin with the first week that hasn't kicked off.
  const liveWeek =
    season.current_week <= lastRegWeek &&
    (data.weeks.length === 0 || data.weeks[0] > season.current_week)
      ? season.current_week
      : null;
  const liveProj = liveWeek == null ? [] : await getMatchupProjections(year, liveWeek);

  const key = JSON.stringify([
    year,
    season.current_week,
    matchups.map((m) => [m.home_score, m.away_score]),
    liveProj,
    data.teams.map((t) => t.players.map((p) => [p.name, p.value, p.injuryStatus])),
    [...assume].sort((a, b) => a.week - b.week || a.winnerEspnId - b.winnerEspnId),
    focusEspnId,
  ]);
  const hit = memo.get(key);
  if (hit) return hit as Record<string, unknown>;
  const result = compute(year, format, teams, matchups, remaining, data, liveWeek, liveProj, assume, focusEspnId);
  if (memo.size >= 30) memo.delete(memo.keys().next().value!);
  memo.set(key, result);
  return result;
}

function compute(
  year: number,
  format: PlayoffFormat,
  teamRows: Awaited<ReturnType<typeof getTeams>>,
  matchups: Matchup[],
  remaining: Matchup[],
  data: TradeCalcData,
  liveWeek: number | null,
  liveProj: Awaited<ReturnType<typeof getMatchupProjections>>,
  assume: Assumption[],
  focusEspnId: number | null,
): Record<string, unknown> {
  // ---- teams and results so far ------------------------------------------
  const standings = buildStandings(teamRows, matchups);
  const n = standings.length;
  const name = standings.map((s) => s.team.name.trim());
  const espn = standings.map((s) => s.team.espn_id);
  const idxByTeamId = new Map(standings.map((s, i) => [s.team.id, i]));
  const idxByEspn = new Map(espn.map((e, i) => [e, i]));

  const divisions = format.divisionWinnersFirst
    ? divisionsFor(year)
        .map((d) => ({
          name: d.name,
          members: d.espnIds.map((e) => idxByEspn.get(e)).filter((i): i is number => i != null),
        }))
        .filter((d) => d.members.length > 0)
    : [];
  const divOf = new Array<number>(n).fill(-1);
  divisions.forEach((d, di) => d.members.forEach((t) => (divOf[t] = di)));

  const finished = matchups.filter(
    (m) =>
      m.final &&
      !isPlayoffWeek(m.year, m.week) &&
      !((m.home_score ?? 0) === 0 && (m.away_score ?? 0) === 0),
  );
  const scores: number[][] = Array.from({ length: n }, () => []);
  const allPlay = Array.from({ length: n }, () => ({ w: 0, l: 0 }));
  const finishedWeeks = [...new Set(finished.map((m) => m.week))].sort((a, b) => a - b);
  for (const week of finishedWeeks) {
    const wk: [number, number][] = [];
    for (const m of finished.filter((x) => x.week === week)) {
      const h = idxByTeamId.get(m.home_team_id);
      const a = idxByTeamId.get(m.away_team_id);
      if (h == null || a == null) continue;
      wk.push([h, Number(m.home_score ?? 0)], [a, Number(m.away_score ?? 0)]);
    }
    for (const [t, s] of wk) {
      scores[t].push(s);
      for (const [u, x] of wk) {
        if (u === t) continue;
        if (s > x) allPlay[t].w++;
        else if (s < x) allPlay[t].l++;
      }
    }
  }
  const allScores = scores.flat();
  const leagueAvg = allScores.length ? mean(allScores) : 0;
  const baseWins = standings.map((s) => s.wins + s.ties / 2);
  const basePf = standings.map((s) => s.pointsFor);
  const gamesPlayed = standings.map((s) => s.wins + s.losses + s.ties);

  // ---- projections ---------------------------------------------------------
  const rosterOf = (t: number) => data.teams.find((x) => x.espnId === espn[t])?.players ?? [];
  const modelWeeks = [...new Set(remaining.map((m) => m.week))].filter((w) => w !== liveWeek);
  const rs = new Map<string, number>(); // `${t}:${week}` -> best-lineup points
  for (let t = 0; t < n; t++)
    for (const w of modelWeeks) rs.set(`${t}:${w}`, lineupPts(rosterOf(t), data, w));
  const rsFull = Array.from({ length: n }, (_, t) => lineupPts(rosterOf(t), data, null));
  const rsMean = mean([...rs.values()]);
  const target = leagueAvg || rsMean;
  const scale = rsMean > 0 ? target / rsMean : 1;
  const projection = (t: number, w: number) => {
    const r = rs.get(`${t}:${w}`) ?? rsFull[t];
    const g = scores[t].length;
    if (!g || !rsFull[t]) return r * scale;
    const ppgReg = target + PPG_KEEP * (mean(scores[t]) - target);
    const wPpg = (1 - ROSTER_WEIGHT) * Math.min(1, g / FULL_WEIGHT_GAMES);
    return (1 - wPpg) * r * scale + wPpg * ppgReg * (r / rsFull[t]);
  };
  const teamSd = scores.map((s) => {
    const own =
      s.length >= 4 ? Math.sqrt(s.reduce((a, x) => a + (x - mean(s)) ** 2, 0) / (s.length - 1)) : data.scoreSd;
    return Math.sqrt(0.5 * own ** 2 + 0.5 * data.scoreSd ** 2);
  });

  const games: Game[] = [];
  for (const m of [...remaining].sort((a, b) => a.week - b.week || a.id - b.id)) {
    const h = idxByTeamId.get(m.home_team_id);
    const a = idxByTeamId.get(m.away_team_id);
    if (h == null || a == null) continue;
    const g: Game = {
      week: m.week,
      home: h,
      away: a,
      live: m.week === liveWeek,
      homeMean: 0,
      awayMean: 0,
      homeSd: teamSd[h],
      awaySd: teamSd[a],
      forced: null,
    };
    if (g.live) {
      // Mid-week: ESPN's live projection already includes the points scored,
      // and the less there is left to play, the less the score can move.
      const p = liveProj.find((x) => x.id === m.id);
      const side = (proj: number | null | undefined, score: number | null, t: number) => {
        const pr = Number(proj ?? 0);
        const sc = Number(score ?? 0);
        if (pr <= 0) return { mu: projection(t, m.week), sd: teamSd[t] };
        const left = Math.min(1, Math.max(0.03, (pr - sc) / pr));
        return { mu: pr, sd: teamSd[t] * Math.sqrt(left) };
      };
      const hs = side(p?.home_projected, m.home_score, h);
      const as = side(p?.away_projected, m.away_score, a);
      Object.assign(g, { homeMean: hs.mu, homeSd: hs.sd, awayMean: as.mu, awaySd: as.sd });
    } else {
      g.homeMean = projection(h, m.week);
      g.awayMean = projection(a, m.week);
    }
    games.push(g);
  }

  for (const a of assume) {
    const g = games.find(
      (x) => x.week === a.week && (espn[x.home] === a.winnerEspnId || espn[x.away] === a.winnerEspnId),
    );
    if (!g) {
      return {
        error: `No unplayed regular-season game in week ${a.week} involves espn_id ${a.winnerEspnId}.`,
      };
    }
    const winner = idxByEspn.get(a.winnerEspnId)!;
    if (g.forced != null && g.forced !== winner) {
      return { error: `Both teams in ${name[g.home]} vs ${name[g.away]} (week ${g.week}) were assumed to win.` };
    }
    g.forced = winner;
  }

  // ---- seeding ---------------------------------------------------------------
  const all = Array.from({ length: n }, (_, i) => i);
  const seedTeams = (wins: Float64Array, pf: Float64Array) => {
    const better = (x: number, y: number) => wins[y] - wins[x] || pf[y] - pf[x];
    if (divisions.length) {
      const winners = divisions.map((d) => d.members.reduce((b, t) => (better(t, b) < 0 ? t : b)));
      winners.sort(better);
      const rest = all.filter((t) => !winners.includes(t)).sort(better);
      return { seeds: [...winners, ...rest].slice(0, format.teams), winners };
    }
    return { seeds: [...all].sort(better).slice(0, format.teams), winners: [] as number[] };
  };

  // ---- simulation ------------------------------------------------------------
  const G = games.length;
  const N = G === 0 ? 1 : SIMULATIONS;
  const gauss = rng(2026 + year);
  const made = new Float64Array(n);
  const byes = new Float64Array(n);
  const titles = new Float64Array(n);
  const seedCount = new Float64Array(n * format.teams);
  const cond = new Float64Array(n * G * 4); // [homeWon, in|homeWon, awayWon, in|awayWon]
  const homeWins = new Float64Array(G);
  const byFinal = new Map<string, [number, number]>(); // `${t}:${wins}` -> [n, in]
  const lastSpot = new Map<number, number>();
  const wins = new Float64Array(n);
  const pf = new Float64Array(n);
  const eff = new Float64Array(n);
  const homeWon = new Uint8Array(G);
  const inNow = new Uint8Array(n);
  for (let s = 0; s < N; s++) {
    for (let t = 0; t < n; t++) {
      wins[t] = baseWins[t];
      pf[t] = basePf[t];
      eff[t] = gauss() * TEAM_UNCERTAINTY;
    }
    for (let i = 0; i < G; i++) {
      const g = games[i];
      let hs = Math.max(MIN_SCORE, g.homeMean + (g.live ? 0 : eff[g.home]) + gauss() * g.homeSd);
      let as = Math.max(MIN_SCORE, g.awayMean + (g.live ? 0 : eff[g.away]) + gauss() * g.awaySd);
      // An assumed result keeps the drawn scores but gives the winner the higher one.
      if (g.forced != null && (g.forced === g.home) !== hs > as) [hs, as] = [as, hs];
      pf[g.home] += hs;
      pf[g.away] += as;
      homeWon[i] = hs > as ? 1 : 0;
      if (homeWon[i]) wins[g.home]++;
      else wins[g.away]++;
      homeWins[i] += homeWon[i];
    }
    const { seeds, winners } = seedTeams(wins, pf);
    inNow.fill(0);
    seeds.forEach((t, i) => {
      inNow[t] = 1;
      made[t]++;
      seedCount[t * format.teams + i]++;
      if (i < format.byes) byes[t]++;
    });
    for (const t of winners) titles[t]++;
    const cut = wins[seeds[seeds.length - 1]];
    lastSpot.set(cut, (lastSpot.get(cut) ?? 0) + 1);
    for (let t = 0; t < n; t++) {
      const k = `${t}:${wins[t]}`;
      const f = byFinal.get(k) ?? [0, 0];
      f[0]++;
      f[1] += inNow[t];
      byFinal.set(k, f);
      for (let i = 0; i < G; i++) {
        const o = (t * G + i) * 4 + (homeWon[i] ? 0 : 2);
        cond[o]++;
        cond[o + 1] += inNow[t];
      }
    }
  }
  const oddsIf = (t: number, i: number, homeWins: boolean) => {
    const o = (t * G + i) * 4 + (homeWins ? 0 : 2);
    return cond[o] ? (100 * cond[o + 1]) / cond[o] : null;
  };

  // ---- exact clinch / elimination checks -----------------------------------
  const free = games.map((g, i) => (g.forced == null ? i : -1)).filter((i) => i >= 0);
  const exact = free.length <= MAX_ENUMERATED_GAMES;
  type Exact = {
    clinched: boolean;
    eliminated: boolean;
    clinchedBye: boolean | null;
    winsToClinch: number | null;
    missesIfWinsAtMost: number | null;
    gamesLeft: number;
  };
  const exactBy: Exact[] = [];
  if (exact) {
    const spots = format.teams - divisions.length;
    const byeByDivision = divisions.length > 0 && format.byes === divisions.length;
    const fixedWins = [...baseWins];
    for (const g of games) if (g.forced != null) fixedWins[g.forced]++;
    const ownGames = all.map((t) => free.filter((i) => games[i].home === t || games[i].away === t));
    const allIn = new Array<boolean>(n).fill(true);
    const allOut = new Array<boolean>(n).fill(true);
    const allBye = new Array<boolean>(n).fill(true);
    const inByK = all.map((t) => new Array<boolean>(ownGames[t].length + 1).fill(true));
    const outByK = all.map((t) => new Array<boolean>(ownGames[t].length + 1).fill(true));
    const w = new Float64Array(n);
    // Each division's best record; for a team's own division, its rivals' best.
    const divMax = new Float64Array(divisions.length);
    for (let mask = 0; mask < 1 << free.length; mask++) {
      for (let t = 0; t < n; t++) w[t] = fixedWins[t];
      for (let b = 0; b < free.length; b++) {
        const g = games[free[b]];
        w[mask & (1 << b) ? g.home : g.away]++;
      }
      divisions.forEach((d, di) => (divMax[di] = Math.max(...d.members.map((t) => w[t]))));
      for (let t = 0; t < n; t++) {
        const di = divOf[t];
        const rivalMax =
          di >= 0 ? Math.max(-1, ...divisions[di].members.filter((u) => u !== t).map((u) => w[u])) : -1;
        // Worst case: t loses every points tiebreaker. Best case: it wins them all.
        let inWorst = di >= 0 && w[t] > rivalMax;
        let inBest = di >= 0 && w[t] >= rivalMax;
        if (!inWorst || !inBest) {
          let atLeast = 0;
          let above = 0;
          for (let u = 0; u < n; u++) {
            if (u === t) continue;
            if (w[u] >= w[t]) atLeast++;
            if (w[u] > w[t]) above++;
          }
          // Division winners don't take wild-card spots.
          divisions.forEach((_, dj) => {
            const top = dj === di ? rivalMax : divMax[dj];
            if (top >= w[t]) atLeast--;
            if (top > w[t]) above--;
          });
          const wc = divisions.length ? spots : format.teams;
          if (!inWorst) inWorst = atLeast < wc;
          if (!inBest) inBest = above < wc;
        }
        let k = 0;
        for (const i of ownGames[t]) {
          const g = games[i];
          if ((g.home === t) === Boolean(mask & (1 << free.indexOf(i)))) k++;
        }
        if (!inWorst) {
          allIn[t] = false;
          inByK[t][k] = false;
        }
        if (inBest) {
          allOut[t] = false;
          outByK[t][k] = false;
        }
        if (byeByDivision) {
          if (!(di >= 0 && w[t] > rivalMax)) allBye[t] = false;
        } else if (!divisions.length) {
          let atLeast = 0;
          for (let u = 0; u < n; u++) if (u !== t && w[u] >= w[t]) atLeast++;
          if (atLeast >= format.byes) allBye[t] = false;
        }
      }
    }
    for (let t = 0; t < n; t++) {
      const kMax = ownGames[t].length;
      let winsToClinch: number | null = null;
      for (let k = kMax; k >= 0 && inByK[t][k]; k--) winsToClinch = k;
      let missesIfWinsAtMost: number | null = null;
      for (let k = 0; k <= kMax && outByK[t][k]; k++) missesIfWinsAtMost = k;
      exactBy.push({
        clinched: allIn[t],
        eliminated: allOut[t],
        clinchedBye: byeByDivision || !divisions.length ? allBye[t] : null,
        winsToClinch,
        missesIfWinsAtMost,
        gamesLeft: kMax,
      });
    }
  }

  // ---- assemble ----------------------------------------------------------------
  const playoffPct = all.map((t) => (100 * made[t]) / N);
  const meanOf = (t: number, i: number) => (games[i].home === t ? games[i].homeMean : games[i].awayMean);
  const sos = all.map((t) => {
    const opp = games
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => g.home === t || g.away === t)
      .map(({ g, i }) => meanOf(g.home === t ? g.away : g.home, i));
    return opp.length ? mean(opp) : null;
  });
  // Spelled out, because the bot read a bare "rank 10" as the 10th hardest
  // and called the easiest schedule the toughest.
  const ranked = all.filter((u) => sos[u] != null).length;
  const ordinal = (k: number) => (k === 1 ? "" : k === 2 ? "2nd " : k === 3 ? "3rd " : `${k}th `);
  const sosLabel = all.map((t) => {
    if (sos[t] == null) return null;
    const rank = 1 + all.filter((u) => sos[u] != null && sos[u]! > sos[t]!).length;
    return rank <= (ranked + 1) / 2
      ? `${ordinal(rank)}hardest of ${ranked}`
      : `${ordinal(ranked - rank + 1)}easiest of ${ranked}`;
  });
  const pfRank = all.map((t) => 1 + all.filter((u) => basePf[u] > basePf[t]).length);
  const totalGames = all.map((t) => gamesPlayed[t] + games.filter((g) => g.home === t || g.away === t).length);

  const lineupNotes = (t: number) => {
    const players = rosterOf(t);
    const full = bestLineup(players, data, null).flatMap((s) => (s.player ? [s.player] : []));
    const notes: string[] = [];
    for (const w of modelWeeks) {
      const starting = new Set(bestLineup(players, data, w).flatMap((s) => (s.player ? [s.player.name] : [])));
      for (const p of full) {
        if (starting.has(p.name)) continue;
        const why = p.byeWeek === w ? "NFL bye" : p.injuryStatus === "INJURY_RESERVE" ? "on IR" : (p.injuryStatus ?? "out").toLowerCase();
        notes.push(`week ${w}: no ${p.name} (${p.position}, ${why})`);
      }
    }
    const first = modelWeeks[0];
    if (first == null) return notes;
    for (const p of full)
      if (p.injuryStatus === "QUESTIONABLE" || p.injuryStatus === "DOUBTFUL")
        notes.push(`week ${first}: ${p.name} (${p.position}) is ${p.injuryStatus.toLowerCase()}`);
    return notes;
  };

  const teamOut = (t: number, detailed: boolean) => {
    const summary = {
      team: name[t],
      espnId: espn[t],
      ...(divisions.length && divOf[t] >= 0 ? { division: divisions[divOf[t]].name } : {}),
      record: recordLabel(baseWins[t], gamesPlayed[t]),
      pointsFor: round1(basePf[t]),
      pointsForRank: pfRank[t],
      playoffOdds: round1(playoffPct[t]),
      byeOdds: round1((100 * byes[t]) / N),
      ...(divisions.length ? { divisionTitleOdds: round1((100 * titles[t]) / N) } : {}),
      ...(exact ? { mathematically: exactBy[t] } : {}),
    };
    if (!detailed) return summary;
    const own = games.map((g, i) => ({ g, i })).filter(({ g }) => g.home === t || g.away === t);
    const others = games.map((g, i) => ({ g, i })).filter(({ g }) => g.home !== t && g.away !== t && g.forced == null);
    const rootFor = others
      .map(({ g, i }) => {
        const d = (oddsIf(t, i, true) ?? 0) - (oddsIf(t, i, false) ?? 0);
        return { g, d };
      })
      .filter(({ d }) => Math.abs(d) >= 1.5)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 3)
      .map(({ g, d }) => ({
        week: g.week,
        rootFor: name[d > 0 ? g.home : g.away],
        over: name[d > 0 ? g.away : g.home],
        oddsSwing: round1(Math.abs(d)),
      }));
    const byRecord = [...byFinal.entries()]
      .filter(([k]) => Number(k.split(":")[0]) === t)
      .map(([k, [c, inn]]) => ({ wins: Number(k.split(":")[1]), c, inn }))
      .filter(({ c }) => c / N >= 0.005)
      .sort((a, b) => b.wins - a.wins)
      .map(({ wins: w, c, inn }) => ({
        finalRecord: recordLabel(w, totalGames[t]),
        chance: pct(c, N),
        playoffOdds: pct(inn, c),
      }));
    const shownGames = focusEspnId == null ? own.slice(0, GAMES_SHOWN) : own;
    return {
      ...summary,
      seedOdds: Object.fromEntries(
        Array.from({ length: format.teams }, (_, s) => [String(s + 1), round1((100 * seedCount[t * format.teams + s]) / N)]).filter(
          ([, v]) => (v as number) >= 0.1,
        ),
      ),
      pointsAgainst: round1(standings[t].pointsAgainst),
      seasonAvg: round1(mean(scores[t])),
      last4Avg: round1(mean(scores[t].slice(-4))),
      allPlayRecord: `${allPlay[t].w}-${allPlay[t].l}`,
      remainingGames: shownGames.map(({ g, i }) => {
        const home = g.home === t;
        const opp = home ? g.away : g.home;
        if (g.forced != null) {
          return { week: g.week, opponent: name[opp], assumed: g.forced === t ? "win" : "loss" };
        }
        const pWin = home ? homeWins[i] / N : 1 - homeWins[i] / N;
        return {
          week: g.week,
          opponent: name[opp],
          ...(g.live ? { liveNow: true } : {}),
          projectedScore: `${round1(home ? g.homeMean : g.awayMean)} to ${round1(home ? g.awayMean : g.homeMean)}`,
          winChance: round1(100 * pWin),
          playoffOddsIfWin: round1(oddsIf(t, i, home) ?? 0),
          playoffOddsIfLoss: round1(oddsIf(t, i, !home) ?? 0),
        };
      }),
      ...(shownGames.length < own.length ? { moreGames: own.length - shownGames.length } : {}),
      byFinalRecord: byRecord,
      rootFor,
      projectedWeeklyScore: Object.fromEntries(modelWeeks.map((w) => [`week ${w}`, round1(projection(t, w))])),
      lineupNotes: lineupNotes(t),
      remainingSchedule: {
        avgOpponentProjection: sos[t] == null ? null : round1(sos[t]!),
        difficulty: sosLabel[t],
      },
      projectedFinalPointsFor: round1(basePf[t] + own.reduce((a, { i }) => a + meanOf(t, i), 0)),
    };
  };

  const order = [...all].sort((a, b) => playoffPct[b] - playoffPct[a] || basePf[b] - basePf[a]);
  const biggest = games
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.forced == null)
    .map(({ g, i }) => {
      const swings = all
        .map((t) => ({ t, a: oddsIf(t, i, true) ?? 0, b: oddsIf(t, i, false) ?? 0 }))
        .filter(({ a, b }) => Math.abs(a - b) >= 3);
      return { g, i, swings, total: swings.reduce((s, x) => s + Math.abs(x.a - x.b), 0) };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(({ g, i, swings }) => ({
      week: g.week,
      game: `${name[g.home]} vs ${name[g.away]}`,
      winChance: `${name[g.home]} ${round1((100 * homeWins[i]) / N)}%`,
      playoffOdds: swings
        .sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))
        .map(({ t, a, b }) => ({
          team: name[t],
          [`if ${name[g.home]} wins`]: round1(a),
          [`if ${name[g.away]} wins`]: round1(b),
        })),
    }));

  const divText = divisions.length
    ? `There are ${divisions.length} divisions (${divisions.map((d) => `${d.name}: ${d.members.map((t) => name[t]).join(", ")}`).join("; ")}). Each division winner is guaranteed a spot and takes one of the top ${divisions.length} seeds, even with a worse record than a wild card; the other ${format.teams - divisions.length} spots go to the best records left. `
    : "";
  return {
    year,
    rules: `${format.teams} of ${n} teams make the playoffs. ${divText}The top ${format.byes} seeds get a first-round bye. Every tie in the standings, division races included, is broken by total points for, not head-to-head.`,
    lastFinishedWeek: finishedWeeks.at(-1) ?? null,
    ...(liveWeek != null && games.some((g) => g.live) ? { liveWeek } : {}),
    weeksLeft: [...new Set(games.map((g) => g.week))],
    ...(assume.length
      ? {
          assumedResults: games
            .filter((g) => g.forced != null)
            .map((g) => `week ${g.week}: ${name[g.forced!]} beats ${name[g.forced === g.home ? g.away : g.home]}`),
        }
      : {}),
    simulations: N,
    method: `Odds come from ${N.toLocaleString("en-US")} simulations of the remaining games. Each team's weekly projection blends its best lineup from its current roster (NFL byes, injuries and waiver-level fill-ins included) with its season scoring average pulled toward the league average${liveWeek != null ? ", and the week in progress uses ESPN's live projection" : ""}. ${exact ? `The mathematically fields check all ${2 ** free.length} win/loss combinations of the remaining games exactly, assuming the team loses every points tiebreaker (clinched) or wins every one (eliminated).` : "Exact clinch and elimination checks only run in the last few weeks."}`,
    lastPlayoffSpotWentTo: [...lastSpot.entries()]
      .sort((a, b) => b[0] - a[0])
      .filter(([, c]) => c / N >= 0.005)
      .map(([w, c]) => ({ record: recordLabel(w, Math.max(...totalGames)), chance: pct(c, N) })),
    teams: order.map((t) => teamOut(t, focusEspnId == null || espn[t] === focusEspnId)),
    gamesThatMatterMost: biggest,
  };
}
